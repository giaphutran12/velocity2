-- Velocity Data Migration: Main Data Tables
-- H1: Traditional Normalized ETL
-- 12 main tables for Velocity deal data

-- ============================================
-- DEALS (Primary Entity)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_code TEXT UNIQUE NOT NULL,
  agent TEXT,
  status_code INT REFERENCES vl_deal_statuses(code),
  date_created TIMESTAMPTZ,
  closing_date TIMESTAMPTZ,
  link_application_id TEXT,
  lender_reference_number TEXT,
  is_confirmed_compliant BOOLEAN DEFAULT FALSE,
  custom_source TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_deals_loan_code ON vl_deals(loan_code);
CREATE INDEX IF NOT EXISTS idx_vl_deals_status ON vl_deals(status_code);
CREATE INDEX IF NOT EXISTS idx_vl_deals_agent ON vl_deals(agent);
CREATE INDEX IF NOT EXISTS idx_vl_deals_date_created ON vl_deals(date_created);

-- ============================================
-- BORROWERS
-- ============================================
CREATE TABLE IF NOT EXISTS vl_borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES vl_deals(id) ON DELETE CASCADE,
  borrower_index INT NOT NULL, -- Position in borrowers array (0, 1, 2...)

  -- Personal Info
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  home_phone TEXT,
  cell_phone TEXT,
  business_phone TEXT,
  email TEXT,

  -- Credit
  credit_score INT,
  first_time_home_buyer BOOLEAN,
  marital_status_code INT REFERENCES vl_marital_statuses(code),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(deal_id, borrower_index)
);

CREATE INDEX IF NOT EXISTS idx_vl_borrowers_deal ON vl_borrowers(deal_id);
CREATE INDEX IF NOT EXISTS idx_vl_borrowers_name ON vl_borrowers(last_name, first_name);

