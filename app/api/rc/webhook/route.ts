import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

const MAX_PAYLOAD_SIZE = 102400; // 100KB

interface RCWebhookPayload {
  ownerId: string;
  body?: {
    sourceRecordId?: string;
    recording?: {
      id?: string;
      contentUri?: string;
    };
    [key: string]: unknown;
  };
}

function isValidPayload(data: unknown): data is RCWebhookPayload {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.ownerId === "string";
}

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

  // 2. Fail-closed: require RC_ACCOUNT_ID to be configured
  const expectedAccountId = process.env.RC_ACCOUNT_ID;
  if (!expectedAccountId) {
    console.error("RC webhook: RC_ACCOUNT_ID not configured");
    return new Response("Service unavailable", { status: 503 });
  }

  // 3. Request size limit
  const contentLength = parseInt(request.headers.get("content-length") || "0");
  if (contentLength > MAX_PAYLOAD_SIZE) {
    return new Response("Payload too large", { status: 413 });
  }

  // 4. Parse JSON with error handling
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // 5. Validate payload structure
  if (!isValidPayload(rawBody)) {
    return new Response("Invalid payload", { status: 400 });
  }

  // 6. Account ID verification
  if (rawBody.ownerId !== expectedAccountId) {
    console.warn("RC webhook: account ID mismatch", rawBody.ownerId);
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = getSupabase();

  // 7. Handle RingSense insights event
  const insightsRecordId = rawBody.body?.sourceRecordId;
  if (insightsRecordId) {
    const { error } = await supabase.from("rc_recordings").upsert({
      source_record_id: insightsRecordId,
      insights: rawBody.body || {},
      synced_at: new Date().toISOString(),
    }, { onConflict: "source_record_id" });

    if (error) {
      console.error("RC insights upsert failed:", error.message);
      return new Response("Database error", { status: 500 });
    }
  }

  // 8. Handle call-log event (DEBUG: RC doesn't send these via webhook,
  //    but keeping for manual testing and potential future support)
  const callLogRecordingId = rawBody.body?.recording?.id;
  const audioUri = rawBody.body?.recording?.contentUri;

  if (callLogRecordingId && audioUri) {
    console.log("RC webhook: call-log event received", { callLogRecordingId, audioUri });
    const { error } = await supabase.from("rc_recordings").upsert({
      source_record_id: callLogRecordingId,
      audio_content_uri: audioUri,
      download_error: null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "source_record_id" });

    if (error) {
      console.error("RC call-log upsert failed:", error.message);
      return new Response("Database error", { status: 500 });
    }
  }

  return new Response(null, { status: 200 });
}
