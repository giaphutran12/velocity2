import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { syncDeal } from "@/lib/sync-deal";
import { VelocityDeal } from "@/lib/transformer";

/**
 * /api/sync - Syncs Velocity deal data to Supabase
 *
 * Auth: Requires Bearer token in Authorization header (uses CRON_SECRET)
 * Usage: curl -X POST -H "Authorization: Bearer $CRON_SECRET" -d '{"broker_id":"uuid","deals":[...]}' https://yoursite.com/api/sync
 */

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Require broker_id
    const brokerId = body.broker_id;
    if (!brokerId || typeof brokerId !== "string") {
      return NextResponse.json(
        { error: "Missing required field: broker_id (UUID of the broker)" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(brokerId)) {
      return NextResponse.json(
        { error: "Invalid broker_id format. Must be a valid UUID." },
        { status: 400 }
      );
    }

    // Verify broker exists in database
    const supabase = getSupabase();
    const { data: broker, error: brokerError } = await supabase
      .from("vl_brokers")
      .select("id")
      .eq("id", brokerId)
      .single();

    if (brokerError || !broker) {
      return NextResponse.json(
        { error: "Broker not found. The specified broker_id does not exist." },
        { status: 404 }
      );
    }

    // Accept either single deal or array of deals or Velocity API response
    let deals: VelocityDeal[];
    if (body.deals) {
      // Velocity API response format
      deals = body.deals;
    } else if (Array.isArray(body)) {
      deals = body;
    } else if (body.loanCode) {
      // Single deal
      deals = [body];
    } else {
      return NextResponse.json(
        { error: "Invalid request body. Expected deals array or single deal with broker_id." },
        { status: 400 }
      );
    }

    // Sync all deals with broker_id (with stats tracking)
    const results = await Promise.all(
      deals.map((deal) => syncDeal(deal, brokerId, { trackStats: true }))
    );

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json({
      message: `Synced ${successful.length}/${deals.length} deals`,
      successful: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    message: "POST Velocity deal data to this endpoint to sync to Supabase",
    example: "POST with body: { broker_id: 'uuid', deals: [...] }",
    required: ["broker_id"],
  });
}
