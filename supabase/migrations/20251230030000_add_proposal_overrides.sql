-- Add proposal_overrides JSONB column to vl_deals for broker customizations
-- This stores overrides for:
--   - Mortgage parameters (rate, amount, term, amortization)
--   - Liability edits (balance, payment, impacts_credit, excluded)

ALTER TABLE vl_deals
ADD COLUMN IF NOT EXISTS proposal_overrides JSONB DEFAULT NULL;

COMMENT ON COLUMN vl_deals.proposal_overrides IS
'Broker overrides for proposal generation. Structure:
{
  "mortgage_amount": 350000,
  "interest_rate": 4.5,
  "term_months": 24,
  "amortization_months": 180,
  "estimated_fees": 13000,
  "liabilities": {
    "<liability_uuid>": {
      "balance": 9000,
      "payment": 300,
      "impacts_credit": true,
      "excluded": false
    }
  }
}';
