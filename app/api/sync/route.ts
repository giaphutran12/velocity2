import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * /api/sync - Syncs Velocity deal data to Supabase
 *
 * Auth: Requires Bearer token in Authorization header (uses CRON_SECRET)
 * Usage: curl -X POST -H "Authorization: Bearer $CRON_SECRET" -d '{"deals":[...]}' https://yoursite.com/api/sync
 */
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

interface SyncResult {
  loanCode: string;
  success: boolean;
  error?: string;
  stats?: {
    borrowers: number;
    addresses: number;
    liabilities: number;
    assets: number;
    properties: number;
    conditions: number;
    notes: number;
  };
}

// Helper to format Supabase errors (handles undefined message)
function formatError(error: { message?: string; code?: string; details?: string; hint?: string } | null): string {
  if (!error) return "Unknown error (null)";
  return error.message || error.code || error.details || error.hint || JSON.stringify(error);
}

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

    const stats = {
      borrowers: 0,
      addresses: 0,
      liabilities: 0,
      assets: 0,
      properties: 0,
      conditions: 0,
      notes: 0,
    };

    // 3. Upsert borrowers and their children (handles re-sync of partially failed deals)
    if (deal.borrowers?.length) {
      const borrowerRows = transformBorrowers(dealId, deal.borrowers);
      const { data: borrowerData, error: borrowerError } = await supabase
        .from("vl_borrowers")
        .upsert(borrowerRows, { onConflict: "deal_id,borrower_index" })
        .select("id, borrower_index");

      if (borrowerError)
        throw new Error(`Borrowers upsert failed: ${formatError(borrowerError)}`);

      stats.borrowers = borrowerData.length;

      // Map borrower_index to id
      const borrowerIdMap = new Map<number, string>();
      borrowerData.forEach((b) => borrowerIdMap.set(b.borrower_index, b.id));

      // Insert borrower children
      for (let i = 0; i < deal.borrowers.length; i++) {
        const borrower = deal.borrowers[i];
        const borrowerId = borrowerIdMap.get(i);
        if (!borrowerId) continue;

        // Delete existing child records FIRST to prevent duplicates on re-sync
        await supabase.from("vl_borrower_addresses").delete().eq("borrower_id", borrowerId);
        await supabase.from("vl_borrower_employment").delete().eq("borrower_id", borrowerId);
        await supabase.from("vl_borrower_liabilities").delete().eq("borrower_id", borrowerId);
        await supabase.from("vl_borrower_assets").delete().eq("borrower_id", borrowerId);
        await supabase.from("vl_borrower_properties").delete().eq("borrower_id", borrowerId);

        // Addresses
        const addressRows = transformBorrowerAddresses(borrowerId, borrower);
        if (addressRows.length) {
          const { error } = await supabase
            .from("vl_borrower_addresses")
            .insert(addressRows);
          if (error)
            throw new Error(`Addresses insert failed: ${formatError(error)}`);
          stats.addresses += addressRows.length;
        }

        // Employment
        const employmentRow = transformBorrowerEmployment(
          borrowerId,
          borrower.employmentHistory
        );
        if (employmentRow) {
          const { error } = await supabase
            .from("vl_borrower_employment")
            .insert(employmentRow);
          if (error)
            throw new Error(`Employment insert failed: ${formatError(error)}`);
        }

        // Liabilities
        if (borrower.liabilities?.length) {
          const liabilityRows = transformBorrowerLiabilities(
            borrowerId,
            borrower.liabilities
          );
          const { error } = await supabase
            .from("vl_borrower_liabilities")
            .insert(liabilityRows);
          if (error)
            throw new Error(`Liabilities insert failed: ${formatError(error)}`);
          stats.liabilities += liabilityRows.length;
        }

        // Assets
        if (borrower.assets?.length) {
          const assetRows = transformBorrowerAssets(borrowerId, borrower.assets);
          const { error } = await supabase
            .from("vl_borrower_assets")
            .insert(assetRows);
          if (error) throw new Error(`Assets insert failed: ${formatError(error)}`);
          stats.assets += assetRows.length;
        }

        // Properties
        if (borrower.properties?.length) {
          const propertyRows = transformBorrowerProperties(
            borrowerId,
            borrower.properties
          );
          const { error } = await supabase
            .from("vl_borrower_properties")
            .insert(propertyRows);
          if (error)
            throw new Error(`Properties insert failed: ${formatError(error)}`);
          stats.properties += propertyRows.length;
        }
      }
    }

    // 4. Subject property (upsert - 1:1 with deal)
    const subjectPropertyRow = transformSubjectProperty(
      dealId,
      deal.subjectProperty
    );
    if (subjectPropertyRow) {
      const { error } = await supabase
        .from("vl_subject_properties")
        .upsert(subjectPropertyRow, { onConflict: "deal_id" });
      if (error)
        throw new Error(`Subject property upsert failed: ${formatError(error)}`);
    }

    // 5. Mortgage request and mortgages (upsert - 1:1 with deal)
    const mortgageRequestRow = transformMortgageRequest(
      dealId,
      deal.mortgageRequest
    );
    if (mortgageRequestRow) {
      const { data: mrData, error: mrError } = await supabase
        .from("vl_mortgage_requests")
        .upsert(mortgageRequestRow, { onConflict: "deal_id" })
        .select("id")
        .single();

      if (mrError)
        throw new Error(`Mortgage request upsert failed: ${formatError(mrError)}`);

      // Delete orphan mortgages, then upsert
      const mortgagesCount = deal.mortgageRequest?.mortgages?.length || 0;
      await supabase
        .from("vl_mortgages")
        .delete()
        .eq("mortgage_request_id", mrData.id)
        .gte("mortgage_index", mortgagesCount);

      if (deal.mortgageRequest?.mortgages?.length) {
        const mortgageRows = transformMortgages(
          mrData.id,
          deal.mortgageRequest.mortgages
        );
        const { error } = await supabase
          .from("vl_mortgages")
          .upsert(mortgageRows, { onConflict: "mortgage_request_id,mortgage_index" });
        if (error)
          throw new Error(`Mortgages upsert failed: ${formatError(error)}`);
      }
    }

    // 6. Conditions (upsert - orphans already deleted above)
    const brokerConditions = transformConditions(
      dealId,
      deal.conditions || [],
      "broker"
    );
    const lenderConditions = transformConditions(
      dealId,
      deal.lenderConditions || [],
      "lender"
    );
    const allConditions = [...brokerConditions, ...lenderConditions];

    if (allConditions.length) {
      const { error } = await supabase
        .from("vl_conditions")
        .upsert(allConditions, { onConflict: "deal_id,condition_type,condition_index" });
      if (error)
        throw new Error(`Conditions upsert failed: ${formatError(error)}`);
      stats.conditions = allConditions.length;
    }

    // 7. Notes (upsert - orphans already deleted above)
    const noteRows = transformNotes(dealId, deal.notes || []);
    if (noteRows.length) {
      const { error } = await supabase
        .from("vl_notes")
        .upsert(noteRows, { onConflict: "deal_id,note_index" });
      if (error) throw new Error(`Notes upsert failed: ${formatError(error)}`);
      stats.notes = noteRows.length;
    }

    return { loanCode, success: true, stats };
  } catch (error) {
    return {
      loanCode,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

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

    // Sync all deals with broker_id
    const results = await Promise.all(deals.map((deal) => syncDeal(deal, brokerId)));

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
