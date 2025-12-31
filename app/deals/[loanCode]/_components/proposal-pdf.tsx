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

Font.register({
  family: "OpenSans",
  fonts: [300, 400, 500, 600, 700].map((w) => ({
    src: `https://cdn.jsdelivr.net/npm/@fontsource/open-sans/files/open-sans-latin-${w}-normal.woff`,
    fontWeight: w,
  })),
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "OpenSans",
    fontSize: 10,
    fontWeight: 300,
    color: "#2c3e50",
    paddingTop: 10,
    paddingBottom: 35,
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
  // Goals Section (vertical list)
  goalsSection: {
    backgroundColor: "white",
    padding: "10px 20px",
    borderRadius: 6,
    marginBottom: 10,
    flexDirection: "column",
    gap: 4,
  },
  goalItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  goalCheckmark: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#37474f",
    marginRight: 6,
  },
  goalText: {
    fontSize: 10,
    color: "#37474f",
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
    marginVertical: 20,
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
  painStatHighlight: {
    flex: 1,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 6,
    border: "1px solid black",
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
  impactingCreditCol: {
    width: 70,
    textAlign: "center",
    fontSize: 10,
  },
  impactingCreditHeader: {
    width: 70,
    textAlign: "center",
    fontSize: 10,
    color: "#dc2626",
    fontWeight: 600,
  },
  impactingCreditYes: {
    width: 70,
    textAlign: "center",
    fontSize: 10,
    color: "#dc2626",
    fontWeight: 600,
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
  // Proposed Solution Section (Green) - matches pain section style
  solutionSection: {
    backgroundColor: "#e8f5e9",
    padding: "15px 50px",
    borderLeft: "5px solid #2e7d32",
    marginVertical: 20,
  },
  solutionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#2e7d32",
    marginBottom: 10,
  },
  solutionStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  solutionStat: {
    width: "48%",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 6,
  },
  solutionStatHighlight: {
    width: "48%",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 6,
    border: "1px solid black",
  },
  solutionStatLabel: {
    fontSize: 10,
    color: "#78909c",
    marginBottom: 4,
    fontWeight: 500,
  },
  solutionStatValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#2e7d32",
  },
  solutionStatValueSmall: {
    fontSize: 16,
    fontWeight: 700,
    color: "#2e7d32",
  },
  // Loan Details Section (Gray) - matches pain/solution section style
  loanDetailsSection: {
    backgroundColor: "#f5f5f5",
    padding: "15px 50px",
    borderLeft: "5px solid #78909c",
    marginVertical: 20,
  },
  loanDetailsTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#546e7a",
    marginBottom: 10,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailItem: {
    width: "30%",
    textAlign: "center",
    padding: 10,
    backgroundColor: "white",
    borderRadius: 6,
  },
  detailLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#78909c",
    marginBottom: 4,
    fontWeight: 500,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#37474f",
  },
  // CTA Section
  ctaSection: {
    backgroundColor: "#1e3c72",
    padding: "20px 50px",
    textAlign: "center",
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
    color: "white",
  },
  ctaText: {
    fontSize: 11,
    fontWeight: 300,
    marginBottom: 12,
    color: "white",
  },
  contactInfo: {
    fontSize: 14,
    fontWeight: 500,
    marginTop: 4,
    color: "white",
  },
  // Disclaimer (inside CTA)
  disclaimer: {
    marginTop: 15,
    paddingTop: 12,
    borderTop: "1px solid #546e7a",
    fontSize: 7,
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
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
  // Fixed page footer (in margin, doesn't take content space)
  pageFooter: {
    position: "absolute",
    bottom: 15,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 8,
    color: "#9e9e9e",
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
  const hasAnyCreditImpact = data.liabilities.some((l) => l.impacts_credit);

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

          {/* Goals Section - vertical list */}
          {data.goals && data.goals.length > 0 && (
            <View style={styles.goalsSection}>
              {data.goals.map((goal, index) => (
                <View key={index} style={styles.goalItem}>
                  <View style={styles.goalCheckmark} />
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
          <Text style={styles.painTitle}>Your Current Financial Burden</Text>
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
            <View style={styles.painStatHighlight}>
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

        {/* Proposed Solution Section (Green) - matches pain section style */}
        <View style={styles.solutionSection} wrap={false}>
          <Text style={styles.solutionTitle}>
            Your New Consolidated Mortgage - The Solution
          </Text>
          <View style={styles.solutionStatsGrid}>
            <View style={styles.solutionStat}>
              <Text style={styles.solutionStatLabel}>New Mortgage Amount</Text>
              <Text style={styles.solutionStatValue}>
                {formatCurrency(data.newMortgageAmount)}
              </Text>
            </View>
            <View style={styles.solutionStatHighlight}>
              <Text style={styles.solutionStatLabel}>New Monthly Payment</Text>
              <Text style={styles.solutionStatValue}>
                {formatCurrency(data.newMonthlyPayment)}
              </Text>
            </View>
            <View style={styles.solutionStat}>
              <Text style={styles.solutionStatLabel}>Debts Paid Off</Text>
              <Text style={styles.solutionStatValueSmall}>
                {formatCurrency(data.currentTotalBalance)}
              </Text>
            </View>
            <View style={styles.solutionStat}>
              <Text style={styles.solutionStatLabel}>Cash Advance to You</Text>
              <Text style={styles.solutionStatValueSmall}>
                {formatCurrency(data.cashBack)}
              </Text>
            </View>
          </View>
        </View>

        {/* Loan Details Section (Gray) - matches pain/solution section style */}
        <View style={styles.loanDetailsSection} wrap={false}>
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
              <Text style={styles.detailValue}>{formatPercent(data.apr)}</Text>
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

        {/* Current Debts Section - Detailed Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Current Debts - Detailed Breakdown
          </Text>

          {/* Keep title with header row */}
          <View wrap={false}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.debtName}>Creditor</Text>
              {hasAnyCreditImpact && (
                <Text style={styles.impactingCreditHeader}>
                  Impacting Credit
                </Text>
              )}
              <Text style={styles.amount}>Balance</Text>
              <Text style={styles.amount}>Monthly Payment</Text>
            </View>
          </View>

          {data.liabilities.map((liability) => (
            <View key={liability.id} style={styles.comparisonRow} wrap={false}>
              <Text style={styles.debtName}>{liability.lender}</Text>
              {hasAnyCreditImpact && (
                <Text style={styles.impactingCreditYes}>
                  {liability.impacts_credit ? "Yes" : ""}
                </Text>
              )}
              <Text style={styles.amount}>
                {formatCurrency(liability.balance)}
              </Text>
              <Text style={styles.amount}>
                {formatCurrency(liability.payment)}
              </Text>
            </View>
          ))}

          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.debtName}>Total Current Obligations</Text>
            {hasAnyCreditImpact && (
              <Text style={styles.impactingCreditCol}></Text>
            )}
            <Text style={styles.amount}>
              {formatCurrency(data.currentTotalBalance)}
            </Text>
            <Text style={styles.amount}>
              {formatCurrency(data.currentTotalPayment)}
            </Text>
          </View>
        </View>

        {/* CTA Section with Disclaimer */}
        <View style={styles.ctaSection} wrap={false}>
          <Text style={styles.ctaTitle}>Ready to Move Forward?</Text>
          <Text style={styles.ctaText}>
            Let&apos;s get started on your application today
          </Text>
          <Text style={styles.contactInfo}>1-800-288-2764</Text>
          <Text style={styles.contactInfo}>bluepearl.ca</Text>
          <Text style={styles.contactInfo}>info@bluepearlmortgage.ca</Text>
          <View style={styles.disclaimer}>
            <Text>
              This proposal is for informational purposes only and is not an
              offer or approval of loan terms. Estimates are based on unverified
              information; accuracy is not guaranteed. Licensed in BC #X300317 •
              AB #389306 • SK #316807 • ON #12890
            </Text>
          </View>
        </View>

        {/* Fixed footer in margin */}
        <Text style={styles.pageFooter} fixed>
          © Blue Pearl 2025. All rights reserved.
        </Text>
      </Page>
    </Document>
  );
}
