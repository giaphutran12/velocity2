/**
 * Velocity → Supabase Transformer
 * Transforms Velocity API JSON into normalized Supabase table rows
 *
 * H1: Traditional Normalized ETL approach
 */

// Type definitions for Velocity API response
interface VelocityAddress {
  unitNumber: string | null;
  streetNumber: string | null;
  streetName: string | null;
  streetType: number | null;
  streetDirection: number | null;
  city: string | null;
  provinceOrState?: number | null;
  province?: number | null;
  postalCode: string | null;
  country?: number | null;
}

interface VelocityEmployment {
  grossRevenue: number | null;
  isCurrent: boolean;
  employerName: string | null;
  incomeType: number | null;
  incomePeriod: number | null;
  employmentAddress: VelocityAddress | null;
}

interface VelocityLiability {
  typeId: number | null;
  lender: string | null;
  inCreditBureau: boolean;
  limit: number | null;
  balance: number | null;
  payment: number | null;
  override: boolean;
  closingDate: string | null;
  description: string | null;
  payoffTypeId: number | null;
}

interface VelocityAsset {
  type: string | null;
  description: string | null;
  downPayment: number | null;
  value: number | null;
}

interface VelocityPropertyTotals {
  value: number | null;
  mortgages: number | null;
  payments: number | null;
  expenses: number | null;
  rentalIncome: number | null;
  rentalExpenses: number | null;
}

interface VelocityProperty {
  occupancyId: number | null;
  value: number | null;
  originalDate: string | null;
  originalAmount: number | null;
  includeInTds: boolean;
  condoFees100Percent: number | null;
  annualTaxes: number | null;
  condoFees: number | null;
  condoFeesIncludeHeating: boolean;
  heating: number | null;
  propertyEquity: number | null;
  futureStatusId: number | null;
  address: VelocityAddress;
  totals: VelocityPropertyTotals;
}

interface VelocityBorrower {
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  homePhone: string | null;
  cellPhone: string | null;
  businessPhone: string | null;
  email: string | null;
  addresses: VelocityAddress[];
  mailingAddress: VelocityAddress | null;
  employmentHistory: VelocityEmployment | null;
  liabilities: VelocityLiability[];
  firstTimeHomeBuyer: boolean | null;
  creditScore: number | null;
  assets: VelocityAsset[];
  properties: VelocityProperty[];
}

interface VelocitySubjectProperty {
  unitNumber: string | null;
  streetNumber: string | null;
  streetName: string | null;
  streetType: number | null;
  streetDirection: number | null;
  city: string | null;
  province: number | null;
  postalCode: string | null;
  intendedUse: number | null;
  purchasePrice: number | null;
  tenure: string | null;
  constructionType: string | null;
  propertyType: string | null;
}

interface VelocityMortgage {
  amount: number | null;
}

interface VelocityMortgageRequest {
  applicationType: number | null;
  purpose: number | null;
  lenderName: string | null;
  mortgages: VelocityMortgage[];
  payment: number | null;
  maturityDate: string | null;
  approved: boolean | null;
  interestAdjustmentDate: string | null;
  firstPaymentDate: string | null;
  amortization: number | null;
  termInMonths: number | null;
  netRate: number | null;
  rateType: number | null;
  paymentFrequency: number | null;
  rate: number | null;
  discountRate: number | null;
  premiumRate: number | null;
  buyDownRate: number | null;
  amortizationMonths: number | null;
}

interface VelocityCondition {
  name: string | null;
  isSent: boolean;
  isApproved: boolean;
}

interface VelocityNote {
  text: string | null;
  dateCreated: string | null;
}

interface VelocityDeal {
  loanCode: string;
  agent: string | null;
  status: number;
  dateCreated: string | null;
  closingDate: string | null;
  linkApplicationId: string | null;
  lenderReferenceNumber: string | null;
  isConfirmedCompliant: boolean;
  customSource: string | null;
  borrowers: VelocityBorrower[];
  subjectProperty: VelocitySubjectProperty | null;
  mortgageRequest: VelocityMortgageRequest | null;
  lenderConditions: VelocityCondition[];
  conditions: VelocityCondition[];
  notes: VelocityNote[];
}

// Supabase row types
export interface DealRow {
  loan_code: string;
  agent: string | null;
  status_code: number;
  date_created: string | null;
  closing_date: string | null;
  link_application_id: string | null;
  lender_reference_number: string | null;
  is_confirmed_compliant: boolean;
  custom_source: string | null;
}

