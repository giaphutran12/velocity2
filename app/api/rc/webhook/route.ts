import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET handler for health checks / probes
export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function POST(request: NextRequest) {
  // 1. Validation handshake (required by RC on subscription creation)
  const validationToken = request.headers.get("Validation-Token");
  if (validationToken) {
    return new Response(null, {
      status: 200,
      headers: { "Validation-Token": validationToken },
    });
  }

  // 2. Parse body
  const body = await request.json();

  // 3. Account ID verification (only security available for subscription webhooks)
  if (body.ownerId !== process.env.RC_ACCOUNT_ID) {
    console.warn("RC webhook: account ID mismatch", body.ownerId);
    return new Response("Forbidden", { status: 403 });
  }

  // 4. Upsert recording (minimal - existing cron can enrich if needed)
  const recordId = body.body?.sourceRecordId;
  if (recordId) {
    const supabase = getSupabase();
    await supabase.from("rc_recordings").upsert({
      source_record_id: recordId,
      insights: body.body || {},
      synced_at: new Date().toISOString(),
    }, { onConflict: "source_record_id" });
  }

  return new Response(null, { status: 200 });
}
