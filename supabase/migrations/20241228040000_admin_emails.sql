-- Admin emails table (extensible, no code deploy to add admins)
CREATE TABLE admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial admins
INSERT INTO admin_emails (email) VALUES
  ('ed@bluepearl.ca'),
  ('veetesh@bluepearl.ca'),
  ('miko@bluepearlmortgage.ca'),
  ('nitesh@bluepearlmortgage.ca');

-- RLS: Anyone can check if they're admin (read own email only)
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "check_own_admin_status" ON admin_emails
  FOR SELECT USING (email = auth.jwt()->>'email');