export interface BorrowerRow {
  deal_id: string;
  borrower_index: number;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  home_phone: string | null;
  cell_phone: string | null;
  business_phone: string | null;
  email: string | null;
  credit_score: number | null;
  first_time_home_buyer: boolean | null;
}

export interface BorrowerAddressRow {
  borrower_id: string;
  address_type: string;
  address_index: number;
  unit_number: string | null;
  street_number: string | null;
  street_name: string | null;
  street_type_code: number | null;
  street_direction_code: number | null;
  city: string | null;
  province_code: number | null;
  postal_code: string | null;
  country_code: number | null;
}

export interface BorrowerEmploymentRow {
  borrower_id: string;
  employer_name: string | null;
  gross_revenue: number | null;
  is_current: boolean;
  income_type_code: number | null;
  income_period_code: number | null;
  emp_unit_number: string | null;
  emp_street_number: string | null;
  emp_street_name: string | null;
  emp_street_type_code: number | null;
  emp_street_direction_code: number | null;
  emp_city: string | null;
  emp_province_code: number | null;
  emp_postal_code: string | null;
  emp_country_code: number | null;
}

export interface BorrowerLiabilityRow {
  borrower_id: string;
  type_code: number | null;
  lender: string | null;
  in_credit_bureau: boolean | null;
  credit_limit: number | null;
  balance: number | null;
  payment: number | null;
  override: boolean | null;
  closing_date: string | null;
  description: string | null;
  payoff_type_id: number | null;
}

export interface BorrowerAssetRow {
  borrower_id: string;
  asset_type: string | null;
  description: string | null;
  down_payment: number | null;
  value: number | null;
}

export interface BorrowerPropertyRow {
  borrower_id: string;
  occupancy_id: number | null;
  property_value: number | null;
  original_date: string | null;
  original_amount: number | null;
  include_in_tds: boolean;
  condo_fees_100_percent: number | null;
  annual_taxes: number | null;
  condo_fees: number | null;
  condo_fees_include_heating: boolean;
  heating: number | null;
  property_equity: number | null;
  future_status_id: number | null;
  unit_number: string | null;
  street_number: string | null;
  street_name: string | null;
  street_type_code: number | null;
  street_direction_code: number | null;
  city: string | null;
  province_code: number | null;
  postal_code: string | null;
  country_code: number | null;
  totals_value: number | null;
  totals_mortgages: number | null;
  totals_payments: number | null;
  totals_expenses: number | null;
  totals_rental_income: number | null;
  totals_rental_expenses: number | null;
}

export interface SubjectPropertyRow {
  deal_id: string;
  unit_number: string | null;
  street_number: string | null;
  street_name: string | null;
  street_type_code: number | null;
  street_direction_code: number | null;
  city: string | null;
  province_code: number | null;
  postal_code: string | null;
  intended_use_code: number | null;
  purchase_price: number | null;
  tenure: string | null;
  construction_type: string | null;
  property_type: string | null;
}

export interface MortgageRequestRow {
  deal_id: string;
  application_type_code: number | null;
  purpose_code: number | null;
  lender_name: string | null;
  payment: number | null;
  maturity_date: string | null;
  approved: string | null; // Timestamp when approved, null if not approved
  interest_adjustment_date: string | null;
  first_payment_date: string | null;
  amortization: number | null;
  amortization_months: number | null;
  term_in_months: number | null;
  net_rate: number | null;
  rate_type_code: number | null;
  payment_frequency_code: number | null;
  rate: number | null;
  discount_rate: number | null;
  premium_rate: number | null;
  buy_down_rate: number | null;
}

export interface MortgageRow {
  mortgage_request_id: string;
  mortgage_index: number;
  amount: number | null;
}

export interface ConditionRow {
  deal_id: string;
  condition_index: number;
  condition_type: string;
  name: string | null;
  is_sent: boolean;
  is_approved: boolean;
}

export interface NoteRow {
  deal_id: string;
  note_index: number;
  text: string | null;
  date_created: string | null;
}

// Helper to parse dates
function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

