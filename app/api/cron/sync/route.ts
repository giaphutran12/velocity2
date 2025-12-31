import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { syncDeal, formatError } from "@/lib/sync-deal";
import { fetchDealsInRange } from "@/lib/velocity-api";
import { VelocityDeal } from "@/lib/transformer";

// Vercel cron security
const CRON_SECRET = process.env.CRON_SECRET;

interface Broker {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
  last_sync_at: string | null;
}

/**
 * Fetch deals for a broker from Velocity API.
 * - If broker has `last_sync_at`: incremental sync from that date (fast)
 * - If no `last_sync_at`: full sync from 2021 (first-time only)
 *
 * @example
 * const deals = await fetchBrokerDeals(broker);
 * // Returns VelocityDeal[] ready for syncDeal()
 */
async function fetchBrokerDeals(broker: Broker): Promise<VelocityDeal[]> {
  const endDate = new Date().toISOString().split("T")[0];

  // Incremental sync: fetch from last sync date
  if (broker.last_sync_at) {
    const startDate = broker.last_sync_at.split("T")[0];
    console.log(`[CRON SYNC] ${broker.name}: incremental sync from ${startDate} to ${endDate}`);
    return fetchDealsInRange(broker, startDate, endDate);
  }

  // First-time sync: fetch all years from 2021
  console.log(`[CRON SYNC] ${broker.name}: full sync (first time) from 2021 to ${endDate}`);
  const allDeals: VelocityDeal[] = [];
  const currentYear = new Date().getFullYear();

  for (let year = 2021; year <= currentYear; year++) {
    const yearStart = `${year}-01-01`;
    const yearEnd = year === currentYear ? endDate : `${year}-12-31`;

    try {
      const yearDeals = await fetchDealsInRange(broker, yearStart, yearEnd);
      allDeals.push(...yearDeals);
      console.log(`[CRON SYNC] ${broker.name} ${year}: fetched ${yearDeals.length} deals`);
      await new Promise((r) => setTimeout(r, 100));
    } catch (error) {
      console.error(`[CRON SYNC] ${broker.name} ${year}: failed -`, error);
      // Continue with other years
    }
  }

  return allDeals;
}

/**
 * Cron endpoint to sync deals from Velocity API for all active brokers.
 *
 * @example
 * // Sync all active brokers
 * curl "http://localhost:3000/api/cron/sync" -H "Authorization: Bearer $CRON_SECRET"
 *
 * // Sync specific broker (partial match)
 * curl "http://localhost:3000/api/cron/sync?broker=Nav" -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  console.log("[CRON SYNC] Starting at", new Date().toISOString());

  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = getSupabase();

  try {
    // Check for broker filter
    const { searchParams } = new URL(request.url);
    const brokerFilter = searchParams.get("broker");

    // Get active brokers (optionally filtered by name)
    let query = supabase
      .from("vl_brokers")
      .select("id, name, api_key, base_url, last_sync_at")
      .eq("is_active", true);

    if (brokerFilter) {
      query = query.ilike("name", `%${brokerFilter}%`);
    }

    const { data: brokers, error: brokersError } = await query;

    if (brokersError) {
      throw new Error(`Failed to fetch brokers: ${formatError(brokersError)}`);
    }

    if (!brokers || brokers.length === 0) {
      console.log("[CRON SYNC] No active brokers found");
      return NextResponse.json({
        message: "No active brokers found",
        hint: "Add brokers to vl_brokers table or run migrate-brokers script",
      });
    }

    console.log(`[CRON SYNC] Found ${brokers.length} active brokers:`, brokers.map(b => b.name));

    const results: {
      broker: string;
      dealsFound: number;
      dealsSynced: number;
      dealsFailed: number;
      error?: string;
    }[] = [];

    // Process each broker
    for (const broker of brokers) {
      console.log(`[CRON SYNC] Processing broker: ${broker.name}`);
      try {
        // Fetch deals from Velocity
        const deals = await fetchBrokerDeals(broker);

        // Log deals to sync
        if (deals.length > 0) {
          console.log(`[CRON SYNC] ${broker.name}: syncing ${deals.length} deals:`);
          deals.forEach((d) => console.log(`  → ${d.loanCode}`));
        }

        // Sync deals with broker_id
        const syncResults = await Promise.all(
          deals.map((deal) => syncDeal(deal, broker.id))
        );
        const successful = syncResults.filter((r) => r.success).length;
        const failed = syncResults.filter((r) => !r.success).length;

        // Update broker sync status
        await supabase
          .from("vl_brokers")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_deals_count: deals.length,
            last_sync_error: failed > 0 ? `${failed} deals failed` : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", broker.id);

        console.log(`[CRON SYNC] ${broker.name}: synced=${successful}, failed=${failed}`);
        results.push({
          broker: broker.name,
          dealsFound: deals.length,
          dealsSynced: successful,
          dealsFailed: failed,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CRON SYNC] ${broker.name} ERROR:`, errorMsg);

        // Update broker with error
        await supabase
          .from("vl_brokers")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", broker.id);

        results.push({
          broker: broker.name,
          dealsFound: 0,
          dealsSynced: 0,
          dealsFailed: 0,
          error: errorMsg,
        });
      }

      // Rate limit between brokers
      await new Promise((r) => setTimeout(r, 500));
    }

    const duration = Date.now() - startTime;
    const totalSynced = results.reduce((sum, r) => sum + r.dealsSynced, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.dealsFailed, 0);

    console.log(`[CRON SYNC] Complete: ${totalSynced} synced, ${totalFailed} failed, ${duration}ms`);

    return NextResponse.json({
      message: `Cron sync complete`,
      brokers: brokers.length,
      totalDealsSynced: totalSynced,
      totalDealsFailed: totalFailed,
      durationMs: duration,
      results,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
