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

async function syncDeal(deal: VelocityDeal): Promise<SyncResult> {
  const loanCode = deal.loanCode;
  const supabase = getSupabase();

  try {
    // 1. Upsert deal
    const dealRow = transformDeal(deal);
    const { data: dealData, error: dealError } = await supabase
      .from("vl_deals")
      .upsert(dealRow, { onConflict: "loan_code" })
      .select("id")
      .single();

    if (dealError) throw new Error(`Deal upsert failed: ${formatError(dealError)}`);
    const dealId = dealData.id;

    // 2. Delete existing child records (cascade will handle nested)
    await supabase.from("vl_borrowers").delete().eq("deal_id", dealId);
    await supabase.from("vl_subject_properties").delete().eq("deal_id", dealId);
    await supabase.from("vl_mortgage_requests").delete().eq("deal_id", dealId);
    await supabase.from("vl_conditions").delete().eq("deal_id", dealId);
    await supabase.from("vl_notes").delete().eq("deal_id", dealId);

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

    // 4. Insert subject property
    const subjectPropertyRow = transformSubjectProperty(
      dealId,
      deal.subjectProperty
    );
    if (subjectPropertyRow) {
      const { error } = await supabase
        .from("vl_subject_properties")
        .insert(subjectPropertyRow);
      if (error)
        throw new Error(`Subject property insert failed: ${formatError(error)}`);
    }

    // 5. Insert mortgage request and mortgages
    const mortgageRequestRow = transformMortgageRequest(
      dealId,
      deal.mortgageRequest
    );
    if (mortgageRequestRow) {
      const { data: mrData, error: mrError } = await supabase
        .from("vl_mortgage_requests")
        .insert(mortgageRequestRow)
        .select("id")
        .single();

      if (mrError)
        throw new Error(`Mortgage request insert failed: ${formatError(mrError)}`);

      // Insert mortgages
      if (deal.mortgageRequest?.mortgages?.length) {
        const mortgageRows = transformMortgages(
          mrData.id,
          deal.mortgageRequest.mortgages
        );
        const { error } = await supabase
          .from("vl_mortgages")
          .insert(mortgageRows);
        if (error)
          throw new Error(`Mortgages insert failed: ${formatError(error)}`);
      }
    }

    // 6. Insert conditions (broker + lender)
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
        .insert(allConditions);
      if (error)
        throw new Error(`Conditions insert failed: ${formatError(error)}`);
      stats.conditions = allConditions.length;
    }

    // 7. Insert notes
    const noteRows = transformNotes(dealId, deal.notes || []);
    if (noteRows.length) {
      const { error } = await supabase.from("vl_notes").insert(noteRows);
      if (error) throw new Error(`Notes insert failed: ${formatError(error)}`);
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
  try {
    const body = await request.json();

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
        { error: "Invalid request body. Expected deals array or single deal." },
        { status: 400 }
      );
    }

    // Sync all deals
    const results = await Promise.all(deals.map(syncDeal));

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

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "POST Velocity deal data to this endpoint to sync to Supabase",
    example: "POST with Velocity API response body: { deals: [...] }",
  });
}