-- ============================================
-- BORROWER ADDRESSES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_borrower_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES vl_borrowers(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL, -- 'current', 'mailing', 'previous'
  address_index INT DEFAULT 0, -- For multiple addresses of same type

  unit_number TEXT,
  street_number TEXT,
  street_name TEXT,
  street_type_code INT REFERENCES vl_street_types(code),
  street_direction_code INT REFERENCES vl_street_directions(code),
  city TEXT,
  province_code INT REFERENCES vl_provinces(code),
  postal_code TEXT,
  country_code INT REFERENCES vl_countries(code),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_borrower_addresses_borrower ON vl_borrower_addresses(borrower_id);

-- ============================================
-- BORROWER EMPLOYMENT
-- ============================================
CREATE TABLE IF NOT EXISTS vl_borrower_employment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES vl_borrowers(id) ON DELETE CASCADE,

  employer_name TEXT,
  gross_revenue DECIMAL(15, 2),
  is_current BOOLEAN DEFAULT TRUE,
  income_type_code INT REFERENCES vl_income_types(code),
  income_period_code INT REFERENCES vl_income_periods(code),

  -- Employment Address
  emp_unit_number TEXT,
  emp_street_number TEXT,
  emp_street_name TEXT,
  emp_street_type_code INT REFERENCES vl_street_types(code),
  emp_street_direction_code INT REFERENCES vl_street_directions(code),
  emp_city TEXT,
  emp_province_code INT REFERENCES vl_provinces(code),
  emp_postal_code TEXT,
  emp_country_code INT REFERENCES vl_countries(code),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_borrower_employment_borrower ON vl_borrower_employment(borrower_id);

-- ============================================
-- BORROWER LIABILITIES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_borrower_liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES vl_borrowers(id) ON DELETE CASCADE,

  type_code INT REFERENCES vl_liability_types(code), -- Nullable for unknown types
  lender TEXT,
  in_credit_bureau BOOLEAN,
  credit_limit DECIMAL(15, 2),
  balance DECIMAL(15, 2),
  payment DECIMAL(15, 2),
  override BOOLEAN,
  closing_date DATE,
  description TEXT,
  payoff_type_id INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_borrower_liabilities_borrower ON vl_borrower_liabilities(borrower_id);
CREATE INDEX IF NOT EXISTS idx_vl_borrower_liabilities_type ON vl_borrower_liabilities(type_code);

-- ============================================
-- BORROWER ASSETS (text type, not FK)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_borrower_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES vl_borrowers(id) ON DELETE CASCADE,

  asset_type TEXT, -- "Chequing Account", "Vehicle", "RRSP", etc.
  description TEXT,
  down_payment DECIMAL(15, 2),
  value DECIMAL(15, 2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_borrower_assets_borrower ON vl_borrower_assets(borrower_id);

-- ============================================
-- BORROWER PROPERTIES (owned properties)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_borrower_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES vl_borrowers(id) ON DELETE CASCADE,

  occupancy_id INT,
  property_value DECIMAL(15, 2),
  original_date DATE,
  original_amount DECIMAL(15, 2),
  include_in_tds BOOLEAN DEFAULT FALSE,
  condo_fees_100_percent DECIMAL(15, 2),
  annual_taxes DECIMAL(15, 2),
  condo_fees DECIMAL(15, 2),
  condo_fees_include_heating BOOLEAN DEFAULT FALSE,
  heating DECIMAL(15, 2),
  property_equity DECIMAL(15, 2),
  future_status_id INT,

  -- Address
  unit_number TEXT,
  street_number TEXT,
  street_name TEXT,
  street_type_code INT REFERENCES vl_street_types(code),
  street_direction_code INT REFERENCES vl_street_directions(code),
  city TEXT,
  province_code INT REFERENCES vl_provinces(code),
  postal_code TEXT,
  country_code INT REFERENCES vl_countries(code),

  -- Totals
  totals_value DECIMAL(15, 2),
  totals_mortgages DECIMAL(15, 2),
  totals_payments DECIMAL(15, 2),
  totals_expenses DECIMAL(15, 2),
  totals_rental_income DECIMAL(15, 2),
  totals_rental_expenses DECIMAL(15, 2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_borrower_properties_borrower ON vl_borrower_properties(borrower_id);

-- ============================================
-- SUBJECT PROPERTIES (property being mortgaged)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_subject_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID UNIQUE NOT NULL REFERENCES vl_deals(id) ON DELETE CASCADE,

  unit_number TEXT,
  street_number TEXT,
  street_name TEXT,
  street_type_code INT REFERENCES vl_street_types(code),
  street_direction_code INT REFERENCES vl_street_directions(code),
  city TEXT,
  province_code INT REFERENCES vl_provinces(code),
  postal_code TEXT,

  intended_use_code INT REFERENCES vl_intended_uses(code),
  purchase_price DECIMAL(15, 2),
  tenure TEXT,
  construction_type TEXT,
  property_type TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_subject_properties_deal ON vl_subject_properties(deal_id);

-- ============================================
-- MORTGAGE REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS vl_mortgage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID UNIQUE NOT NULL REFERENCES vl_deals(id) ON DELETE CASCADE,

  application_type_code INT REFERENCES vl_application_types(code),
  purpose_code INT REFERENCES vl_mortgage_purposes(code),
  lender_name TEXT,
  payment DECIMAL(15, 2),
  maturity_date DATE,
  approved BOOLEAN,
  interest_adjustment_date DATE,
  first_payment_date DATE,
  amortization INT, -- Years
  amortization_months INT,
  term_in_months INT,
  net_rate DECIMAL(8, 4),
  rate_type_code INT REFERENCES vl_rate_types(code),
  payment_frequency_code INT REFERENCES vl_payment_frequencies(code),
  rate DECIMAL(8, 4),
  discount_rate DECIMAL(8, 4),
  premium_rate DECIMAL(8, 4),
  buy_down_rate DECIMAL(8, 4),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_mortgage_requests_deal ON vl_mortgage_requests(deal_id);

-- ============================================
-- MORTGAGES (individual mortgage amounts)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_mortgages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mortgage_request_id UUID NOT NULL REFERENCES vl_mortgage_requests(id) ON DELETE CASCADE,
  mortgage_index INT NOT NULL,

  amount DECIMAL(15, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(mortgage_request_id, mortgage_index)
);

CREATE INDEX IF NOT EXISTS idx_vl_mortgages_request ON vl_mortgages(mortgage_request_id);

-- ============================================
-- CONDITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS vl_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES vl_deals(id) ON DELETE CASCADE,
  condition_index INT NOT NULL,
  condition_type TEXT DEFAULT 'broker', -- 'broker' or 'lender'

  name TEXT,
  is_sent BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(deal_id, condition_type, condition_index)
);

CREATE INDEX IF NOT EXISTS idx_vl_conditions_deal ON vl_conditions(deal_id);

-- ============================================
-- NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES vl_deals(id) ON DELETE CASCADE,
  note_index INT NOT NULL,

  text TEXT,
  date_created TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(deal_id, note_index)
);

CREATE INDEX IF NOT EXISTS idx_vl_notes_deal ON vl_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_vl_notes_date ON vl_notes(date_created);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION vl_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vl_deals_updated_at
  BEFORE UPDATE ON vl_deals
  FOR EACH ROW EXECUTE FUNCTION vl_update_updated_at();

CREATE TRIGGER vl_borrowers_updated_at
  BEFORE UPDATE ON vl_borrowers
  FOR EACH ROW EXECUTE FUNCTION vl_update_updated_at();