function parseDateOnly(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// Helper to parse numeric values (handles "true"/"false" strings)
function parseNumeric(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return null; // Discard boolean for numeric fields
  if (typeof val === "string") {
    if (val === "true" || val === "false") return null; // Discard boolean strings
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Helper to parse approval date (Velocity sends timestamp when approved, null when not)
function parseApprovalDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string" && val.length > 0) {
    return parseDate(val);
  }
  return null;
}

// Transform a single deal
export function transformDeal(deal: VelocityDeal): DealRow {
  return {
    loan_code: deal.loanCode,
    agent: deal.agent?.trim() || null,
    status_code: deal.status,
    date_created: parseDate(deal.dateCreated),
    closing_date: parseDate(deal.closingDate),
    link_application_id: deal.linkApplicationId,
    lender_reference_number: deal.lenderReferenceNumber,
    is_confirmed_compliant: deal.isConfirmedCompliant,
    custom_source: deal.customSource,
  };
}

// Transform borrowers for a deal
export function transformBorrowers(
  dealId: string,
  borrowers: VelocityBorrower[]
): BorrowerRow[] {
  return borrowers.map((b, idx) => ({
    deal_id: dealId,
    borrower_index: idx,
    first_name: b.firstName?.trim() || null,
    last_name: b.lastName?.trim() || null,
    date_of_birth: parseDateOnly(b.dateOfBirth),
    home_phone: b.homePhone,
    cell_phone: b.cellPhone,
    business_phone: b.businessPhone,
    email: b.email?.trim() || null,
    credit_score: b.creditScore,
    first_time_home_buyer: b.firstTimeHomeBuyer,
  }));
}

// Transform borrower addresses
export function transformBorrowerAddresses(
  borrowerId: string,
  borrower: VelocityBorrower
): BorrowerAddressRow[] {
  const addresses: BorrowerAddressRow[] = [];

  // Current addresses
  borrower.addresses?.forEach((addr, idx) => {
    addresses.push({
      borrower_id: borrowerId,
      address_type: "current",
      address_index: idx,
      unit_number: addr.unitNumber,
      street_number: addr.streetNumber,
      street_name: addr.streetName,
      street_type_code: addr.streetType,
      street_direction_code: addr.streetDirection,
      city: addr.city,
      province_code: addr.provinceOrState ?? addr.province ?? null,
      postal_code: addr.postalCode,
      country_code: addr.country ?? null,
    });
  });

  // Mailing address
  if (borrower.mailingAddress) {
    const addr = borrower.mailingAddress;
    addresses.push({
      borrower_id: borrowerId,
      address_type: "mailing",
      address_index: 0,
      unit_number: addr.unitNumber,
      street_number: addr.streetNumber,
      street_name: addr.streetName,
      street_type_code: addr.streetType,
      street_direction_code: addr.streetDirection,
      city: addr.city,
      province_code: addr.provinceOrState ?? addr.province ?? null,
      postal_code: addr.postalCode,
      country_code: addr.country ?? null,
    });
  }

  return addresses;
}

// Transform borrower employment
export function transformBorrowerEmployment(
  borrowerId: string,
  employment: VelocityEmployment | null
): BorrowerEmploymentRow | null {
  if (!employment) return null;

  const addr = employment.employmentAddress;
  return {
    borrower_id: borrowerId,
    employer_name: employment.employerName,
    gross_revenue: employment.grossRevenue,
    is_current: employment.isCurrent ?? true,
    income_type_code: employment.incomeType,
    income_period_code: employment.incomePeriod,
    emp_unit_number: addr?.unitNumber ?? null,
    emp_street_number: addr?.streetNumber ?? null,
    emp_street_name: addr?.streetName ?? null,
    emp_street_type_code: addr?.streetType ?? null,
    emp_street_direction_code: addr?.streetDirection ?? null,
    emp_city: addr?.city ?? null,
    emp_province_code: addr?.provinceOrState ?? addr?.province ?? null,
    emp_postal_code: addr?.postalCode ?? null,
    emp_country_code: addr?.country ?? null,
  };
}

// Transform borrower liabilities
export function transformBorrowerLiabilities(
  borrowerId: string,
  liabilities: VelocityLiability[]
): BorrowerLiabilityRow[] {
  return liabilities.map((l) => ({
    borrower_id: borrowerId,
    type_code: l.typeId,
    lender: l.lender,
    in_credit_bureau: l.inCreditBureau,
    credit_limit: l.limit,
    balance: l.balance,
    payment: l.payment,
    override: l.override,
    closing_date: parseDateOnly(l.closingDate),
    description: l.description,
    payoff_type_id: l.payoffTypeId,
  }));
}

// Transform borrower assets
export function transformBorrowerAssets(
  borrowerId: string,
  assets: VelocityAsset[]
): BorrowerAssetRow[] {
  return assets.map((a) => ({
    borrower_id: borrowerId,
    asset_type: a.type,
    description: a.description,
    down_payment: a.downPayment,
    value: a.value,
  }));
}

// Transform borrower properties
export function transformBorrowerProperties(
  borrowerId: string,
  properties: VelocityProperty[]
): BorrowerPropertyRow[] {
  return properties.map((p) => ({
    borrower_id: borrowerId,
    occupancy_id: p.occupancyId,
    property_value: parseNumeric(p.value),
    original_date: parseDateOnly(p.originalDate),
    original_amount: parseNumeric(p.originalAmount),
    include_in_tds: p.includeInTds ?? false,
    condo_fees_100_percent: parseNumeric(p.condoFees100Percent),
    annual_taxes: parseNumeric(p.annualTaxes),
    condo_fees: parseNumeric(p.condoFees),
    condo_fees_include_heating: p.condoFeesIncludeHeating ?? false,
    heating: parseNumeric(p.heating),
    property_equity: parseNumeric(p.propertyEquity),
    future_status_id: p.futureStatusId,
    unit_number: p.address?.unitNumber ?? null,
    street_number: p.address?.streetNumber ?? null,
    street_name: p.address?.streetName ?? null,
    street_type_code: p.address?.streetType ?? null,
    street_direction_code: p.address?.streetDirection ?? null,
    city: p.address?.city ?? null,
    province_code:
      p.address?.provinceOrState ?? p.address?.province ?? null,
    postal_code: p.address?.postalCode ?? null,
    country_code: p.address?.country ?? null,
    totals_value: parseNumeric(p.totals?.value),
    totals_mortgages: parseNumeric(p.totals?.mortgages),
    totals_payments: parseNumeric(p.totals?.payments),
    totals_expenses: parseNumeric(p.totals?.expenses),
    totals_rental_income: parseNumeric(p.totals?.rentalIncome),
    totals_rental_expenses: parseNumeric(p.totals?.rentalExpenses),
  }));
}

// Transform subject property
export function transformSubjectProperty(
  dealId: string,
  sp: VelocitySubjectProperty | null
): SubjectPropertyRow | null {
  if (!sp) return null;

  return {
    deal_id: dealId,
    unit_number: sp.unitNumber,
    street_number: sp.streetNumber,
    street_name: sp.streetName,
    street_type_code: sp.streetType,
    street_direction_code: sp.streetDirection,
    city: sp.city,
    province_code: sp.province,
    postal_code: sp.postalCode,
    intended_use_code: sp.intendedUse,
    purchase_price: sp.purchasePrice,
    tenure: sp.tenure,
    construction_type: sp.constructionType,
    property_type: sp.propertyType,
  };
}

// Transform mortgage request
export function transformMortgageRequest(
  dealId: string,
  mr: VelocityMortgageRequest | null
): MortgageRequestRow | null {
  if (!mr) return null;

  return {
    deal_id: dealId,
    application_type_code: mr.applicationType,
    purpose_code: mr.purpose,
    lender_name: mr.lenderName,
    payment: mr.payment,
    maturity_date: parseDateOnly(mr.maturityDate),
    approved: parseApprovalDate(mr.approved), // Store actual approval date
    interest_adjustment_date: parseDateOnly(mr.interestAdjustmentDate),
    first_payment_date: parseDateOnly(mr.firstPaymentDate),
    amortization: mr.amortization,
    amortization_months: mr.amortizationMonths,
    term_in_months: mr.termInMonths,
    net_rate: mr.netRate,
    rate_type_code: mr.rateType,
    payment_frequency_code: mr.paymentFrequency,
    rate: mr.rate,
    discount_rate: mr.discountRate,
    premium_rate: mr.premiumRate,
    buy_down_rate: mr.buyDownRate,
  };
}

// Transform mortgages
export function transformMortgages(
  mortgageRequestId: string,
  mortgages: VelocityMortgage[]
): MortgageRow[] {
  return mortgages.map((m, idx) => ({
    mortgage_request_id: mortgageRequestId,
    mortgage_index: idx,
    amount: m.amount,
  }));
}

// Transform conditions
export function transformConditions(
  dealId: string,
  conditions: VelocityCondition[],
  conditionType: "broker" | "lender"
): ConditionRow[] {
  return conditions
    .filter((c) => c.name !== null) // Skip empty conditions
    .map((c, idx) => ({
      deal_id: dealId,
      condition_index: idx,
      condition_type: conditionType,
      name: c.name,
      is_sent: c.isSent ?? false,
      is_approved: c.isApproved ?? false,
    }));
}

// Transform notes
export function transformNotes(
  dealId: string,
  notes: VelocityNote[]
): NoteRow[] {
  return notes
    .filter((n) => n.text !== null)
    .map((n, idx) => ({
      deal_id: dealId,
      note_index: idx,
      text: n.text,
      date_created: parseDate(n.dateCreated),
    }));
}

// Export the VelocityDeal type for use in API route
export type { VelocityDeal };
