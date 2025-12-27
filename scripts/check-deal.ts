/**
 * Check a specific deal's liabilities
 * Usage: npx tsx scripts/check-deal.ts VBLUE-113033
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const loanCode = process.argv[2];

if (!loanCode) {
  console.error("Usage: npx tsx scripts/check-deal.ts VBLUE-113033");
  process.exit(1);
}

async function checkDeal() {
  console.log(`\n=== Checking Deal ${loanCode} ===\n`);

  // Get deal with broker
  const { data: deal, error: dealError } = await supabase
    .from("vl_deals")
    .select(`id, loan_code, broker:vl_brokers(name)`)
    .eq("loan_code", loanCode)
    .single();

  if (dealError || !deal) {
    console.error("Deal not found:", dealError);
    return;
  }

  console.log(`Deal ID: ${deal.id}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker = deal.broker as any;
  console.log(`Broker: ${broker?.name || "Unknown"}`);

  // Get borrowers
  const { data: borrowers } = await supabase
    .from("vl_borrowers")
    .select(`id, first_name, last_name`)
    .eq("deal_id", deal.id);

  console.log(`Borrowers: ${borrowers?.length || 0}`);

  for (const b of borrowers || []) {
    console.log(`\n--- ${b.first_name} ${b.last_name} ---`);

    // Get liabilities
    const { data: liabilities } = await supabase
      .from("vl_borrower_liabilities")
      .select(`id, type_code, lender, balance, payment`)
      .eq("borrower_id", b.id);

    console.log(`Liabilities: ${liabilities?.length || 0}`);

    if (liabilities?.length) {
      for (const l of liabilities) {
        console.log(`  - ${l.lender || "Unknown"}: $${l.balance} ($${l.payment}/mo)`);
      }

      // Check for duplicates
      const uniqueKeys = new Set(
        liabilities.map(l => `${l.type_code}|${l.lender}|${l.balance}`)
      );
      if (liabilities.length > uniqueKeys.size) {
        console.log(`  ⚠️  DUPLICATES: ${liabilities.length - uniqueKeys.size} extra rows`);
      }
    }
  }
}

checkDeal().catch(console.error);
