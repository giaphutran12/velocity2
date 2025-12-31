// Types for broker proposal overrides

export interface LiabilityOverride {
  balance?: number;         // undefined = use Velocity value
  payment?: number;         // undefined = use Velocity value
  impacts_credit?: boolean; // undefined = false (broker manually checks)
  excluded?: boolean;       // undefined = false (included)
}

export interface ProposalOverrides {
  mortgage_amount?: number;
  interest_rate?: number;
  term_months?: number;
  amortization_months?: number;
  estimated_fees?: number;
  goals?: string[];  // Personalized financial goals for the borrower
  liabilities: Record<string, LiabilityOverride>;  // keyed by liability UUID
}

// For UI: merged Velocity data + overrides
export interface DisplayLiability {
  id: string;
  lender: string;
  balance: number;
  payment: number;
  impacts_credit: boolean;
  excluded: boolean;
  // Diff tracking
  original_balance: number;
  original_payment: number;
  original_impacts_credit: boolean;
  is_modified: boolean;
}

// Helper to merge Velocity liability with overrides
export function mergeWithOverrides(
  velocityLiabilities: Array<{
    id: string;
    lender: string | null;
    balance: number | null;
    payment: number | null;
  }>,
  overrides: ProposalOverrides | null
): DisplayLiability[] {
  return velocityLiabilities.map((vl) => {
    const override = overrides?.liabilities?.[vl.id];
    const balance = override?.balance ?? vl.balance ?? 0;
    const payment = override?.payment ?? vl.payment ?? 0;
    const impacts_credit = override?.impacts_credit ?? false;
    const excluded = override?.excluded ?? false;

    return {
      id: vl.id,
      lender: vl.lender || "Unknown",
      balance,
      payment,
      impacts_credit,
      excluded,
      original_balance: vl.balance ?? 0,
      original_payment: vl.payment ?? 0,
      original_impacts_credit: false,
      is_modified:
        balance !== (vl.balance ?? 0) ||
        payment !== (vl.payment ?? 0) ||
        (override?.impacts_credit !== undefined),
    };
  });
}
