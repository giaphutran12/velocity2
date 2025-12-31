export interface Liability {
  id: string;
  lender: string;
  balance: number;
  payment: number;
  impacts_credit: boolean;
}

export interface ProposalData {
  borrowerName: string;
  liabilities: Liability[];
  goals: string[];
  currentTotalBalance: number;
  currentTotalPayment: number;
  newMortgageAmount: number;
  newRate: number;
  newMonthlyPayment: number;
  termMonths: number;
  amortizationMonths: number;
  monthlySavings: number;
  cashBack: number;
  fiveYearSavings: number;
  apr: number;
  totalInterest: number;
  estimatedFees: number;
}
