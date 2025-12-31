"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProposalData } from "@/lib/proposal-pdf-types";

interface ProposalPreviewCardProps {
  data: ProposalData;
}

export function ProposalPreviewCard({ data }: ProposalPreviewCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Proposal Preview</CardTitle>
        <p className="text-sm text-muted-foreground">
          Proposal for {data.borrowerName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Benefits */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-muted-foreground">Monthly Savings</div>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(data.monthlySavings)}
            </div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-muted-foreground">Cash Back</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(data.cashBack)}
            </div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-muted-foreground">5-Year Savings</div>
            <div className="text-xl font-bold text-purple-600">
              {formatCurrency(data.fiveYearSavings)}
            </div>
          </div>
        </div>

        {/* Loan Summary */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">New Mortgage:</span>
            <span className="font-medium">{formatCurrency(data.newMortgageAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">New Payment:</span>
            <span className="font-medium">{formatCurrency(data.newMonthlyPayment)}/mo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate:</span>
            <span className="font-medium">{data.newRate.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Debts Consolidated:</span>
            <span className="font-medium">{data.liabilities.length}</span>
          </div>
        </div>

        {/* Goals */}
        {data.goals.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Goals</div>
            <div className="flex flex-wrap gap-1">
              {data.goals.map((goal, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {goal}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
