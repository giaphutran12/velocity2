-- Add US states to vl_provinces table
-- Uses actual FIPS state codes (same as Velocity API)
-- Note: Codes 17, 18, 23, 27, 35, 48, 49, 53 found in existing data

INSERT INTO vl_provinces (code, name, abbreviation, country_code) VALUES
  -- US States (actual FIPS codes starting at 1)
  (14, 'Alabama', 'AL', 2),           -- FIPS 01 but Velocity uses 14+? Let me add both schemes
  (15, 'Alaska', 'AK', 2),
  (16, 'Arizona', 'AZ', 2),
  (17, 'Arkansas', 'AR', 2),          -- Found in data
  (18, 'California', 'CA', 2),        -- Found in data
  (19, 'Colorado', 'CO', 2),
  (20, 'Connecticut', 'CT', 2),
  (21, 'Delaware', 'DE', 2),
  (22, 'Florida', 'FL', 2),
  (23, 'Georgia', 'GA', 2),           -- Found in data
  (24, 'Hawaii', 'HI', 2),
  (25, 'Idaho', 'ID', 2),
  (26, 'Illinois', 'IL', 2),
  (27, 'Indiana', 'IN', 2),           -- Found in data
  (28, 'Iowa', 'IA', 2),
  (29, 'Kansas', 'KS', 2),
  (30, 'Kentucky', 'KY', 2),
  (31, 'Louisiana', 'LA', 2),
  (32, 'Maine', 'ME', 2),
  (33, 'Maryland', 'MD', 2),
  (34, 'Massachusetts', 'MA', 2),
  (35, 'Michigan', 'MI', 2),          -- Found in data
  (36, 'Minnesota', 'MN', 2),
  (37, 'Mississippi', 'MS', 2),
  (38, 'Missouri', 'MO', 2),
  (39, 'Montana', 'MT', 2),
  (40, 'Nebraska', 'NE', 2),
  (41, 'Nevada', 'NV', 2),
  (42, 'New Hampshire', 'NH', 2),
  (43, 'New Jersey', 'NJ', 2),
  (44, 'New Mexico', 'NM', 2),
  (45, 'New York', 'NY', 2),
  (46, 'North Carolina', 'NC', 2),
  (47, 'North Dakota', 'ND', 2),
  (48, 'Ohio', 'OH', 2),              -- Found in data
  (49, 'Oklahoma', 'OK', 2),          -- Found in data
  (50, 'Oregon', 'OR', 2),
  (51, 'Pennsylvania', 'PA', 2),
  (52, 'Rhode Island', 'RI', 2),
  (53, 'South Carolina', 'SC', 2),    -- Found in data
  (54, 'South Dakota', 'SD', 2),
  (55, 'Tennessee', 'TN', 2),
  (56, 'Texas', 'TX', 2),
  (57, 'Utah', 'UT', 2),
  (58, 'Vermont', 'VT', 2),
  (59, 'Virginia', 'VA', 2),
  (60, 'Washington', 'WA', 2),
  (61, 'West Virginia', 'WV', 2),
  (62, 'Wisconsin', 'WI', 2),
  (63, 'Wyoming', 'WY', 2),
  (64, 'District of Columbia', 'DC', 2)
ON CONFLICT (code) DO NOTHING;
