import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { ProposalData } from "@/lib/proposal-pdf-types";

Font.register({ family: "OpenSans", fonts: [300, 400, 500, 600, 700].map((w) => ({ src: `https://cdn.jsdelivr.net/npm/@fontsource/open-sans/files/open-sans-latin-${w}-normal.woff`, fontWeight: w })) });

const styles = StyleSheet.create({
  page: {
    fontFamily: "OpenSans",
    fontSize: 10,
    fontWeight: 300,
    color: "#2c3e50",
  },
  // Header - only on page 1 (compact)
  header: {
    backgroundColor: "#1e3c72",
    padding: "12px 50px",
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  logoImage: {
    height: 40,
    width: 40,
    borderRadius: 20,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 400,
    color: "white",
  },
  // Hero Section (compact)
  heroSection: {
    backgroundColor: "#f0f7ff",
    padding: "20px 50px",
    textAlign: "center",
    borderBottom: "3px solid #e3f2fd",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: "#1e3c72",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#546e7a",
    marginBottom: 12,
  },
  // Goals Section (compact inline row)
  goalsSection: {
    backgroundColor: "white",
    padding: "8px 12px",
    borderRadius: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  goalItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  goalCheckmark: {
    color: "#2e7d32",
    fontWeight: 600,
    fontSize: 9,
    marginRight: 4,
  },
  goalText: {
    fontSize: 9,
    color: "#37474f",
  },
  goalSeparator: {
    fontSize: 9,
    color: "#78909c",
    marginHorizontal: 8,
  },
  benefitsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: "white",
    padding: "12px 10px",
    borderRadius: 6,
    textAlign: "center",
  },
  benefitLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#78909c",
    marginBottom: 4,
    fontWeight: 500,
  },
  benefitAmount: {
    fontSize: 18,
    fontWeight: 600,
    color: "#2e7d32",
  },
  benefitAmountHighlight: {
    fontSize: 18,
    fontWeight: 600,
    color: "#1565c0",
  },
  benefitPeriod: {
    fontSize: 9,
    color: "#78909c",
    marginTop: 2,
  },
  // Pain Section (Red) - compact
  painSection: {
    backgroundColor: "#ffebee",
    padding: "15px 50px",
    borderLeft: "5px solid #c62828",
    marginVertical: 12,
  },
  painTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#c62828",
    marginBottom: 10,
  },
  painStatsGrid: {
    flexDirection: "row",
    gap: 15,
  },
  painStat: {
    flex: 1,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 6,
  },
  painStatLabel: {
    fontSize: 10,
    color: "#78909c",
    marginBottom: 4,
    fontWeight: 500,
  },
  painStatValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#c62828",
  },
  painDescription: {
    fontSize: 9,
    color: "#78909c",
    marginTop: 4,
    lineHeight: 1.3,
  },
  // Section (compact)
  section: {
    padding: "15px 50px",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e3c72",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: "2px solid #e3f2fd",
  },
  // Credit Warning Explanation
  creditWarningBox: {
    backgroundColor: "#fff3e0",
    borderLeft: "4px solid #f57c00",
    padding: "12px 15px",
    marginBottom: 20,
    borderRadius: 4,
  },
  creditWarningText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#5d4037",
  },
  creditWarningBold: {
    fontWeight: 600,
    color: "#e65100",
  },
  // Comparison Table with Credit Column
  comparisonHeader: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#f5f5f5",
    fontWeight: 500,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#546e7a",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  comparisonRow: {
    flexDirection: "row",
    padding: "14px 12px",
    borderBottom: "1px solid #e0e0e0",
    alignItems: "center",
  },
  creditIcon: {
    width: 30,
    textAlign: "center",
    fontSize: 14,
  },
  debtName: {
    flex: 2,
    fontWeight: 400,
    color: "#37474f",
  },
  amount: {
    flex: 1,
    textAlign: "right",
    fontWeight: 500,
    color: "#37474f",
  },
  totalRow: {
    flexDirection: "row",
    padding: "16px 12px",
    backgroundColor: "#f5f5f5",
    fontWeight: 600,
    fontSize: 12,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  // Proposed Solution - 2x2 grid (compact)
  proposedSolution: {
    backgroundColor: "#e8f5e9",
    padding: 18,
    borderRadius: 6,
    marginTop: 10,
    borderLeft: "5px solid #2e7d32",
  },
  solutionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  solutionItem: {
    width: "50%",
    padding: "8px 8px",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  solutionLabel: {
    fontSize: 10,
    color: "#546e7a",
  },
  solutionValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#2e7d32",
  },
  solutionValueLarge: {
    fontSize: 18,
    fontWeight: 600,
    color: "#2e7d32",
  },
  // Loan Details - 3 columns (compact)
  loanDetails: {
    backgroundColor: "#fafafa",
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  loanDetailsTitle: {
    fontSize: 11,
    marginBottom: 8,
    color: "#1e3c72",
    fontWeight: 600,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailItem: {
    width: "33.33%",
    textAlign: "center",
    padding: "6px 4px",
  },
  detailLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#78909c",
    marginBottom: 3,
    fontWeight: 500,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: 600,
    color: "#37474f",
  },
  // CTA Section
  ctaSection: {
    backgroundColor: "#1e3c72",
    padding: "35px 50px",
    textAlign: "center",
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 12,
    color: "white",
  },
  ctaText: {
    fontSize: 12,
    fontWeight: 300,
    marginBottom: 20,
    color: "white",
  },
  contactInfo: {
    fontSize: 16,
    fontWeight: 500,
    marginTop: 8,
    color: "white",
  },
  // Disclaimer
  disclaimer: {
    padding: "25px 50px",
    backgroundColor: "#f8f9fa",
    fontSize: 8,
    lineHeight: 1.5,
    color: "#546e7a",
  },
  disclaimerTitle: {
    fontWeight: 600,
    marginBottom: 8,
    fontSize: 9,
    color: "#37474f",
  },
  // Footer - at end of document (not fixed)
  footer: {
    padding: "15px 50px",
    textAlign: "center",
    fontSize: 10,
    color: "#546e7a",
    borderTop: "1px solid #e0e0e0",
    backgroundColor: "white",
  },
});

