import { forwardRef } from "react";

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

interface ProposalPrintProps {
  data: ProposalData;
}

const ProposalPrint = forwardRef<HTMLDivElement, ProposalPrintProps>(
  ({ data }, ref) => {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const formatPercent = (rate: number) => {
      return `${rate.toFixed(2)}%`;
    };

    return (
      <div ref={ref} className="print-container">
        <style jsx>{`
          .print-container {
            max-width: 850px;
            margin: 0 auto;
            background: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
              "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
          }

          @media print {
            .print-container {
              max-width: 100%;
              box-shadow: none;
            }

            .hero-section,
            .benefit-card,
            .cta-section,
            .proposed-solution,
            .loan-details,
            .footer,
            .total-row,
            .goals-section,
            .pain-section {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .comparison-row {
              break-inside: avoid;
            }

            .section-title {
              break-after: avoid;
            }

            .debts-page {
              page-break-before: always;
            }

            @page {
              margin-bottom: 60px;
              margin-top: 60px;
            }

            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
            }
          }

          .header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 12px 50px;
          }

          .header-content {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .logo-image {
            height: 40px;
            width: 40px;
            border-radius: 50%;
          }

          .client-name {
            font-size: 16px;
            opacity: 0.9;
          }

          .hero-section {
            background: #f0f7ff;
            padding: 20px 50px;
            text-align: center;
            border-bottom: 3px solid #e3f2fd;
          }

          .hero-title {
            font-size: 24px;
            font-weight: 700;
            color: #1e3c72;
            margin-bottom: 6px;
          }

          .hero-subtitle {
            font-size: 12px;
            color: #546e7a;
            margin-bottom: 12px;
          }

          .goals-section {
            background: white;
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 10px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .goal-item {
            display: flex;
            align-items: center;
            font-size: 9px;
            color: #37474f;
          }

          .goal-item:before {
            content: "✓";
            color: #2e7d32;
            font-weight: 600;
            font-size: 9px;
            margin-right: 4px;
          }

          .benefits-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 10px;
          }

          .benefit-card {
            background: white;
            padding: 12px 10px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            text-align: center;
          }

          .benefit-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #78909c;
            margin-bottom: 4px;
            font-weight: 500;
          }

          .benefit-amount {
            font-size: 18px;
            font-weight: 600;
            color: #2e7d32;
          }

          .benefit-amount.highlight {
            color: #1565c0;
          }

          .benefit-period {
            font-size: 9px;
            color: #78909c;
            margin-top: 2px;
          }

          /* Pain Section - Red (compact) */
          .pain-section {
            background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%);
            padding: 15px 50px;
            border-left: 5px solid #c62828;
            margin: 12px 0;
          }

          .pain-title {
            font-size: 14px;
            font-weight: 600;
            color: #c62828;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .pain-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }

          .pain-stat {
            background: white;
            padding: 12px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(198, 40, 40, 0.15);
          }

          .pain-stat-label {
            font-size: 10px;
            color: #78909c;
            margin-bottom: 4px;
            font-weight: 500;
          }

          .pain-stat-value {
            font-size: 22px;
            font-weight: 700;
            color: #c62828;
          }

          .pain-description {
            font-size: 9px;
            color: #78909c;
            margin-top: 4px;
            line-height: 1.3;
          }

          .section {
            padding: 15px 50px;
          }

          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #1e3c72;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #e3f2fd;
          }

          .proposed-solution {
            background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
            padding: 18px;
            border-radius: 6px;
            margin-top: 10px;
            border-left: 5px solid #2e7d32;
          }

          .solution-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .solution-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
          }

          .solution-label {
            font-size: 10px;
            color: #546e7a;
          }

          .solution-value {
            font-size: 14px;
            font-weight: 600;
            color: #2e7d32;
          }

          .solution-value.large {
            font-size: 18px;
          }

          .loan-details {
            background: #fafafa;
            padding: 12px;
            border-radius: 6px;
            margin-top: 10px;
          }

          .loan-details-title {
            font-size: 11px;
            margin-bottom: 8px;
            color: #1e3c72;
            font-weight: 600;
          }

          .details-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }

          .detail-item {
            text-align: center;
            padding: 6px 4px;
          }

          .detail-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #78909c;
            margin-bottom: 3px;
            font-weight: 500;
          }

          .detail-value {
            font-size: 12px;
            font-weight: 600;
            color: #37474f;
          }

          /* Debts Page */
          .debts-page {
            padding: 40px 50px;
            background: white;
          }

          .credit-warning-explanation {
            background: #fff3e0;
            border-left: 4px solid #f57c00;
            padding: 15px 20px;
            margin-bottom: 25px;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.6;
            color: #5d4037;
          }

          .credit-warning-explanation strong {
            color: #e65100;
          }

          .comparison-header {
            display: grid;
            grid-template-columns: 40px 2fr 1fr 1fr;
            gap: 15px;
            padding: 15px;
            background: #f5f5f5;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #546e7a;
            border-radius: 6px 6px 0 0;
          }

          .comparison-row {
            display: grid;
            grid-template-columns: 40px 2fr 1fr 1fr;
            gap: 15px;
            padding: 18px 15px;
            border-bottom: 1px solid #e0e0e0;
            align-items: center;
          }

          .credit-warning-icon {
            text-align: center;
            font-size: 20px;
          }

          .debt-name {
            font-weight: 500;
            color: #37474f;
          }

          .amount {
            text-align: right;
            font-weight: 600;
            color: #37474f;
          }

          .total-row {
            display: grid;
            grid-template-columns: 40px 2fr 1fr 1fr;
            gap: 15px;
            padding: 20px 15px;
            background: #f5f5f5;
            font-weight: 700;
            font-size: 16px;
            border-radius: 0 0 6px 6px;
          }

          .cta-section {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            padding: 40px 50px;
            text-align: center;
            color: white;
          }

          .cta-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 15px;
          }

          .cta-text {
            font-size: 16px;
            margin-bottom: 25px;
            opacity: 0.9;
          }

          .contact-info {
            font-size: 20px;
            font-weight: 600;
            margin-top: 10px;
          }

          .disclaimer {
            padding: 30px 50px;
            background: #f8f9fa;
            font-size: 11px;
            line-height: 1.6;
            color: #546e7a;
          }

          .disclaimer-title {
            font-weight: 700;
            margin-bottom: 10px;
            font-size: 12px;
            color: #37474f;
          }

          .footer {
            padding: 20px 50px;
            text-align: center;
            font-size: 12px;
            color: #546e7a;
            border-top: 1px solid #e0e0e0;
            background: white;
          }
        `}</style>

        {/* Header */}
        <div className="header">
          <div className="header-content">
            <img src="/BP_Logo.webp" alt="Blue Pearl" className="logo-image" />
            <div className="client-name">
              Mortgage Proposal for {data.borrowerName}
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="hero-section">
          <h1 className="hero-title">
            Save {formatCurrency(data.monthlySavings)} Per Month
          </h1>
          <p className="hero-subtitle">
            Consolidate your debts and unlock cash from your home
          </p>

          {/* Goals Section - inline row */}
          {data.goals.length > 0 && (
            <div className="goals-section">
              {data.goals.map((goal, index) => (
                <div key={index} className="goal-item">
                  {goal}
                </div>
              ))}
            </div>
          )}

          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-label">Monthly Savings</div>
              <div className="benefit-amount">
                {formatCurrency(data.monthlySavings)}
              </div>
              <div className="benefit-period">Every month</div>
            </div>
            <div className="benefit-card">
              <div className="benefit-label">Cash in Hand</div>
              <div className="benefit-amount highlight">
                {formatCurrency(data.cashBack)}
              </div>
              <div className="benefit-period">At closing</div>
            </div>
            <div className="benefit-card">
              <div className="benefit-label">5-Year Savings</div>
              <div className="benefit-amount">
                {formatCurrency(data.fiveYearSavings)}
              </div>
              <div className="benefit-period">Total saved</div>
            </div>
          </div>
        </div>

        {/* Pain Section - Current Financial Burden */}
        <div className="pain-section">
          <div className="pain-title">
            <span>⚠️</span>
            Your Current Financial Burden
          </div>
          <div className="pain-stats">
            <div className="pain-stat">
              <div className="pain-stat-label">Total Debt Obligations</div>
              <div className="pain-stat-value">
                {formatCurrency(data.currentTotalBalance)}
              </div>
              <div className="pain-description">
                Spread across {data.liabilities.length} different creditors
              </div>
            </div>
            <div className="pain-stat">
              <div className="pain-stat-label">Current Monthly Payments</div>
              <div className="pain-stat-value">
                {formatCurrency(data.currentTotalPayment)}
              </div>
              <div className="pain-description">
                Putting strain on your monthly budget
              </div>
            </div>
          </div>
        </div>

        {/* Proposed Solution */}
        <div className="section">
          <h2 className="section-title">
            Your New Consolidated Mortgage - The Solution
          </h2>

          <div className="proposed-solution">
            <div className="solution-grid">
              <div className="solution-item">
                <span className="solution-label">New Mortgage Amount</span>
                <span className="solution-value large">
                  {formatCurrency(data.newMortgageAmount)}
                </span>
              </div>
              <div className="solution-item">
                <span className="solution-label">New Monthly Payment</span>
                <span className="solution-value large">
                  {formatCurrency(data.newMonthlyPayment)}
                </span>
              </div>
              <div className="solution-item">
                <span className="solution-label">Debts Paid Off</span>
                <span className="solution-value">
                  {formatCurrency(data.currentTotalBalance)}
                </span>
              </div>
              <div className="solution-item">
                <span className="solution-label">Cash Advance to You</span>
                <span className="solution-value">
                  {formatCurrency(data.cashBack)}
                </span>
              </div>
            </div>
          </div>

          <div className="loan-details">
            <h3 className="loan-details-title">Loan Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <div className="detail-label">Interest Rate</div>
                <div className="detail-value">
                  {formatPercent(data.newRate)}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Term</div>
                <div className="detail-value">{data.termMonths} Months</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Amortization</div>
                <div className="detail-value">
                  {data.amortizationMonths} Months
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">APR</div>
                <div className="detail-value">{formatPercent(data.apr)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Total Interest</div>
                <div className="detail-value">
                  {formatCurrency(data.totalInterest)}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Estimated Fees</div>
                <div className="detail-value">
                  {formatCurrency(data.estimatedFees)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Debts Page */}
        <div className="debts-page">
          <h2 className="section-title">Current Debts - Detailed Breakdown</h2>

          <div className="credit-warning-explanation">
            <strong>⚠️ Credit Impact Notice:</strong> Debts marked with the
            warning icon are factors that typically impact credit scores. High
            credit card balances (especially near the limit), missed payments,
            and accounts in collections commonly affect credit ratings. By
            consolidating these debts, you can improve your credit utilization
            and payment history over time.
          </div>

          <div className="comparison-header">
            <div style={{ textAlign: "center" }}>⚠️</div>
            <div>Creditor</div>
            <div style={{ textAlign: "right" }}>Balance</div>
            <div style={{ textAlign: "right" }}>Monthly Payment</div>
          </div>

          {data.liabilities.map((liability) => (
            <div key={liability.id} className="comparison-row">
              <div className="credit-warning-icon">
                {liability.impacts_credit ? "⚠️" : ""}
              </div>
              <div className="debt-name">{liability.lender}</div>
              <div className="amount">{formatCurrency(liability.balance)}</div>
              <div className="amount">{formatCurrency(liability.payment)}</div>
            </div>
          ))}

          <div className="total-row">
            <div></div>
            <div>Total Current Obligations</div>
            <div className="amount">
              {formatCurrency(data.currentTotalBalance)}
            </div>
            <div className="amount">
              {formatCurrency(data.currentTotalPayment)}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
          <h2 className="cta-title">Ready to Move Forward?</h2>
          <p className="cta-text">
            Let&apos;s get started on your application today
          </p>
          <div className="contact-info">1.800.288.2764</div>
          <div className="contact-info">info@bluepearlmortgage.ca</div>
        </div>

        {/* Disclaimer */}
        <div className="disclaimer">
          <div className="disclaimer-title">Important Disclosure</div>
          <p>
            Blue Pearl Mortgage Group&apos;s intent is to always provide full
            disclosure of our loan offerings. Borrowers are provided with all
            necessary disclosure prior to entering any obligation. We are not
            affiliated with any financial institutions, which include banks,
            credit unions, alternative and private lenders. The rates and
            scenarios shown on the pages of this sample solution are only
            applicable to loans being processed by Blue Pearl Mortgage Group.
            This example is for informational purposes only; it&apos;s not an
            offer to make a loan or the approval of any loan terms. The payment
            calculations shown here are simply estimates and are based upon the
            unverified information as shared above. Blue Pearl Mortgage Group
            and its representatives have taken reasonable care in providing this
            example but do not guarantee accuracy or completeness. Information
            is provided with no warranty, express or implied, and all such
            warranties are expressly disclaimed. We assume no liability for any
            loss, damage or expense from errors or omissions in these materials,
            whether arising from use or non-use of the information. Blue Pearl
            Mortgage Group is not responsible for any loss, injury, claim,
            liability, or damage related to your use of this proposal or any
            information contained in this document.
          </p>
          <p style={{ marginTop: "10px" }}>
            <strong>Licensing:</strong> British Columbia Brokerage #X300317 •
            Alberta Brokerage #389306 • Saskatchewan Brokerage #316807 • Ontario
            FSCO License #12890
          </p>
        </div>

        {/* Footer */}
        <div className="footer">
          © 2025 Blue Pearl Inc. All rights reserved.
        </div>
      </div>
    );
  }
);

ProposalPrint.displayName = "ProposalPrint";

export default ProposalPrint;
