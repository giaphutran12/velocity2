-- ============================================
-- Add missing lookup values discovered during batch sync
-- ============================================
-- Context: Nav Cheema analysis revealed 12 FK violations
-- Source: scripts/failure-analysis.json (2025-12-27)
--
-- Velocity API docs (https://developer.newton.ca/velocity/v1/index.html)
-- only document these mortgage purpose codes:
--   10 = Purchase
--   20 = Refinance
--   30 = Renew
--
-- However, real API data contains additional undocumented codes.
-- We add them here to prevent FK violations during sync.
-- ============================================

-- ============================================
-- MORTGAGE PURPOSE CODE 25
-- ============================================
-- Affected deals: VBLUE-89538, VBLUE-90259, VBLUE-99403, VBLUE-102362,
--                 VBLUE-102368, VBLUE-103079, VBLUE-103751, VBLUE-110715, VBLUE-110716
-- Error: "violates foreign key constraint vl_mortgage_requests_purpose_code_fkey"
--
-- This code appears in deals with:
--   - applicationType: 2 (Refinance)
--   - lenderName: "Private Lender" (in some cases)
--   - Possibly represents "Equity Take Out" or similar refinance variant
--
-- NOT DOCUMENTED in Velocity API docs as of 2025-12-27
INSERT INTO vl_mortgage_purposes (code, name) VALUES
  (25, 'Unknown Purpose (25)')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- LIABILITY TYPE CODE 16
-- ============================================
-- Affected deals: VBLUE-87205, VBLUE-102050, VBLUE-107737
-- Error: "violates foreign key constraint vl_borrower_liabilities_type_code_fkey"
--
-- Documented liability types in our schema: 1-14, 99
-- Code 16 appears in borrower liability records but is not documented
--
-- NOT DOCUMENTED in Velocity API docs as of 2025-12-27
INSERT INTO vl_liability_types (code, name) VALUES
  (16, 'Unknown Liability (16)')
ON CONFLICT (code) DO NOTHING;
