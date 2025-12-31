"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ProposalPDFDownload } from "./proposal-pdf-download";
import { ProposalPreviewCard } from "./proposal-preview-card";
import { ProposalData, Liability } from "@/lib/proposal-pdf-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ProposalOverrides,
  LiabilityOverride,
  DisplayLiability,
  mergeWithOverrides,
} from "@/lib/proposal-types";

// Velocity liability with in_credit_bureau
interface VelocityLiability {
  id: string;
  lender: string;
  balance: number;
  payment: number;
  in_credit_bureau: boolean;
}

interface DealData {
  loanCode: string;
  borrowerName: string;
  liabilities: VelocityLiability[];
  initialRate: number;
  initialMortgageAmount: number;
  initialTermMonths: number;
  initialAmortizationMonths: number;
  estimatedFees: number;
  proposalOverrides: ProposalOverrides | null;
}

interface ProposalFormProps {
  deal: DealData;
}

export default function ProposalForm({ deal }: ProposalFormProps) {
  // Mortgage params state (initialized from overrides or defaults)
  const [rate, setRate] = useState(
    deal.proposalOverrides?.interest_rate ?? deal.initialRate
  );
  const [mortgageAmount, setMortgageAmount] = useState(
    deal.proposalOverrides?.mortgage_amount ?? deal.initialMortgageAmount
  );
  const [termMonths, setTermMonths] = useState(
    deal.proposalOverrides?.term_months ?? deal.initialTermMonths
  );
  const [amortizationMonths, setAmortizationMonths] = useState(
    deal.proposalOverrides?.amortization_months ?? deal.initialAmortizationMonths
  );
  const [estimatedFees, setEstimatedFees] = useState(
    deal.proposalOverrides?.estimated_fees ?? deal.estimatedFees
  );

  // Goals state (personalized financial goals for the borrower)
  // Default goals help brokers get started quickly
  const defaultGoals = [
    "Lower payments",
    "Consolidate debt",
    "Simplify finances",
  ];
  const initialGoals = deal.proposalOverrides?.goals ?? defaultGoals;
  const [goals, setGoals] = useState<string[]>(initialGoals);
  const [newGoal, setNewGoal] = useState("");

  const addGoal = () => {
    if (newGoal.trim()) {
      setGoals((prev) => [...prev, newGoal.trim()]);
      setNewGoal("");
    }
  };

  const removeGoal = (index: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  };

  // Merge Velocity liabilities with saved overrides
  const initialDisplayLiabilities = mergeWithOverrides(
    deal.liabilities.map((l) => ({
      id: l.id,
      lender: l.lender,
      balance: l.balance,
      payment: l.payment,
      in_credit_bureau: l.in_credit_bureau,
    })),
    deal.proposalOverrides
  );

  // Editable liability state
  const [displayLiabilities, setDisplayLiabilities] = useState<DisplayLiability[]>(
    initialDisplayLiabilities
  );

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Update a single liability field
  const updateLiability = (id: string, field: keyof DisplayLiability, value: number | boolean) => {
    setDisplayLiabilities((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Recalculate is_modified
        updated.is_modified =
          updated.balance !== l.original_balance ||
          updated.payment !== l.original_payment ||
          updated.impacts_credit !== l.original_impacts_credit;
        return updated;
      })
    );
  };

  // Build ProposalOverrides from current state
  const buildOverrides = (): ProposalOverrides => {
    const liabilities: Record<string, LiabilityOverride> = {};

    for (const dl of displayLiabilities) {
      const orig = deal.liabilities.find((l) => l.id === dl.id);
      if (!orig) continue;

      const override: LiabilityOverride = {};

      // Only include fields that differ from original
      if (dl.balance !== orig.balance) override.balance = dl.balance;
      if (dl.payment !== orig.payment) override.payment = dl.payment;
      if (dl.impacts_credit !== orig.in_credit_bureau) override.impacts_credit = dl.impacts_credit;
      if (dl.excluded) override.excluded = true;

      // Only add if there are actual overrides
      if (Object.keys(override).length > 0) {
        liabilities[dl.id] = override;
      }
    }

    return {
      mortgage_amount: mortgageAmount !== deal.initialMortgageAmount ? mortgageAmount : undefined,
      interest_rate: rate !== deal.initialRate ? rate : undefined,
      term_months: termMonths !== deal.initialTermMonths ? termMonths : undefined,
      amortization_months:
        amortizationMonths !== deal.initialAmortizationMonths ? amortizationMonths : undefined,
      estimated_fees: estimatedFees !== deal.estimatedFees ? estimatedFees : undefined,
      goals, // Always save goals (even empty array) to prevent reverting to defaults
      liabilities,
    };
  };

  // Save overrides to API
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const overrides = buildOverrides();
      const res = await fetch(`/api/deals/${deal.loanCode}/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Changes saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter active liabilities (not excluded)
  const activeLiabilities = displayLiabilities.filter((l) => !l.excluded);

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
  const cashBack = mortgageAmount - currentTotalBalance - estimatedFees;
  const fiveYearSavings = monthlySavings * 60;
  const totalInterest = newMonthlyPayment * amortizationMonths - mortgageAmount;

  // Simple APR calculation (rate + fees annualized)
  const apr = rate + (estimatedFees / mortgageAmount) * (12 / termMonths) * 100;

  // Convert DisplayLiability[] to Liability[] for PDF/Print
  const proposalLiabilities: Liability[] = activeLiabilities.map((l) => ({
    id: l.id,
    lender: l.lender,
    balance: l.balance,
    payment: l.payment,
    impacts_credit: l.impacts_credit,
  }));

  const proposalData: ProposalData = {
    borrowerName: deal.borrowerName,
    liabilities: proposalLiabilities,
    goals,
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
    estimatedFees,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Check if there are unsaved changes
  const hasChanges = () => {
    const overrides = buildOverrides();
    // Check if goals changed from initial state
    const goalsChanged =
      goals.length !== initialGoals.length ||
      goals.some((g, i) => g !== initialGoals[i]);

    return (
      overrides.mortgage_amount !== undefined ||
      overrides.interest_rate !== undefined ||
      overrides.term_months !== undefined ||
      overrides.amortization_months !== undefined ||
      overrides.estimated_fees !== undefined ||
      goalsChanged ||
      Object.keys(overrides.liabilities).length > 0
    );
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || !hasChanges()}
              >
                {isSaving ? "Saving..." : "Apply Changes"}
              </Button>
              <ProposalPDFDownload data={proposalData} loanCode={deal.loanCode} />
            </div>
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

      {/* Goals Section */}
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Financial Goals</h3>
              <span className="text-xs text-muted-foreground">
                Personalized goals shown on the proposal
              </span>
            </div>

            {/* Existing Goals */}
            <div className="space-y-2 mb-3">
              {goals.map((goal, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md"
                >
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="flex-1 text-sm">{goal}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGoal(index)}
                    className="h-6 px-2 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </Button>
                </div>
              ))}
              {goals.length === 0 && (
                <p className="text-sm text-muted-foreground italic px-3">
                  No goals added yet. Add goals to personalize the proposal.
                </p>
              )}
            </div>

            {/* Add New Goal */}
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Access $15,000 cash for home renovations"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                className="flex-1"
              />
              <Button variant="outline" onClick={addGoal} disabled={!newGoal.trim()}>
                Add Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debt Management Table */}
      <div className="max-w-4xl mx-auto pt-6 px-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Manage Debts</h3>
              <span className="text-xs text-muted-foreground">
                Edit values, toggle credit impact, or exclude items
              </span>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[40px_1fr_120px_120px_60px] gap-2 px-3 py-2 bg-muted/50 rounded-t-md text-xs font-medium text-muted-foreground">
              <div className="text-center">Incl.</div>
              <div>Lender</div>
              <div className="text-right">Balance</div>
              <div className="text-right">Payment</div>
              <div className="text-center">Credit</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y">
              {displayLiabilities.map((liability) => {
                const isExcluded = liability.excluded;
                const balanceChanged = liability.balance !== liability.original_balance;
                const paymentChanged = liability.payment !== liability.original_payment;

                return (
                  <div
                    key={liability.id}
                    className={`grid grid-cols-[40px_1fr_120px_120px_60px] gap-2 px-3 py-2 items-center ${
                      isExcluded ? "opacity-50 bg-muted/30" : ""
                    }`}
                  >
                    {/* Include Checkbox */}
                    <div className="flex justify-center">
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={(checked) =>
                          updateLiability(liability.id, "excluded", !checked)
                        }
                      />
                    </div>

                    {/* Lender Name */}
                    <div className={`text-sm ${isExcluded ? "line-through" : ""}`}>
                      {liability.lender}
                    </div>

                    {/* Balance Input */}
                    <div className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={liability.balance}
                        onChange={(e) =>
                          updateLiability(liability.id, "balance", parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-right text-sm h-8"
                        disabled={isExcluded}
                      />
                      {balanceChanged && !isExcluded && (
                        <span className="text-xs text-muted-foreground">
                          (was {formatCurrency(liability.original_balance)})
                        </span>
                      )}
                    </div>

                    {/* Payment Input */}
                    <div className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={liability.payment}
                        onChange={(e) =>
                          updateLiability(liability.id, "payment", parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-right text-sm h-8"
                        disabled={isExcluded}
                      />
                      {paymentChanged && !isExcluded && (
                        <span className="text-xs text-muted-foreground">
                          (was {formatCurrency(liability.original_payment)})
                        </span>
                      )}
                    </div>

                    {/* Impacts Credit Checkbox */}
                    <div className="flex justify-center">
                      <Checkbox
                        checked={liability.impacts_credit}
                        onCheckedChange={(checked) =>
                          updateLiability(liability.id, "impacts_credit", !!checked)
                        }
                        disabled={isExcluded}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-[40px_1fr_120px_120px_60px] gap-2 px-3 py-3 bg-muted/50 rounded-b-md text-sm font-medium">
              <div></div>
              <div>Total ({activeLiabilities.length} items)</div>
              <div className="text-right">{formatCurrency(currentTotalBalance)}</div>
              <div className="text-right">{formatCurrency(currentTotalPayment)}/mo</div>
              <div></div>
            </div>

            {displayLiabilities.some((l) => l.excluded) && (
              <p className="text-xs text-muted-foreground mt-3">
                {displayLiabilities.filter((l) => l.excluded).length} item
                {displayLiabilities.filter((l) => l.excluded).length > 1 ? "s" : ""} excluded from
                proposal
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <ProposalPreviewCard data={proposalData} />
      </div>
    </div>
  );
}
