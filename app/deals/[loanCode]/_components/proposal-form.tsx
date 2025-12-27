"use client";

import { useState, useCallback } from "react";
import ProposalPrint, { Liability, ProposalData } from "./proposal-print";
import { ProposalPDFDownload } from "./proposal-pdf-download";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface DealData {
  loanCode: string;
  borrowerName: string;
  liabilities: Liability[];
  initialRate: number;
  initialMortgageAmount: number;
  initialTermMonths: number;
  initialAmortizationMonths: number;
  estimatedFees: number;
}

interface ProposalFormProps {
  deal: DealData;
}

export default function ProposalForm({ deal }: ProposalFormProps) {
  // Editable state
  const [rate, setRate] = useState(deal.initialRate);
  const [mortgageAmount, setMortgageAmount] = useState(deal.initialMortgageAmount);
  const [termMonths, setTermMonths] = useState(deal.initialTermMonths);
  const [amortizationMonths, setAmortizationMonths] = useState(deal.initialAmortizationMonths);

  // Track excluded liabilities
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const toggleLiability = (id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter active liabilities
  const activeLiabilities = deal.liabilities.filter(l => !excludedIds.has(l.id));

  // Calculate totals from active liabilities only
  const currentTotalBalance = activeLiabilities.reduce((sum, l) => sum + l.balance, 0);
  const currentTotalPayment = activeLiabilities.reduce((sum, l) => sum + l.payment, 0);

  // Calculate new monthly payment: P * (r * (1+r)^n) / ((1+r)^n - 1)
  const calculateMonthlyPayment = useCallback(
    (principal: number, annualRate: number, months: number) => {
      if (annualRate === 0) return principal / months;
      const monthlyRate = annualRate / 100 / 12;
      const factor = Math.pow(1 + monthlyRate, months);
      return (principal * monthlyRate * factor) / (factor - 1);
    },
    []
  );

  const newMonthlyPayment = calculateMonthlyPayment(mortgageAmount, rate, amortizationMonths);
  const monthlySavings = currentTotalPayment - newMonthlyPayment;
  const cashBack = mortgageAmount - currentTotalBalance - deal.estimatedFees;
  const fiveYearSavings = monthlySavings * 60;
  const totalInterest = newMonthlyPayment * amortizationMonths - mortgageAmount;

  // Simple APR calculation (rate + fees annualized)
  const apr = rate + (deal.estimatedFees / mortgageAmount) * (12 / termMonths) * 100;

  const proposalData: ProposalData = {
    borrowerName: deal.borrowerName,
    liabilities: activeLiabilities,
    currentTotalBalance,
    currentTotalPayment,
    newMortgageAmount: mortgageAmount,
    newRate: rate,
    newMonthlyPayment,
    termMonths,
    amortizationMonths,
    monthlySavings: Math.max(0, monthlySavings),
    cashBack: Math.max(0, cashBack),
    fiveYearSavings: Math.max(0, fiveYearSavings),
    apr,
    totalInterest: Math.max(0, totalInterest),
    estimatedFees: deal.estimatedFees,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Controls Panel */}
      <Card className="sticky top-0 z-10 rounded-none border-x-0 border-t-0 shadow-sm">
        <CardContent className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor="rate" className="text-xs text-muted-foreground">
                  Interest Rate (%)
                </Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mortgageAmount" className="text-xs text-muted-foreground">
                  Mortgage Amount
                </Label>
                <Input
                  id="mortgageAmount"
                  type="number"
                  step="1000"
                  min="0"
                  value={mortgageAmount}
                  onChange={(e) => setMortgageAmount(parseFloat(e.target.value) || 0)}
                  className="w-36"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="termMonths" className="text-xs text-muted-foreground">
                  Term (months)
                </Label>
                <Input
                  id="termMonths"
                  type="number"
                  step="1"
                  min="6"
                  max="120"
                  value={termMonths}
                  onChange={(e) => setTermMonths(parseInt(e.target.value) || 12)}
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="amortizationMonths" className="text-xs text-muted-foreground">
                  Amortization (months)
                </Label>
                <Input
                  id="amortizationMonths"
                  type="number"
                  step="12"
                  min="12"
                  max="360"
                  value={amortizationMonths}
                  onChange={(e) => setAmortizationMonths(parseInt(e.target.value) || 180)}
                  className="w-24"
                />
              </div>
            </div>
            <ProposalPDFDownload data={proposalData} loanCode={deal.loanCode} />
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 mt-4 text-sm">
            <div>
              <span className="text-muted-foreground">New Payment:</span>{" "}
              <span className="font-semibold">{formatCurrency(newMonthlyPayment)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly Savings:</span>{" "}
              <span className="font-semibold text-green-600">
                {formatCurrency(Math.max(0, monthlySavings))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Cash Back:</span>{" "}
              <span className="font-semibold text-blue-600">
                {formatCurrency(Math.max(0, cashBack))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debt Management */}
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Manage Debts</h3>
              <span className="text-xs text-muted-foreground">
                Click to exclude non-debts (phone bills, etc.)
              </span>
            </div>
            <div className="space-y-1">
              {deal.liabilities.map((liability) => {
                const isExcluded = excludedIds.has(liability.id);
                return (
                  <button
                    key={liability.id}
                    onClick={() => toggleLiability(liability.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      isExcluded
                        ? "bg-gray-100 text-gray-400 line-through"
                        : "bg-white hover:bg-gray-50 border"
                    }`}
                  >
                    <span>{liability.lender}</span>
                    <div className="flex items-center gap-4">
                      <span>{formatCurrency(liability.balance)}</span>
                      <span className="text-muted-foreground w-20 text-right">
                        {formatCurrency(liability.payment)}/mo
                      </span>
                      {isExcluded ? (
                        <span className="text-xs text-blue-600 w-16">+ Restore</span>
                      ) : (
                        <span className="text-xs text-red-500 w-16">× Remove</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {excludedIds.size > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {excludedIds.size} item{excludedIds.size > 1 ? "s" : ""} excluded from proposal
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <Card className="overflow-hidden">
          <ProposalPrint data={proposalData} />
        </Card>
      </div>
    </div>
  );
}