interface ProposalPDFProps {
  data: ProposalData;
  logoBase64: string;
}

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

export function ProposalPDF({ data, logoBase64 }: ProposalPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header - only on page 1 */}
        <View style={styles.header}>
          <Image src={logoBase64} style={styles.logoImage} />
          <Text style={styles.clientName}>
            Mortgage Proposal for {data.borrowerName}
          </Text>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection} wrap={false}>
          <Text style={styles.heroTitle}>
            Save {formatCurrency(data.monthlySavings)} Per Month
          </Text>
          <Text style={styles.heroSubtitle}>
            Consolidate your debts and unlock cash from your home
          </Text>

          {/* Goals Section - inline row */}
          {data.goals && data.goals.length > 0 && (
            <View style={styles.goalsSection}>
              {data.goals.map((goal, index) => (
                <View key={index} style={styles.goalItem}>
                  <Text style={styles.goalCheckmark}>✓</Text>
                  <Text style={styles.goalText}>{goal}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.benefitsGrid}>
            <View style={styles.benefitCard}>
              <Text style={styles.benefitLabel}>Monthly Savings</Text>
              <Text style={styles.benefitAmount}>
                {formatCurrency(data.monthlySavings)}
              </Text>
              <Text style={styles.benefitPeriod}>Every month</Text>
            </View>
            <View style={styles.benefitCard}>
              <Text style={styles.benefitLabel}>Cash in Hand</Text>
              <Text style={styles.benefitAmountHighlight}>
                {formatCurrency(data.cashBack)}
              </Text>
              <Text style={styles.benefitPeriod}>At closing</Text>
            </View>
            <View style={styles.benefitCard}>
              <Text style={styles.benefitLabel}>5-Year Savings</Text>
              <Text style={styles.benefitAmount}>
                {formatCurrency(data.fiveYearSavings)}
              </Text>
              <Text style={styles.benefitPeriod}>Total saved</Text>
            </View>
          </View>
        </View>

        {/* Pain Section - Current Financial Burden */}
        <View style={styles.painSection} wrap={false}>
          <Text style={styles.painTitle}>⚠️ Your Current Financial Burden</Text>
          <View style={styles.painStatsGrid}>
            <View style={styles.painStat}>
              <Text style={styles.painStatLabel}>Total Debt Obligations</Text>
              <Text style={styles.painStatValue}>
                {formatCurrency(data.currentTotalBalance)}
              </Text>
              <Text style={styles.painDescription}>
                Spread across {data.liabilities.length} different creditors
              </Text>
            </View>
            <View style={styles.painStat}>
              <Text style={styles.painStatLabel}>Current Monthly Payments</Text>
              <Text style={styles.painStatValue}>
                {formatCurrency(data.currentTotalPayment)}
              </Text>
              <Text style={styles.painDescription}>
                Putting strain on your monthly budget
              </Text>
            </View>
          </View>
        </View>

        {/* Proposed Solution */}
        <View style={styles.section}>
          {/* Wrap title + solution box together to prevent page break between them */}
          <View wrap={false}>
            <Text style={styles.sectionTitle}>
              Your New Consolidated Mortgage - The Solution
            </Text>

            <View style={styles.proposedSolution}>
              <View style={styles.solutionGrid}>
                <View style={styles.solutionItem}>
                  <Text style={styles.solutionLabel}>New Mortgage Amount</Text>
                  <Text style={styles.solutionValueLarge}>
                    {formatCurrency(data.newMortgageAmount)}
                  </Text>
                </View>
                <View style={styles.solutionItem}>
                  <Text style={styles.solutionLabel}>New Monthly Payment</Text>
                  <Text style={styles.solutionValueLarge}>
                    {formatCurrency(data.newMonthlyPayment)}
                  </Text>
                </View>
                <View style={styles.solutionItem}>
                  <Text style={styles.solutionLabel}>Debts Paid Off</Text>
                  <Text style={styles.solutionValue}>
                    {formatCurrency(data.currentTotalBalance)}
                  </Text>
                </View>
                <View style={styles.solutionItem}>
                  <Text style={styles.solutionLabel}>Cash Advance to You</Text>
                  <Text style={styles.solutionValue}>
                    {formatCurrency(data.cashBack)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.loanDetails} wrap={false}>
            <Text style={styles.loanDetailsTitle}>Loan Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Interest Rate</Text>
                <Text style={styles.detailValue}>
                  {formatPercent(data.newRate)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Term</Text>
                <Text style={styles.detailValue}>{data.termMonths} Months</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Amortization</Text>
                <Text style={styles.detailValue}>
                  {data.amortizationMonths} Months
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>APR</Text>
                <Text style={styles.detailValue}>
                  {formatPercent(data.apr)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Total Interest</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(data.totalInterest)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Estimated Fees</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(data.estimatedFees)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Current Debts Section - Detailed Breakdown */}
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>
            Current Debts - Detailed Breakdown
          </Text>

          {/* Credit Warning Explanation */}
          <View style={styles.creditWarningBox} wrap={false}>
            <Text style={styles.creditWarningText}>
              <Text style={styles.creditWarningBold}>
                ⚠️ Credit Impact Notice:{" "}
              </Text>
              Debts marked with the warning icon are factors that typically
              impact credit scores. High credit card balances, missed payments,
              and accounts in collections commonly affect credit ratings. By
              consolidating these debts, you can improve your credit utilization
              over time.
            </Text>
          </View>

          {/* Keep title with header row */}
          <View wrap={false}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.creditIcon}>⚠️</Text>
              <Text style={styles.debtName}>Creditor</Text>
              <Text style={styles.amount}>Balance</Text>
              <Text style={styles.amount}>Monthly Payment</Text>
            </View>
          </View>

          {data.liabilities.map((liability) => (
            <View key={liability.id} style={styles.comparisonRow} wrap={false}>
              <Text style={styles.creditIcon}>
                {liability.impacts_credit ? "⚠️" : ""}
              </Text>
              <Text style={styles.debtName}>{liability.lender}</Text>
              <Text style={styles.amount}>
                {formatCurrency(liability.balance)}
              </Text>
              <Text style={styles.amount}>
                {formatCurrency(liability.payment)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.creditIcon}></Text>
            <Text style={styles.debtName}>Total Current Obligations</Text>
            <Text style={styles.amount}>
              {formatCurrency(data.currentTotalBalance)}
            </Text>
            <Text style={styles.amount}>
              {formatCurrency(data.currentTotalPayment)}
            </Text>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection} wrap={false}>
          <Text style={styles.ctaTitle}>Ready to Move Forward?</Text>
          <Text style={styles.ctaText}>
            Let&apos;s get started on your application today
          </Text>
          <Text style={styles.contactInfo}>1.800.288.2764</Text>
          <Text style={styles.contactInfo}>info@bluepearlmortgage.ca</Text>
        </View>

        {/* Disclaimer - force new page to prevent cutoff */}
        <View style={styles.disclaimer} break>
          <Text style={styles.disclaimerTitle}>Important Disclosure</Text>
          <Text>Blue Pearl Mortgage Group&apos;s intent is to always provide full disclosure of our loan offerings. Borrowers are provided with all necessary disclosure prior to entering any obligation. We are not affiliated with any financial institutions, which include banks, credit unions, alternative and private lenders. The rates and scenarios shown on the pages of this sample solution are only applicable to loans being processed by Blue Pearl Mortgage Group. This example is for informational purposes only; it&apos;s not an offer to make a loan or the approval of any loan terms. The payment calculations shown here are simply estimates and are based upon the unverified information as shared above. Blue Pearl Mortgage Group and its representatives have taken reasonable care in providing this example but do not guarantee accuracy or completeness. Information is provided with no warranty, express or implied, and all such warranties are expressly disclaimed. We assume no liability for any loss, damage or expense from errors or omissions in these materials, whether arising from use or non-use of the information. Blue Pearl Mortgage Group is not responsible for any loss, injury, claim, liability, or damage related to your use of this proposal or any information contained in this document.</Text>
          <Text style={{ marginTop: 8 }}>Licensing: British Columbia Brokerage #X300317 • Alberta Brokerage #389306 • Saskatchewan Brokerage #316807 • Ontario FSCO License #12890</Text>
        </View>

        {/* Footer - only appears at end of document */}
        <View style={styles.footer}>
          <Text>© 2025 Blue Pearl Inc. All rights reserved.</Text>
        </View>
      </Page>
    </Document>
  );
}
