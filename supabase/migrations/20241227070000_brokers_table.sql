-- Velocity Brokers Table
-- Stores API credentials for each broker to enable automated sync

CREATE TABLE IF NOT EXISTS vl_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT 'https://api-velocity.newton.ca/api/forms',
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_sync_deals_count INT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vl_brokers_active ON vl_brokers(is_active);
CREATE INDEX IF NOT EXISTS idx_vl_brokers_name ON vl_brokers(name);

-- RLS
ALTER TABLE vl_brokers ENABLE ROW LEVEL SECURITY;

-- Only service role can access (contains API keys)
CREATE POLICY "Service role only" ON vl_brokers
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE vl_brokers IS 'Velocity broker API credentials for automated sync';
