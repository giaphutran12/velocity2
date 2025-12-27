-- RLS Policies for broker-scoped data access
-- Fixes: drops public_read from data tables, adds broker-scoped policies to ALL tables

-- =============================================================================
-- STEP 1: Drop public_read policies from DATA tables (not lookup tables)
-- Lookup tables (vl_deal_statuses, vl_countries, etc.) keep public_read
-- =============================================================================

DROP POLICY IF EXISTS "public_read" ON vl_deals;
DROP POLICY IF EXISTS "public_read" ON vl_borrowers;
DROP POLICY IF EXISTS "public_read" ON vl_borrower_addresses;
DROP POLICY IF EXISTS "public_read" ON vl_borrower_employment;
DROP POLICY IF EXISTS "public_read" ON vl_borrower_liabilities;
DROP POLICY IF EXISTS "public_read" ON vl_borrower_assets;
DROP POLICY IF EXISTS "public_read" ON vl_borrower_properties;
DROP POLICY IF EXISTS "public_read" ON vl_subject_properties;
DROP POLICY IF EXISTS "public_read" ON vl_mortgage_requests;
DROP POLICY IF EXISTS "public_read" ON vl_mortgages;
DROP POLICY IF EXISTS "public_read" ON vl_conditions;
DROP POLICY IF EXISTS "public_read" ON vl_notes;

-- =============================================================================
-- STEP 2: Create helper function to get current user's broker_id
-- This avoids repeated subqueries and improves performance
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_broker_id()
RETURNS UUID AS $$
  SELECT id FROM vl_brokers WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- STEP 3: Drop any existing broker policies (idempotent)
-- =============================================================================

DROP POLICY IF EXISTS "Brokers see own deals" ON vl_deals;
DROP POLICY IF EXISTS "Brokers see own borrowers" ON vl_borrowers;
DROP POLICY IF EXISTS "Brokers see own borrower addresses" ON vl_borrower_addresses;
DROP POLICY IF EXISTS "Brokers see own borrower employment" ON vl_borrower_employment;
DROP POLICY IF EXISTS "Brokers see own borrower liabilities" ON vl_borrower_liabilities;
DROP POLICY IF EXISTS "Brokers see own borrower assets" ON vl_borrower_assets;
DROP POLICY IF EXISTS "Brokers see own borrower properties" ON vl_borrower_properties;
DROP POLICY IF EXISTS "Brokers see own subject properties" ON vl_subject_properties;
DROP POLICY IF EXISTS "Brokers see own mortgage requests" ON vl_mortgage_requests;
DROP POLICY IF EXISTS "Brokers see own mortgages" ON vl_mortgages;
DROP POLICY IF EXISTS "Brokers see own conditions" ON vl_conditions;
DROP POLICY IF EXISTS "Brokers see own notes" ON vl_notes;

-- =============================================================================
-- STEP 4: Create broker-scoped policies for all data tables
-- =============================================================================

-- vl_deals: Direct broker_id check
CREATE POLICY "Brokers see own deals" ON vl_deals
  FOR SELECT
  USING (broker_id = get_my_broker_id());

-- vl_borrowers: Check via deal_id → broker_id
CREATE POLICY "Brokers see own borrowers" ON vl_borrowers
  FOR SELECT
  USING (
    deal_id IN (SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id())
  );

-- vl_borrower_addresses: Check via borrower_id → deal_id → broker_id
CREATE POLICY "Brokers see own borrower addresses" ON vl_borrower_addresses
  FOR SELECT
  USING (
    borrower_id IN (
      SELECT id FROM vl_borrowers WHERE deal_id IN (
        SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id()
      )
    )
  );

-- vl_borrower_employment: Check via borrower_id → deal_id → broker_id
CREATE POLICY "Brokers see own borrower employment" ON vl_borrower_employment
  FOR SELECT
  USING (
    borrower_id IN (
      SELECT id FROM vl_borrowers WHERE deal_id IN (
        SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id()
      )
    )
  );

-- vl_borrower_liabilities: Check via borrower_id → deal_id → broker_id
CREATE POLICY "Brokers see own borrower liabilities" ON vl_borrower_liabilities
  FOR SELECT
  USING (
    borrower_id IN (
      SELECT id FROM vl_borrowers WHERE deal_id IN (
        SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id()
      )
    )
  );

-- vl_borrower_assets: Check via borrower_id → deal_id → broker_id
CREATE POLICY "Brokers see own borrower assets" ON vl_borrower_assets
  FOR SELECT
  USING (
    borrower_id IN (
      SELECT id FROM vl_borrowers WHERE deal_id IN (
        SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id()
      )
    )
  );

-- vl_borrower_properties: Check via borrower_id → deal_id → broker_id
CREATE POLICY "Brokers see own borrower properties" ON vl_borrower_properties
  FOR SELECT
  USING (
    borrower_id IN (
      SELECT id FROM vl_borrowers WHERE deal_id IN (
        SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id()
      )
    )
  );

-- vl_subject_properties: Check via deal_id → broker_id
CREATE POLICY "Brokers see own subject properties" ON vl_subject_properties
  FOR SELECT
  USING (
    deal_id IN (SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id())
  );

-- vl_mortgage_requests: Check via deal_id → broker_id
CREATE POLICY "Brokers see own mortgage requests" ON vl_mortgage_requests
  FOR SELECT
  USING (
    deal_id IN (SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id())
  );

-- vl_mortgages: Check via mortgage_request_id → deal_id → broker_id
CREATE POLICY "Brokers see own mortgages" ON vl_mortgages
  FOR SELECT
  USING (
    mortgage_request_id IN (
      SELECT id FROM vl_mortgage_requests WHERE deal_id IN (
        SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id()
      )
    )
  );

-- vl_conditions: Check via deal_id → broker_id
CREATE POLICY "Brokers see own conditions" ON vl_conditions
  FOR SELECT
  USING (
    deal_id IN (SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id())
  );

-- vl_notes: Check via deal_id → broker_id
CREATE POLICY "Brokers see own notes" ON vl_notes
  FOR SELECT
  USING (
    deal_id IN (SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id())
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION get_my_broker_id() IS 'Returns the broker_id for the current authenticated user';
