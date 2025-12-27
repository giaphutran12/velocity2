-- Enable RLS on all vl_ tables
-- service_role (sync API) bypasses RLS automatically
-- Public read access for now (auth decision deferred)

-- Lookup tables
ALTER TABLE vl_deal_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_liability_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_street_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_street_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_income_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_income_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_rate_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_payment_frequencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_mortgage_purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_intended_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_marital_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_application_types ENABLE ROW LEVEL SECURITY;

-- Main tables
ALTER TABLE vl_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_borrower_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_borrower_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_borrower_liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_borrower_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_borrower_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_subject_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_mortgage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_mortgages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vl_notes ENABLE ROW LEVEL SECURITY;

-- Public read access (all tables)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'vl_deal_statuses', 'vl_liability_types', 'vl_countries', 'vl_provinces',
    'vl_street_directions', 'vl_street_types', 'vl_income_types', 'vl_income_periods',
    'vl_rate_types', 'vl_payment_frequencies', 'vl_mortgage_purposes', 'vl_intended_uses',
    'vl_marital_statuses', 'vl_application_types', 'vl_deals', 'vl_borrowers',
    'vl_borrower_addresses', 'vl_borrower_employment', 'vl_borrower_liabilities',
    'vl_borrower_assets', 'vl_borrower_properties', 'vl_subject_properties',
    'vl_mortgage_requests', 'vl_mortgages', 'vl_conditions', 'vl_notes'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "public_read" ON %I FOR SELECT USING (true)', tbl);
  END LOOP;
END $$;
