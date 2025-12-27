-- Add user_id column to vl_brokers for linking auth users to brokers
ALTER TABLE vl_brokers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_vl_brokers_user_id ON vl_brokers(user_id);

-- Ensure one user can only be linked to one broker
CREATE UNIQUE INDEX IF NOT EXISTS idx_vl_brokers_user_id_unique ON vl_brokers(user_id) WHERE user_id IS NOT NULL;

-- Update RLS policy to allow authenticated users to read their own broker
DROP POLICY IF EXISTS "Service role only" ON vl_brokers;

-- Authenticated users can read their own broker (by user_id)
CREATE POLICY "Users can read own broker" ON vl_brokers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can read unclaimed brokers (for registration picklist)
CREATE POLICY "Users can read unclaimed brokers" ON vl_brokers
  FOR SELECT
  USING (user_id IS NULL AND auth.role() = 'authenticated');

-- Allow users to claim an unclaimed broker (update user_id from null)
CREATE POLICY "Users can claim unclaimed broker" ON vl_brokers
  FOR UPDATE
  USING (user_id IS NULL AND auth.role() = 'authenticated')
  WITH CHECK (user_id = auth.uid());

COMMENT ON COLUMN vl_brokers.user_id IS 'Links broker to auth.users for authentication';
