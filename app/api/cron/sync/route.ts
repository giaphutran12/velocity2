import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { syncDeal, formatError } from "@/lib/sync-deal";
import { VelocityDeal } from "@/lib/transformer";

// Vercel cron security
const CRON_SECRET = process.env.CRON_SECRET;

interface Broker {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
}

interface VelocityResponse {
  pageNumber: number;
  totalPages: number;
  totalDeals: number;
  deals: VelocityDeal[];
}

// Fetch deals for a year from Velocity API
async function fetchDealsForYear(broker: Broker, year: number): Promise<VelocityDeal[]> {
  const allDeals: VelocityDeal[] = [];
  let page = 1;
  let totalPages = 1;

  const startDate = `${year}-01-01`;
  const endDate = year === new Date().getFullYear()
    ? new Date().toISOString().split("T")[0]
    : `${year}-12-31`;

  while (page <= totalPages) {
    const url = `${broker.base_url}/v1/deals?apikey=${broker.api_key}&startdate=${startDate}&enddate=${endDate}&datetype=1&page=${page}`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Velocity API error: ${response.status} - ${text}`);
    }

    const data: VelocityResponse = await response.json();
    allDeals.push(...data.deals);
    totalPages = data.totalPages;
    page++;

    if (page <= totalPages) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allDeals;
}

// Fetch all deals for a broker (loops through years)
async function fetchBrokerDeals(broker: Broker): Promise<VelocityDeal[]> {
  const allDeals: VelocityDeal[] = [];
  const currentYear = new Date().getFullYear();
  const startYear = 2021;

  for (let year = startYear; year <= currentYear; year++) {
    try {
      const yearDeals = await fetchDealsForYear(broker, year);
      allDeals.push(...yearDeals);
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // Continue with other years
    }
  }

  return allDeals;
}

// Main cron handler
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = getSupabase();

  try {
    // Get all active brokers
    const { data: brokers, error: brokersError } = await supabase
      .from("vl_brokers")
      .select("id, name, api_key, base_url")
      .eq("is_active", true);

    if (brokersError) {
      throw new Error(`Failed to fetch brokers: ${formatError(brokersError)}`);
    }

    if (!brokers || brokers.length === 0) {
      return NextResponse.json({
        message: "No active brokers found",
        hint: "Add brokers to vl_brokers table or run migrate-brokers script",
      });
    }

    const results: {
      broker: string;
      dealsFound: number;
      dealsSynced: number;
      dealsFailed: number;
      error?: string;
    }[] = [];

    // Process each broker
    for (const broker of brokers) {
      try {
        // Fetch deals from Velocity
        const deals = await fetchBrokerDeals(broker);

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

        results.push({
          broker: broker.name,
          dealsFound: deals.length,
          dealsSynced: successful,
          dealsFailed: failed,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

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
