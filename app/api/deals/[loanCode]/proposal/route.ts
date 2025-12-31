import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { ProposalOverrides } from "@/lib/proposal-types";

interface RouteContext {
  params: Promise<{ loanCode: string }>;
}

/**
 * GET /api/deals/[loanCode]/proposal
 * Returns the proposal_overrides for a deal
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { loanCode } = await context.params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin(user.email);
  const queryClient = userIsAdmin ? await createAdminClient() : supabase;

  // Fetch deal with overrides
  const { data: deal, error } = await queryClient
    .from("vl_deals")
    .select("id, loan_code, proposal_overrides")
    .eq("loan_code", loanCode)
    .single();

  if (error || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  return NextResponse.json({
    deal_id: deal.id,
    loan_code: deal.loan_code,
    proposal_overrides: deal.proposal_overrides as ProposalOverrides | null,
  });
}

/**
 * POST /api/deals/[loanCode]/proposal
 * Saves proposal overrides for a deal
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { loanCode } = await context.params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin(user.email);
  const queryClient = userIsAdmin ? await createAdminClient() : supabase;

  // Parse body
  let overrides: ProposalOverrides;
  try {
    overrides = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate overrides
  const validationError = validateOverrides(overrides);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Update deal with overrides
  const { data: deal, error } = await queryClient
    .from("vl_deals")
    .update({ proposal_overrides: overrides })
    .eq("loan_code", loanCode)
    .select("id, loan_code, proposal_overrides")
    .single();

  if (error) {
    console.error("Failed to save proposal overrides:", error);
    return NextResponse.json(
      { error: "Failed to save proposal overrides" },
      { status: 500 }
    );
  }

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    deal_id: deal.id,
    loan_code: deal.loan_code,
    proposal_overrides: deal.proposal_overrides,
  });
}

function validateOverrides(overrides: ProposalOverrides): string | null {
  // Validate mortgage params
  if (
    overrides.mortgage_amount !== undefined &&
    overrides.mortgage_amount < 0
  ) {
    return "mortgage_amount must be >= 0";
  }
  if (overrides.interest_rate !== undefined && overrides.interest_rate < 0) {
    return "interest_rate must be >= 0";
  }
  if (overrides.term_months !== undefined && overrides.term_months < 1) {
    return "term_months must be >= 1";
  }
  if (
    overrides.amortization_months !== undefined &&
    overrides.amortization_months < 1
  ) {
    return "amortization_months must be >= 1";
  }
  if (
    overrides.term_months !== undefined &&
    overrides.amortization_months !== undefined &&
    overrides.term_months > overrides.amortization_months
  ) {
    return "term_months must be <= amortization_months";
  }
  if (overrides.estimated_fees !== undefined && overrides.estimated_fees < 0) {
    return "estimated_fees must be >= 0";
  }

  // Validate liability overrides
  if (overrides.liabilities) {
    for (const [id, liability] of Object.entries(overrides.liabilities)) {
      if (liability.balance !== undefined && liability.balance < 0) {
        return `Liability ${id}: balance must be >= 0`;
      }
      if (liability.payment !== undefined && liability.payment < 0) {
        return `Liability ${id}: payment must be >= 0`;
      }
    }
  }

  return null;
}
