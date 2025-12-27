import { notFound, redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import ProposalForm from "./_components/proposal-form";
import Link from "next/link";

interface PageProps {
  params: Promise<{ loanCode: string }>;
}

export default async function DealDetailPage({ params }: PageProps) {
  const { loanCode } = await params;
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Check if user is admin - use admin client to bypass RLS
  const userIsAdmin = await isAdmin(user.email);
  const queryClient = userIsAdmin ? await createAdminClient() : supabase;

  // Fetch deal with borrowers and liabilities (separate from mortgage_request to avoid Cartesian product)
  const { data: deal, error } = await queryClient
    .from("vl_deals")
    .select(
      `
      *,
      borrowers:vl_borrowers(
        *,
        liabilities:vl_borrower_liabilities(*)
      )
    `
    )
    .eq("loan_code", loanCode)
    .single();

  if (error || !deal) {
    notFound();
  }

  // Fetch mortgage request separately to avoid duplicate liabilities
  const { data: mortgageRequestData } = await queryClient
    .from("vl_mortgage_requests")
    .select("*")
    .eq("deal_id", deal.id)
    .single();

  // Get primary borrower (index 0)
  const primaryBorrower = deal.borrowers?.find(
    (b: { borrower_index: number }) => b.borrower_index === 0
  );

  const borrowerName = primaryBorrower
    ? `${primaryBorrower.first_name || ""} ${primaryBorrower.last_name || ""}`.trim()
    : "Client";

  // Flatten all liabilities from all borrowers
  const allLiabilities =
    deal.borrowers?.flatMap(
      (b: {
        liabilities?: Array<{
          id: string;
          lender?: string;
          balance?: number;
          payment?: number;
        }>;
      }) =>
        (b.liabilities || []).map((l) => ({
          id: l.id,
          lender: l.lender || "Unknown",
          balance: l.balance || 0,
          payment: l.payment || 0,
        }))
    ) || [];

  // Get mortgage request data (from separate query)
  const mortgageRequest = mortgageRequestData;
  const initialRate = mortgageRequest?.rate || 4.5;
  const initialTermMonths = mortgageRequest?.term_in_months || 24;
  const initialAmortizationMonths =
    (mortgageRequest?.amortization || 15) * 12 +
    (mortgageRequest?.amortization_months || 0);

  // Calculate initial mortgage amount (total debts + buffer for fees/cash)
  const totalDebts = allLiabilities.reduce(
    (sum: number, l: { balance: number }) => sum + l.balance,
    0
  );
  const initialMortgageAmount = Math.ceil((totalDebts + 30000) / 10000) * 10000; // Round up to nearest 10k

  const dealData = {
    loanCode: deal.loan_code,
    borrowerName,
    liabilities: allLiabilities,
    initialRate,
    initialMortgageAmount,
    initialTermMonths,
    initialAmortizationMonths: initialAmortizationMonths || 180,
    estimatedFees: 13000, // Default fee estimate
  };

  return (
    <div>
      {/* Back navigation */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Link
            href="/deals"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Deals
          </Link>
          <h1 className="text-lg font-semibold mt-1">
            Deal: {deal.loan_code}
          </h1>
        </div>
      </div>

      <ProposalForm deal={dealData} />
    </div>
  );
}
