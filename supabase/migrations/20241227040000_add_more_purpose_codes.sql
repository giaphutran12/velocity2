-- ============================================
-- Add more undocumented mortgage purpose codes
-- ============================================
-- Context: Retry analysis discovered 2 more undocumented codes
-- Source: scripts/retry-log.txt (2025-12-27)
-- ============================================

-- ============================================
-- MORTGAGE PURPOSE CODE 15
-- ============================================
-- Affected deals: VBLUE-90259
-- Discovered during retry of Nav Cheema failed deals
-- NOT DOCUMENTED in Velocity API docs as of 2025-12-27
INSERT INTO vl_mortgage_purposes (code, name) VALUES
  (15, 'Unknown Purpose (15)')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- MORTGAGE PURPOSE CODE 40
-- ============================================
-- Affected deals: VBLUE-103751
-- Discovered during retry of Nav Cheema failed deals
-- NOT DOCUMENTED in Velocity API docs as of 2025-12-27
INSERT INTO vl_mortgage_purposes (code, name) VALUES
  (40, 'Unknown Purpose (40)')
ON CONFLICT (code) DO NOTHING;
