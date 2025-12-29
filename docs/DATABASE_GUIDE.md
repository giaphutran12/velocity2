# Velocity Database Guide

> A comprehensive guide to understand the database structure for the Velocity Data Centralization project.

---

## What is this project?

This project syncs mortgage deal data from **Velocity** (Newton's mortgage broker CRM) into **Supabase** (our PostgreSQL database). The goal is to centralize all deal data so we can:

1. Generate proposal PDFs for customers
2. Track deals across all brokers
3. Enable future features like property equity watchers

---

## The Big Picture

Think of it like this:

```
VELOCITY (External CRM)
    |
    | API calls (get deals)
    v
OUR SUPABASE DATABASE
    |
    | Queries
    v
WEB APP (show deals, generate PDFs)
```

---

## Two Types of Tables

### 1. LOOKUP TABLES (Reference Data)

These are like "dictionaries" - they store codes and their meanings. **You rarely change these.**

Think of them like a legend on a map - they explain what the codes mean.

### 2. MAIN TABLES (Actual Data)

These store the real deal data - borrowers, properties, mortgages, etc. **These get updated constantly during sync.**

---

# LOOKUP TABLES (14 total)

All lookup tables follow the same pattern:
- `code` = the number (what's stored in main tables)
- `name` = human-readable text (what the code means)

---

## vl_deal_statuses

**What it stores:** The status of a mortgage deal

| code | name | What it means |
|------|------|---------------|
| 0 | Lead | Just came in, haven't started |
| 1 | New | New application, working on it |
| 2 | Submitted | Sent to lender for approval |
| 3 | Approved | Lender said yes! |
| 4 | Accepted | Client accepted the offer |
| 5 | Waiting To Close | Paperwork in progress |
| 6 | Funded | Money sent! |
| 7 | Complete | All done |
| 8 | Parked | On hold for now |
| 9 | Cancelled | Client cancelled |
| 10 | Declined | Lender said no |

**Used by:** `vl_deals.status_code`

---

## vl_liability_types

**What it stores:** Types of debts a borrower might have

| code | name |
|------|------|
| 1 | Mortgage |
| 2 | Credit Card |
| 3 | Personal Loan |
| 4 | Auto Loan |
| 5 | HELOC |
| 6 | Other Secured |
| 7 | Student Loan |
| 8 | Alimony/Child Support |
| 9 | Collections |
| 10 | Line of Credit |
| 11 | Government/Tax Debt |
| 12 | Medical Debt |
| 13 | Unsecured Line of Credit |
| 14 | Auto Lease |
| 16 | Unknown Liability (16) |
| 99 | Unknown |

**Used by:** `vl_borrower_liabilities.type_code`

---

## vl_countries

**What it stores:** Country codes

| code | name | iso_code |
|------|------|----------|
| 1 | Canada | CA |
| 2 | United States | US |

**Used by:** Any address field with `country_code`

---

## vl_provinces

**What it stores:** Provinces and states

**Canadian Provinces (codes 1-13):**

| code | name | abbreviation | country_code |
|------|------|--------------|--------------|
| 1 | Alberta | AB | 1 |
| 2 | British Columbia | BC | 1 |
| 3 | Manitoba | MB | 1 |
| 4 | New Brunswick | NB | 1 |
| 5 | Newfoundland and Labrador | NL | 1 |
| 6 | Northwest Territories | NT | 1 |
| 7 | Nova Scotia | NS | 1 |
| 8 | Nunavut | NU | 1 |
| 9 | Ontario | ON | 1 |
| 10 | Prince Edward Island | PE | 1 |
| 11 | Quebec | QC | 1 |
| 12 | Saskatchewan | SK | 1 |
| 13 | Yukon | YT | 1 |

**US States (codes 14-64):** All 50 states + DC with country_code = 2

**Used by:** Any address field with `province_code`

---

## vl_street_directions

**What it stores:** Street direction suffixes/prefixes

| code | name | abbreviation |
|------|------|--------------|
| 1 | North | N |
| 2 | North East | NE |
| 3 | East | E |
| 4 | South East | SE |
| 5 | South | S |
| 6 | South West | SW |
| 7 | West | W |
| 8 | North West | NW |

**Used by:** Any address field with `street_direction_code`

---

## vl_street_types

**What it stores:** Street type suffixes (Avenue, Street, etc.)

100+ entries including:
- 60 = Avenue
- 100 = Boulevard
- 210 = Circle
- 320 = Crescent
- 400 = Drive
- 630 = Highway
- 730 = Lane
- 970 = Place
- 1110 = Road
- 1210 = Street
- 1280 = Trail
- 1380 = Way

**Used by:** Any address field with `street_type_code`

---

## vl_income_types

**What it stores:** How a borrower earns money

| code | name |
|------|------|
| 1 | Commissions |
| 2 | Hourly |
| 3 | Hourly Plus Commissions |
| 4 | Salary |
| 5 | Self Employed |
| 6 | Other |

**Used by:** `vl_borrower_employment.income_type_code`

---

## vl_income_periods

**What it stores:** How often income is paid

| code | name |
|------|------|
| 1 | Annual |
| 2 | Bi Weekly |
| 3 | Monthly |
| 4 | Quarterly |
| 5 | Semi Annual |
| 6 | Semi Monthly |
| 7 | Weekly |

**Used by:** `vl_borrower_employment.income_period_code`

---

## vl_rate_types

**What it stores:** Types of mortgage interest rates

| code | name |
|------|------|
| 1 | Adjustable |
| 2 | Buydown |
| 3 | Capped Variable |
| 4 | Fixed |
| 5 | Variable |

**Used by:** `vl_mortgage_requests.rate_type_code`

---

## vl_payment_frequencies

**What it stores:** How often mortgage payments are made

| code | name |
|------|------|
| 1 | Bi Weekly |
| 2 | Bi Weekly Accelerated |
| 3 | Monthly |
| 4 | Semi Monthly |
| 5 | Weekly |
| 6 | Weekly Accelerated |

**Used by:** `vl_mortgage_requests.payment_frequency_code`

---

## vl_mortgage_purposes

**What it stores:** Why they need the mortgage

| code | name |
|------|------|
| 10 | Purchase |
| 20 | Refinance |
| 25 | Unknown Purpose (25) |
| 30 | Renewal |

**Used by:** `vl_mortgage_requests.purpose_code`

---

## vl_intended_uses

**What it stores:** What the property will be used for

| code | name |
|------|------|
| 1 | Owner Occupied |
| 2 | Owner Occupied And Rental |
| 3 | Rental |
| 4 | Second Home |

**Used by:** `vl_subject_properties.intended_use_code`

---

## vl_marital_statuses

**What it stores:** Borrower's marital status

| code | name |
|------|------|
| 1 | Common Law |
| 2 | Divorced |
| 3 | Married |
| 4 | Separated |
| 5 | Single |
| 6 | Widowed |

**Used by:** `vl_borrowers.marital_status_code`

---

## vl_application_types

**What it stores:** Type of mortgage application

| code | name |
|------|------|
| 1 | Purchase |
| 2 | Refinance |

**Used by:** `vl_mortgage_requests.application_type_code`

---

# MAIN TABLES (13 total)

These store the actual deal data. Here's how they connect:

```
vl_brokers (who owns the deals)
    |
    v
vl_deals (the main deal record)
    |
    +---> vl_borrowers (people applying for mortgage)
    |         |
    |         +---> vl_borrower_addresses (where they live)
    |         +---> vl_borrower_employment (where they work)
    |         +---> vl_borrower_liabilities (their debts)
    |         +---> vl_borrower_assets (their savings/assets)
    |         +---> vl_borrower_properties (properties they own)
    |
    +---> vl_subject_properties (the property being mortgaged)
    |
    +---> vl_mortgage_requests (the mortgage details)
    |         |
    |         +---> vl_mortgages (individual mortgage amounts)
    |
    +---> vl_conditions (requirements to close the deal)
    |
    +---> vl_notes (notes about the deal)
```

---

## vl_brokers

**What it stores:** Broker accounts and API credentials for syncing

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID for the broker |
| `name` | TEXT | Broker's name (e.g., "John Smith") |
| `api_key` | TEXT | Their Velocity API key (secret!) |
| `base_url` | TEXT | Velocity API URL |
| `is_active` | BOOLEAN | Can this broker sync? |
| `user_id` | UUID | Links to Supabase auth user |
| `last_sync_at` | TIMESTAMP | When they last synced |
| `last_sync_deals_count` | INT | How many deals synced |
| `last_sync_error` | TEXT | Any error from last sync |
| `created_at` | TIMESTAMP | When broker was added |
| `updated_at` | TIMESTAMP | When broker was updated |

**Important:** This table has strict security - only service role can see API keys.

---

## vl_deals

**What it stores:** The main deal/loan application record

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `loan_code` | TEXT | Velocity loan code (e.g., "VBLUE-112650") - **UNIQUE** |
| `agent` | TEXT | Agent name from Velocity |
| `status_code` | INT | Current status (see vl_deal_statuses) |
| `date_created` | TIMESTAMP | When deal was created in Velocity |
| `closing_date` | TIMESTAMP | Expected closing date |
| `link_application_id` | TEXT | Link to other systems |
| `lender_reference_number` | TEXT | Lender's reference |
| `is_confirmed_compliant` | BOOLEAN | Compliance check passed? |
| `custom_source` | TEXT | Where the lead came from |
| `broker_id` | UUID | Which broker owns this deal |
| `created_at` | TIMESTAMP | When synced to our DB |
| `updated_at` | TIMESTAMP | Last update in our DB |
| `synced_at` | TIMESTAMP | Last sync from Velocity |

**Key point:** `loan_code` is the unique identifier. If we sync the same deal twice, it updates instead of creating a duplicate.

---

## vl_borrowers

**What it stores:** People applying for the mortgage

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `deal_id` | UUID | Which deal they belong to |
| `borrower_index` | INT | Position (0 = primary, 1 = co-borrower, etc.) |
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `date_of_birth` | DATE | Birthday |
| `home_phone` | TEXT | Home phone |
| `cell_phone` | TEXT | Cell phone |
| `business_phone` | TEXT | Work phone |
| `email` | TEXT | Email address |
| `credit_score` | INT | Credit score (if available) |
| `first_time_home_buyer` | BOOLEAN | First home? |
| `marital_status_code` | INT | Marital status (see lookup) |
| `created_at` | TIMESTAMP | When synced |
| `updated_at` | TIMESTAMP | Last update |

**Key point:** A deal can have multiple borrowers. `borrower_index` keeps them in order.

---

## vl_borrower_addresses

**What it stores:** Where borrowers live (current, mailing, previous addresses)

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `borrower_id` | UUID | Which borrower |
| `address_type` | TEXT | "current", "mailing", or "previous" |
| `address_index` | INT | For multiple addresses of same type |
| `unit_number` | TEXT | Apartment/unit number |
| `street_number` | TEXT | House number |
| `street_name` | TEXT | Street name |
| `street_type_code` | INT | Street type (see lookup) |
| `street_direction_code` | INT | Direction (see lookup) |
| `city` | TEXT | City name |
| `province_code` | INT | Province/state (see lookup) |
| `postal_code` | TEXT | Postal/ZIP code |
| `country_code` | INT | Country (see lookup) |
| `created_at` | TIMESTAMP | When synced |

---

## vl_borrower_employment

**What it stores:** Where borrowers work

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `borrower_id` | UUID | Which borrower |
| `employer_name` | TEXT | Company name |
| `gross_revenue` | DECIMAL | Income amount |
| `is_current` | BOOLEAN | Still working there? |
| `income_type_code` | INT | Salary/hourly/etc (see lookup) |
| `income_period_code` | INT | Monthly/annual/etc (see lookup) |
| `emp_unit_number` | TEXT | Employer address - unit |
| `emp_street_number` | TEXT | Employer address - street number |
| `emp_street_name` | TEXT | Employer address - street name |
| `emp_street_type_code` | INT | Employer address - street type |
| `emp_street_direction_code` | INT | Employer address - direction |
| `emp_city` | TEXT | Employer address - city |
| `emp_province_code` | INT | Employer address - province |
| `emp_postal_code` | TEXT | Employer address - postal |
| `emp_country_code` | INT | Employer address - country |
| `created_at` | TIMESTAMP | When synced |

---

## vl_borrower_liabilities

**What it stores:** Borrower's debts (credit cards, loans, etc.)

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `borrower_id` | UUID | Which borrower |
| `type_code` | INT | Type of debt (see vl_liability_types) |
| `lender` | TEXT | Who they owe (e.g., "TD Bank", "VISA") |
| `in_credit_bureau` | BOOLEAN | Shows on credit report? |
| `credit_limit` | DECIMAL | Total credit limit |
| `balance` | DECIMAL | Current balance owed |
| `payment` | DECIMAL | Monthly payment |
| `override` | BOOLEAN | Manual override flag |
| `closing_date` | DATE | When it will be paid off |
| `description` | TEXT | Notes about the liability |
| `payoff_type_id` | INT | How it will be paid off |
| `created_at` | TIMESTAMP | When synced |

**Key point:** This is crucial for proposal generation - we show current debts vs. new consolidated mortgage.

---

## vl_borrower_assets

**What it stores:** Borrower's assets (savings, vehicles, investments)

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `borrower_id` | UUID | Which borrower |
| `asset_type` | TEXT | Type (e.g., "Chequing Account", "Vehicle", "RRSP") |
| `description` | TEXT | Details |
| `down_payment` | DECIMAL | Amount for down payment |
| `value` | DECIMAL | Total value |
| `created_at` | TIMESTAMP | When synced |

---

## vl_borrower_properties

**What it stores:** Properties the borrower already owns

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `borrower_id` | UUID | Which borrower |
| `occupancy_id` | INT | Occupancy type |
| `property_value` | DECIMAL | Estimated value |
| `original_date` | DATE | When purchased |
| `original_amount` | DECIMAL | Original purchase price |
| `include_in_tds` | BOOLEAN | Include in debt ratios? |
| `condo_fees_100_percent` | DECIMAL | Full condo fees |
| `annual_taxes` | DECIMAL | Property taxes per year |
| `condo_fees` | DECIMAL | Monthly condo fees |
| `condo_fees_include_heating` | BOOLEAN | Heating included? |
| `heating` | DECIMAL | Heating costs |
| `property_equity` | DECIMAL | Equity in property |
| `future_status_id` | INT | What will happen (keep/sell) |
| `unit_number` | TEXT | Address - unit |
| `street_number` | TEXT | Address - street number |
| `street_name` | TEXT | Address - street name |
| `street_type_code` | INT | Address - street type |
| `street_direction_code` | INT | Address - direction |
| `city` | TEXT | Address - city |
| `province_code` | INT | Address - province |
| `postal_code` | TEXT | Address - postal |
| `country_code` | INT | Address - country |
| `totals_value` | DECIMAL | Total property value |
| `totals_mortgages` | DECIMAL | Total mortgages |
| `totals_payments` | DECIMAL | Total payments |
| `totals_expenses` | DECIMAL | Total expenses |
| `totals_rental_income` | DECIMAL | Rental income |
| `totals_rental_expenses` | DECIMAL | Rental expenses |
| `created_at` | TIMESTAMP | When synced |

---

## vl_subject_properties

**What it stores:** THE property being mortgaged (one per deal)

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `deal_id` | UUID | Which deal (UNIQUE - only one per deal) |
| `unit_number` | TEXT | Address - unit |
| `street_number` | TEXT | Address - street number |
| `street_name` | TEXT | Address - street name |
| `street_type_code` | INT | Address - street type |
| `street_direction_code` | INT | Address - direction |
| `city` | TEXT | Address - city |
| `province_code` | INT | Address - province |
| `postal_code` | TEXT | Address - postal |
| `intended_use_code` | INT | How it will be used (see lookup) |
| `purchase_price` | DECIMAL | Purchase price |
| `tenure` | TEXT | Freehold/leasehold |
| `construction_type` | TEXT | Wood frame/concrete/etc |
| `property_type` | TEXT | Single family/condo/etc |
| `created_at` | TIMESTAMP | When synced |

**Key point:** This is different from `vl_borrower_properties`. This is the property they're getting the mortgage FOR.

---

## vl_mortgage_requests

**What it stores:** The mortgage details (one per deal)

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `deal_id` | UUID | Which deal (UNIQUE - only one per deal) |
| `application_type_code` | INT | Purchase/refinance (see lookup) |
| `purpose_code` | INT | Purpose (see lookup) |
| `lender_name` | TEXT | Which lender |
| `payment` | DECIMAL | Monthly payment |
| `maturity_date` | DATE | When mortgage ends |
| `approved` | BOOLEAN | Approved by lender? |
| `interest_adjustment_date` | DATE | Interest adjustment |
| `first_payment_date` | DATE | First payment due |
| `amortization` | INT | Amortization in years |
| `amortization_months` | INT | Amortization in months |
| `term_in_months` | INT | Term length in months |
| `net_rate` | DECIMAL | Net interest rate |
| `rate_type_code` | INT | Fixed/variable/etc (see lookup) |
| `payment_frequency_code` | INT | Monthly/bi-weekly/etc (see lookup) |
| `rate` | DECIMAL | Posted rate |
| `discount_rate` | DECIMAL | Discount from posted |
| `premium_rate` | DECIMAL | Premium added |
| `buy_down_rate` | DECIMAL | Buydown rate |
| `created_at` | TIMESTAMP | When synced |

---

## vl_mortgages

**What it stores:** Individual mortgage amounts (can have multiple per mortgage request)

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `mortgage_request_id` | UUID | Which mortgage request |
| `mortgage_index` | INT | Position (0 = first, 1 = second, etc.) |
| `amount` | DECIMAL | Mortgage amount |
| `created_at` | TIMESTAMP | When synced |

**Key point:** A mortgage request can have multiple mortgages (first mortgage, second mortgage, etc.)

---

## vl_conditions

**What it stores:** Requirements that must be met to close the deal

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `deal_id` | UUID | Which deal |
| `condition_index` | INT | Position in list |
| `condition_type` | TEXT | "broker" or "lender" |
| `name` | TEXT | The condition text |
| `is_sent` | BOOLEAN | Has it been sent? |
| `is_approved` | BOOLEAN | Has it been approved? |
| `created_at` | TIMESTAMP | When synced |

**Examples:**
- Broker condition: "Get paystubs from client"
- Lender condition: "Clear title issues"

---

## vl_notes

**What it stores:** Notes and comments about the deal

| Column | Type | What it means |
|--------|------|---------------|
| `id` | UUID | Unique ID |
| `deal_id` | UUID | Which deal |
| `note_index` | INT | Position (maintains order) |
| `text` | TEXT | The note content |
| `date_created` | TIMESTAMP | When note was originally created |
| `created_at` | TIMESTAMP | When synced to our DB |

---

## admin_emails

**What it stores:** List of admin users (for bypassing broker restrictions)

| Column | Type | What it means |
|--------|------|---------------|
| `email` | TEXT | Email address (PRIMARY KEY) |
| `created_at` | TIMESTAMP | When added |

**Current admins:**
- ed@bluepearl.ca
- veetesh@bluepearl.ca
- miko@bluepearlmortgage.ca
- nitesh@bluepearlmortgage.ca

---

# Security (Row Level Security)

## How it works

1. **Brokers can only see their own deals**
   - When a broker logs in, they only see deals where `broker_id` matches their broker record
   - All child tables (borrowers, liabilities, etc.) inherit this restriction

2. **Admins can see everything**
   - People in `admin_emails` table bypass broker restrictions
   - They can filter by broker using a dropdown

3. **API keys are protected**
   - Only the service role (backend) can read `vl_brokers.api_key`
   - Users can only see their own broker name

## The magic function

```sql
get_my_broker_id()
```

This function returns the current user's broker_id. All RLS policies use it:
- `vl_deals`: `broker_id = get_my_broker_id()`
- `vl_borrowers`: `deal_id IN (SELECT id FROM vl_deals WHERE broker_id = get_my_broker_id())`
- And so on for all tables...

---

# How Data Flows

## 1. Sync Process

```
Velocity API
    |
    | GET /v1/deals?apikey=XXX&startdate=YYYY-MM-DD
    v
/api/cron/sync (runs hourly)
    |
    | For each broker...
    v
transformer.ts
    |
    | Converts Velocity JSON to our table format
    v
sync-deal.ts
    |
    | Upsert (insert or update)
    v
Supabase Database
```

## 2. Viewing Data

```
User logs in
    |
    | Supabase Auth
    v
/app/deals/page.tsx
    |
    | Query: vl_deals + vl_borrowers + vl_brokers
    | (RLS automatically filters to their broker)
    v
Deal List shown
    |
    | Click "View Proposal"
    v
/app/deals/[loanCode]/page.tsx
    |
    | Query: vl_deals + vl_borrowers + vl_borrower_liabilities + vl_mortgage_requests
    v
Proposal Form
    |
    | Generate PDF
    v
Download HOLP PDF
```

---

# Quick Reference

## Table Prefixes

- `vl_` = Velocity data (from the CRM)
- No prefix = System tables (auth, admin)

## Key Relationships

| Child Table | Parent Table | Foreign Key |
|-------------|--------------|-------------|
| vl_deals | vl_brokers | broker_id |
| vl_borrowers | vl_deals | deal_id |
| vl_borrower_addresses | vl_borrowers | borrower_id |
| vl_borrower_employment | vl_borrowers | borrower_id |
| vl_borrower_liabilities | vl_borrowers | borrower_id |
| vl_borrower_assets | vl_borrowers | borrower_id |
| vl_borrower_properties | vl_borrowers | borrower_id |
| vl_subject_properties | vl_deals | deal_id |
| vl_mortgage_requests | vl_deals | deal_id |
| vl_mortgages | vl_mortgage_requests | mortgage_request_id |
| vl_conditions | vl_deals | deal_id |
| vl_notes | vl_deals | deal_id |

## Unique Identifiers

| Table | Unique Constraint |
|-------|-------------------|
| vl_deals | loan_code |
| vl_brokers | name |
| vl_borrowers | (deal_id, borrower_index) |
| vl_mortgages | (mortgage_request_id, mortgage_index) |
| vl_conditions | (deal_id, condition_type, condition_index) |
| vl_notes | (deal_id, note_index) |
| vl_subject_properties | deal_id (1:1) |
| vl_mortgage_requests | deal_id (1:1) |

---

# Migration Files Reference

All schema is defined in `/supabase/migrations/`:

| File | What it does |
|------|--------------|
| `20241223170001_lookup_tables.sql` | Creates all 14 lookup tables |
| `20241223170002_main_tables.sql` | Creates all 12 main data tables |
| `20241227010000_approved_to_timestamp.sql` | Changes approved to timestamp |
| `20241227030000_add_missing_lookups.sql` | Adds undocumented purpose code 25 |
| `20241227040000_add_more_purpose_codes.sql` | More purpose codes |
| `20241227050000_add_us_states.sql` | Adds US states to provinces |
| `20241227051000_fix_us_states_fips.sql` | Fixes state codes |
| `20241227060000_enable_rls.sql` | Enables Row Level Security |
| `20241227070000_brokers_table.sql` | Creates vl_brokers table |
| `20241228010000_add_user_id_to_brokers.sql` | Links brokers to auth users |
| `20241228020000_add_broker_id_to_deals.sql` | Links deals to brokers |
| `20241228030000_deals_rls_policies.sql` | Broker-scoped RLS policies |
| `20241228040000_admin_emails.sql` | Creates admin whitelist |

---

# Glossary

| Term | Definition |
|------|------------|
| **Deal** | A mortgage application/loan tracked in Velocity |
| **Borrower** | Person applying for the mortgage |
| **Subject Property** | The property being mortgaged |
| **Borrower Property** | A property the borrower already owns |
| **Liability** | Existing debt (credit card, loan, etc.) |
| **HOLP** | Home Ownership Lending Proposal (the PDF we generate) |
| **LTV** | Loan-to-Value ratio (mortgage amount / property value) |
| **RLS** | Row Level Security (database access control) |
| **Upsert** | Insert or update if exists |
| **loan_code** | Unique identifier like "VBLUE-112650" |
| **broker_id** | Links a deal to its owning broker |

---

*Last updated: December 2024*
