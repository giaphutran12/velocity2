-- Add broker_id column to vl_deals to track which broker owns each deal
ALTER TABLE vl_deals ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES vl_brokers(id);

-- Create index for fast lookup by broker_id
CREATE INDEX IF NOT EXISTS idx_vl_deals_broker_id ON vl_deals(broker_id);

COMMENT ON COLUMN vl_deals.broker_id IS 'Links deal to the broker who created it in Velocity';
