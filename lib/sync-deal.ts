/**
 * Shared deal sync logic used by both /api/sync and /api/cron/sync
 */

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

export interface SyncResult {
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

// Helper to format Supabase errors
export function formatError(
  error: { message?: string; code?: string; details?: string; hint?: string } | null
): string {
  if (!error) return "Unknown error (null)";
  return error.message || error.code || error.details || error.hint || JSON.stringify(error);
}

export async function syncDeal(
  deal: VelocityDeal,
  brokerId: string,
  options?: { trackStats?: boolean }
): Promise<SyncResult> {
  const loanCode = deal.loanCode;
  const supabase = getSupabase();
  const trackStats = options?.trackStats ?? false;

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
    await supabase
      .from("vl_borrowers")
      .delete()
      .eq("deal_id", dealId)
      .gte("borrower_index", deal.borrowers?.length || 0);

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

    await supabase
      .from("vl_notes")
      .delete()
      .eq("deal_id", dealId)
      .gte("note_index", deal.notes?.length || 0);

    const stats = trackStats
      ? { borrowers: 0, addresses: 0, liabilities: 0, assets: 0, properties: 0, conditions: 0, notes: 0 }
      : undefined;

    // 3. Upsert borrowers and their children
    if (deal.borrowers?.length) {
      const borrowerRows = transformBorrowers(dealId, deal.borrowers);
      const { data: borrowerData, error: borrowerError } = await supabase
        .from("vl_borrowers")
        .upsert(borrowerRows, { onConflict: "deal_id,borrower_index" })
        .select("id, borrower_index");

      if (borrowerError) throw new Error(`Borrowers upsert failed: ${formatError(borrowerError)}`);

      if (stats) stats.borrowers = borrowerData.length;

      const borrowerIdMap = new Map<number, string>();
      borrowerData.forEach((b) => borrowerIdMap.set(b.borrower_index, b.id));

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

        const addressRows = transformBorrowerAddresses(borrowerId, borrower);
        if (addressRows.length) {
          const { error } = await supabase.from("vl_borrower_addresses").insert(addressRows);
          if (error) throw new Error(`Addresses insert failed: ${formatError(error)}`);
          if (stats) stats.addresses += addressRows.length;
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
          if (stats) stats.liabilities += liabilityRows.length;
        }

        if (borrower.assets?.length) {
          const assetRows = transformBorrowerAssets(borrowerId, borrower.assets);
          const { error } = await supabase.from("vl_borrower_assets").insert(assetRows);
          if (error) throw new Error(`Assets insert failed: ${formatError(error)}`);
          if (stats) stats.assets += assetRows.length;
        }

        if (borrower.properties?.length) {
          const propertyRows = transformBorrowerProperties(borrowerId, borrower.properties);
          const { error } = await supabase.from("vl_borrower_properties").insert(propertyRows);
          if (error) throw new Error(`Properties insert failed: ${formatError(error)}`);
          if (stats) stats.properties += propertyRows.length;
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
      if (stats) stats.conditions = allConditions.length;
    }

    // 7. Notes (upsert - orphans already deleted above)
    const noteRows = transformNotes(dealId, deal.notes || []);
    if (noteRows.length) {
      const { error } = await supabase
        .from("vl_notes")
        .upsert(noteRows, { onConflict: "deal_id,note_index" });
      if (error) throw new Error(`Notes upsert failed: ${formatError(error)}`);
      if (stats) stats.notes = noteRows.length;
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
