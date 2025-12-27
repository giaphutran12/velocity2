-- Fix US states - use correct Velocity API codes (14-56)
-- Source: https://developer.newton.ca/velocity/v1/index.html (ProvincesOrStates enum)
-- Verified codes in data: 17=Illinois, 18=Indiana, 23=Maine, 27=Michigan,
--                         35=New Jersey, 48=Tennessee, 49=Texas, 53=Washington

-- Delete incorrect mappings from previous migration
DELETE FROM vl_provinces WHERE code >= 14 AND country_code = 2;

-- Insert correct Velocity API codes (verified from docs)
INSERT INTO vl_provinces (code, name, abbreviation, country_code) VALUES
  (14, 'Guam', 'GU', 2),
  (15, 'Hawaii', 'HI', 2),
  (16, 'Idaho', 'ID', 2),
  (17, 'Illinois', 'IL', 2),           -- Found in data
  (18, 'Indiana', 'IN', 2),            -- Found in data
  (19, 'Iowa', 'IA', 2),
  (20, 'Kansas', 'KS', 2),
  (21, 'Kentucky', 'KY', 2),
  (22, 'Louisiana', 'LA', 2),
  (23, 'Maine', 'ME', 2),              -- Found in data
  (24, 'Marshall Islands', 'MH', 2),
  (25, 'Maryland', 'MD', 2),
  (26, 'Massachusetts', 'MA', 2),
  (27, 'Michigan', 'MI', 2),           -- Found in data
  (28, 'Minnesota', 'MN', 2),
  (29, 'Mississippi', 'MS', 2),
  (30, 'Missouri', 'MO', 2),
  (31, 'Montana', 'MT', 2),
  (32, 'Nebraska', 'NE', 2),
  (33, 'Nevada', 'NV', 2),
  (34, 'New Hampshire', 'NH', 2),
  (35, 'New Jersey', 'NJ', 2),         -- Found in data
  (36, 'New Mexico', 'NM', 2),
  (37, 'New York', 'NY', 2),
  (38, 'North Carolina', 'NC', 2),
  (39, 'North Dakota', 'ND', 2),
  (40, 'Ohio', 'OH', 2),
  (41, 'Oklahoma', 'OK', 2),
  (42, 'Oregon', 'OR', 2),
  (43, 'Pennsylvania', 'PA', 2),
  (44, 'Puerto Rico', 'PR', 2),
  (45, 'Rhode Island', 'RI', 2),
  (46, 'South Carolina', 'SC', 2),
  (47, 'South Dakota', 'SD', 2),
  (48, 'Tennessee', 'TN', 2),          -- Found in data
  (49, 'Texas', 'TX', 2),              -- Found in data
  (50, 'Utah', 'UT', 2),
  (51, 'Vermont', 'VT', 2),
  (52, 'Virginia', 'VA', 2),
  (53, 'Washington', 'WA', 2),         -- Found in data (Peace Health!)
  (54, 'West Virginia', 'WV', 2),
  (55, 'Wisconsin', 'WI', 2),
  (56, 'Wyoming', 'WY', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  abbreviation = EXCLUDED.abbreviation,
  country_code = EXCLUDED.country_code;
