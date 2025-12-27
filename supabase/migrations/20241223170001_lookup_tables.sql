-- Velocity Data Migration: Lookup Tables
-- H1: Traditional Normalized ETL
-- 14 lookup tables for Velocity API enums

-- ============================================
-- DEAL STATUSES (0-10)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_deal_statuses (
  code INT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

INSERT INTO vl_deal_statuses (code, name, description) VALUES
  (0, 'Lead', 'Initial lead'),
  (1, 'New', 'New application'),
  (2, 'Submitted', 'Submitted to lender'),
  (3, 'Approved', 'Approved by lender'),
  (4, 'Accepted', 'Accepted by client'),
  (5, 'Waiting To Close', 'Pending closing'),
  (6, 'Funded', 'Mortgage funded'),
  (7, 'Complete', 'Deal complete'),
  (8, 'Parked', 'On hold'),
  (9, 'Cancelled', 'Cancelled'),
  (10, 'Declined', 'Declined by lender')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- LIABILITY TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_liability_types (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_liability_types (code, name) VALUES
  (1, 'Mortgage'),
  (2, 'Credit Card'),
  (3, 'Personal Loan'),
  (4, 'Auto Loan'),
  (5, 'HELOC'),
  (6, 'Other Secured'),
  (7, 'Student Loan'),
  (8, 'Alimony/Child Support'),
  (9, 'Collections'),
  (10, 'Line of Credit'),
  (11, 'Government/Tax Debt'),
  (12, 'Medical Debt'),
  (13, 'Unsecured Line of Credit'),
  (14, 'Auto Lease'),
  (99, 'Unknown')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- COUNTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_countries (
  code INT PRIMARY KEY,
  name TEXT NOT NULL,
  iso_code CHAR(2)
);

INSERT INTO vl_countries (code, name, iso_code) VALUES
  (1, 'Canada', 'CA'),
  (2, 'United States', 'US')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- PROVINCES/STATES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_provinces (
  code INT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT,
  country_code INT REFERENCES vl_countries(code)
);

-- Canadian Provinces
INSERT INTO vl_provinces (code, name, abbreviation, country_code) VALUES
  (1, 'Alberta', 'AB', 1),
  (2, 'British Columbia', 'BC', 1),
  (3, 'Manitoba', 'MB', 1),
  (4, 'New Brunswick', 'NB', 1),
  (5, 'Newfoundland and Labrador', 'NL', 1),
  (6, 'Northwest Territories', 'NT', 1),
  (7, 'Nova Scotia', 'NS', 1),
  (8, 'Nunavut', 'NU', 1),
  (9, 'Ontario', 'ON', 1),
  (10, 'Prince Edward Island', 'PE', 1),
  (11, 'Quebec', 'QC', 1),
  (12, 'Saskatchewan', 'SK', 1),
  (13, 'Yukon', 'YT', 1)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STREET DIRECTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS vl_street_directions (
  code INT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT
);

INSERT INTO vl_street_directions (code, name, abbreviation) VALUES
  (1, 'North', 'N'),
  (2, 'North East', 'NE'),
  (3, 'East', 'E'),
  (4, 'South East', 'SE'),
  (5, 'South', 'S'),
  (6, 'South West', 'SW'),
  (7, 'West', 'W'),
  (8, 'North West', 'NW')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STREET TYPES (common ones from data)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_street_types (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_street_types (code, name) VALUES
  (10, 'Abbey'), (20, 'Acres'), (30, 'Allee'), (40, 'Alley'),
  (50, 'Autoroute'), (60, 'Avenue'), (70, 'Bay'), (80, 'Beach'),
  (90, 'Bend'), (100, 'Boulevard'), (110, 'By Pass'), (120, 'Byway'),
  (130, 'Campus'), (140, 'Cape'), (150, 'Carre'), (160, 'Carrefour'),
  (170, 'Centre'), (180, 'Cercle'), (190, 'Chase'), (200, 'Chemin'),
  (210, 'Circle'), (220, 'Circuit'), (230, 'Close'), (240, 'Common'),
  (250, 'Concession'), (260, 'Corners'), (270, 'Cote'), (280, 'Cour'),
  (290, 'Cours'), (300, 'Court'), (310, 'Cove'), (320, 'Crescent'),
  (330, 'Croissant'), (340, 'Crossing'), (350, 'Cul De Sac'), (360, 'Dale'),
  (370, 'Dell'), (380, 'Diversion'), (390, 'Downs'), (400, 'Drive'),
  (410, 'End'), (420, 'Esplanade'), (430, 'Estates'), (440, 'Expressway'),
  (450, 'Extension'), (460, 'Farm'), (470, 'Field'), (480, 'Forest'),
  (490, 'Freeway'), (500, 'Front'), (510, 'Gardens'), (520, 'Gate'),
  (530, 'Glade'), (540, 'Glen'), (550, 'Green'), (560, 'Grounds'),
  (570, 'Grove'), (580, 'Harbour'), (590, 'Haven'), (600, 'Heath'),
  (610, 'Heights'), (620, 'Highlands'), (630, 'Highway'), (640, 'Hill'),
  (650, 'Hollow'), (660, 'Ile'), (670, 'Impasse'), (680, 'Inlet'),
  (690, 'Island'), (700, 'Key'), (710, 'Knoll'), (720, 'Landing'),
  (730, 'Lane'), (740, 'Limits'), (750, 'Line'), (760, 'Link'),
  (770, 'Lookout'), (780, 'Loop'), (790, 'Mall'), (800, 'Manor'),
  (810, 'Maze'), (820, 'Meadow'), (830, 'Mews'), (840, 'Montee'),
  (850, 'Moor'), (860, 'Mount'), (870, 'Mountain'), (880, 'Orchard'),
  (890, 'Parade'), (900, 'Parc'), (910, 'Park'), (920, 'Parkway'),
  (930, 'Passage'), (940, 'Path'), (950, 'Pathway'), (960, 'Pines'),
  (970, 'Place'), (980, 'Plateau'), (990, 'Plaza'), (1000, 'Point'),
  (1010, 'Pointe'), (1020, 'Port'), (1030, 'Private'), (1040, 'Promenade'),
  (1050, 'Quay'), (1060, 'Ramp'), (1070, 'Rang'), (1080, 'Range'),
  (1090, 'Ridge'), (1100, 'Rise'), (1110, 'Road'), (1120, 'Route'),
  (1130, 'Row'), (1140, 'Rue'), (1150, 'Ruelle'), (1160, 'Run'),
  (1170, 'Section'), (1180, 'Sentier'), (1190, 'Square'), (1200, 'Stroll'),
  (1210, 'Street'), (1220, 'Subdivision'), (1230, 'Terrace'), (1240, 'Terrasse'),
  (1250, 'Thicket'), (1260, 'Towers'), (1270, 'Townline'), (1280, 'Trail'),
  (1290, 'Turnabout'), (1300, 'Vale'), (1310, 'Via'), (1320, 'View'),
  (1330, 'Village'), (1340, 'Villas'), (1350, 'Vista'), (1360, 'Voie'),
  (1370, 'Walk'), (1380, 'Way'), (1390, 'Wharf'), (1400, 'Wood'),
  (1410, 'Wynd')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- INCOME TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_income_types (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_income_types (code, name) VALUES
  (1, 'Commissions'),
  (2, 'Hourly'),
  (3, 'Hourly Plus Commissions'),
  (4, 'Salary'),
  (5, 'Self Employed'),
  (6, 'Other')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- INCOME PERIODS
-- ============================================
CREATE TABLE IF NOT EXISTS vl_income_periods (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_income_periods (code, name) VALUES
  (1, 'Annual'),
  (2, 'Bi Weekly'),
  (3, 'Monthly'),
  (4, 'Quarterly'),
  (5, 'Semi Annual'),
  (6, 'Semi Monthly'),
  (7, 'Weekly')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- RATE TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_rate_types (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_rate_types (code, name) VALUES
  (1, 'Adjustable'),
  (2, 'Buydown'),
  (3, 'Capped Variable'),
  (4, 'Fixed'),
  (5, 'Variable')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- PAYMENT FREQUENCIES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_payment_frequencies (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_payment_frequencies (code, name) VALUES
  (1, 'Bi Weekly'),
  (2, 'Bi Weekly Accelerated'),
  (3, 'Monthly'),
  (4, 'Semi Monthly'),
  (5, 'Weekly'),
  (6, 'Weekly Accelerated')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- MORTGAGE PURPOSES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_mortgage_purposes (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_mortgage_purposes (code, name) VALUES
  (10, 'Purchase'),
  (20, 'Refinance'),
  (30, 'Renewal')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- INTENDED USES (Property)
-- ============================================
CREATE TABLE IF NOT EXISTS vl_intended_uses (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_intended_uses (code, name) VALUES
  (1, 'Owner Occupied'),
  (2, 'Owner Occupied And Rental'),
  (3, 'Rental'),
  (4, 'Second Home')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- MARITAL STATUSES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_marital_statuses (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_marital_statuses (code, name) VALUES
  (1, 'Common Law'),
  (2, 'Divorced'),
  (3, 'Married'),
  (4, 'Separated'),
  (5, 'Single'),
  (6, 'Widowed')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- APPLICATION TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS vl_application_types (
  code INT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO vl_application_types (code, name) VALUES
  (1, 'Purchase'),
  (2, 'Refinance')
ON CONFLICT (code) DO NOTHING;
