import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  transformDeal,
  transformBorrowers,
  transformBorrowerAddresses,
  transformBorrowerEmployment,
  transformBorrowerLiabilities,
  transformBorrowerAssets,
  transformBorrowerProperties,
  transformSubjectProperty,
  transformMortgageRequest,
  transformMortgages,
  transformConditions,
  transformNotes,
  VelocityDeal,
} from "@/lib/transformer";

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

interface SyncResult {
  loanCode: string;
  success: boolean;
  error?: string;
}

// Helper to format errors
function formatError(error: { message?: string; code?: string; details?: string } | null): string {
  if (!error) return "Unknown error";
  return error.message || error.code || error.details || JSON.stringify(error);
}

// Sync a single deal (reused from /api/sync)
async function syncDeal(deal: VelocityDeal, brokerId: string): Promise<SyncResult> {
  const loanCode = deal.loanCode;
  const supabase = getSupabase();

  try {
    // 1. Upsert deal with broker_id
    const dealRow = { ...transformDeal(deal), broker_id: brokerId };
    const { data: dealData, error: dealError } = await supabase
      .from("vl_deals")
      .upsert(dealRow, { onConflict: "loan_code" })
      .select("id")
      .single();

    if (dealError) throw new Error(`Deal upsert failed: ${formatError(dealError)}`);
    const dealId = dealData.id;

    // 2. Delete orphaned children (only those that no longer exist in Velocity)
    // Borrowers: delete where index >= current count
    await supabase
      .from("vl_borrowers")
      .delete()
      .eq("deal_id", dealId)
      .gte("borrower_index", deal.borrowers?.length || 0);

    // Conditions: delete orphans then upsert
    const brokerConditionsCount = deal.conditions?.length || 0;
    const lenderConditionsCount = deal.lenderConditions?.length || 0;
    await supabase
      .from("vl_conditions")
      .delete()
      .eq("deal_id", dealId)
      .eq("condition_type", "broker")
      .gte("condition_index", brokerConditionsCount);
    await supabase
      .from("vl_conditions")
      .delete()
      .eq("deal_id", dealId)
      .eq("condition_type", "lender")
      .gte("condition_index", lenderConditionsCount);

    // Notes: delete orphans then upsert
    await supabase
      .from("vl_notes")
      .delete()
      .eq("deal_id", dealId)
      .gte("note_index", deal.notes?.length || 0);

    // 3. Upsert borrowers and children
    if (deal.borrowers?.length) {
      const borrowerRows = transformBorrowers(dealId, deal.borrowers);
      const { data: borrowerData, error: borrowerError } = await supabase
        .from("vl_borrowers")
        .upsert(borrowerRows, { onConflict: "deal_id,borrower_index" })
        .select("id, borrower_index");

      if (borrowerError) throw new Error(`Borrowers upsert failed: ${formatError(borrowerError)}`);

      const borrowerIdMap = new Map<number, string>();
      borrowerData.forEach((b) => borrowerIdMap.set(b.borrower_index, b.id));

      for (let i = 0; i < deal.borrowers.length; i++) {
        const borrower = deal.borrowers[i];
        const borrowerId = borrowerIdMap.get(i);
        if (!borrowerId) continue;

        const addressRows = transformBorrowerAddresses(borrowerId, borrower);
        if (addressRows.length) {
          const { error } = await supabase.from("vl_borrower_addresses").insert(addressRows);
          if (error) throw new Error(`Addresses insert failed: ${formatError(error)}`);
        }

        const employmentRow = transformBorrowerEmployment(borrowerId, borrower.employmentHistory);
        if (employmentRow) {
          const { error } = await supabase.from("vl_borrower_employment").insert(employmentRow);
          if (error) throw new Error(`Employment insert failed: ${formatError(error)}`);
        }

        if (borrower.liabilities?.length) {
          const liabilityRows = transformBorrowerLiabilities(borrowerId, borrower.liabilities);
          const { error } = await supabase.from("vl_borrower_liabilities").insert(liabilityRows);
          if (error) throw new Error(`Liabilities insert failed: ${formatError(error)}`);
        }

        if (borrower.assets?.length) {
          const assetRows = transformBorrowerAssets(borrowerId, borrower.assets);
          const { error } = await supabase.from("vl_borrower_assets").insert(assetRows);
          if (error) throw new Error(`Assets insert failed: ${formatError(error)}`);
        }

        if (borrower.properties?.length) {
          const propertyRows = transformBorrowerProperties(borrowerId, borrower.properties);
          const { error } = await supabase.from("vl_borrower_properties").insert(propertyRows);
          if (error) throw new Error(`Properties insert failed: ${formatError(error)}`);
        }
      }
    }

    // 4. Subject property (upsert - 1:1 with deal)
    const subjectPropertyRow = transformSubjectProperty(dealId, deal.subjectProperty);
    if (subjectPropertyRow) {
      const { error } = await supabase
        .from("vl_subject_properties")
        .upsert(subjectPropertyRow, { onConflict: "deal_id" });
      if (error) throw new Error(`Subject property upsert failed: ${formatError(error)}`);
    }

    // 5. Mortgage request and mortgages (upsert - 1:1 with deal)
    const mortgageRequestRow = transformMortgageRequest(dealId, deal.mortgageRequest);
    if (mortgageRequestRow) {
      const { data: mrData, error: mrError } = await supabase
        .from("vl_mortgage_requests")
        .upsert(mortgageRequestRow, { onConflict: "deal_id" })
        .select("id")
        .single();

      if (mrError) throw new Error(`Mortgage request upsert failed: ${formatError(mrError)}`);

      // Delete orphan mortgages, then upsert
      const mortgagesCount = deal.mortgageRequest?.mortgages?.length || 0;
      await supabase
        .from("vl_mortgages")
        .delete()
        .eq("mortgage_request_id", mrData.id)
        .gte("mortgage_index", mortgagesCount);

      if (deal.mortgageRequest?.mortgages?.length) {
        const mortgageRows = transformMortgages(mrData.id, deal.mortgageRequest.mortgages);
        const { error } = await supabase
          .from("vl_mortgages")
          .upsert(mortgageRows, { onConflict: "mortgage_request_id,mortgage_index" });
        if (error) throw new Error(`Mortgages upsert failed: ${formatError(error)}`);
      }
    }

    // 6. Conditions (upsert - orphans already deleted above)
    const brokerConditions = transformConditions(dealId, deal.conditions || [], "broker");
    const lenderConditions = transformConditions(dealId, deal.lenderConditions || [], "lender");
    const allConditions = [...brokerConditions, ...lenderConditions];

    if (allConditions.length) {
      const { error } = await supabase
        .from("vl_conditions")
        .upsert(allConditions, { onConflict: "deal_id,condition_type,condition_index" });
      if (error) throw new Error(`Conditions upsert failed: ${formatError(error)}`);
    }

    // 7. Notes (upsert - orphans already deleted above)
    const noteRows = transformNotes(dealId, deal.notes || []);
    if (noteRows.length) {
      const { error } = await supabase
        .from("vl_notes")
        .upsert(noteRows, { onConflict: "deal_id,note_index" });
      if (error) throw new Error(`Notes upsert failed: ${formatError(error)}`);
    }

    return { loanCode, success: true };
  } catch (error) {
    return {
      loanCode,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
