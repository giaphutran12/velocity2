/**
 * Check for duplicate liabilities in the database
 * Usage: npx tsx scripts/check-duplicates.ts [--broker "Nav Cheema"]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config(); // loads from .env by default

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CLI args
const args = process.argv.slice(2);
const brokerIdx = args.indexOf("--broker");
const brokerFilter = brokerIdx !== -1 ? args[brokerIdx + 1] : null;

async function checkDuplicates() {
  console.log("\n=== Checking for Duplicate Liabilities ===\n");

  // Get all liabilities with borrower and deal info
  let query = supabase
    .from("vl_borrower_liabilities")
    .select(`
      id,
      type_code,
      lender,
      balance,
      borrower:vl_borrowers!inner(
        id,
        first_name,
        last_name,
        deal:vl_deals!inner(
          loan_code,
          broker:vl_brokers(name)
        )
      )
    `);

  // Supabase default limit is 1000 - need to fetch all
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allLiabilities: any[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: page, error: pageError } = await query.range(offset, offset + pageSize - 1);
    if (pageError) {
      console.error("Error fetching liabilities:", pageError);
      process.exit(1);
    }
    if (!page || page.length === 0) break;
    allLiabilities = allLiabilities.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
    console.log(`  Fetched ${allLiabilities.length} liabilities...`);
  }

  const liabilities = allLiabilities;
  const error = null;

  if (error) {
    console.error("Error fetching liabilities:", error);
    process.exit(1);
  }

  if (!liabilities || liabilities.length === 0) {
    console.log("No liabilities found.");
    return;
  }

  // Group by borrower and find duplicates
  const borrowerLiabilities = new Map<string, {
    borrowerId: string;
    borrowerName: string;
    loanCode: string;
    brokerName: string;
    liabilities: typeof liabilities;
  }>();

  for (const l of liabilities) {
    const borrower = l.borrower as { id: string; first_name: string; last_name: string; deal: { loan_code: string; broker: { name: string } | null } };
    const borrowerId = borrower.id;
    const brokerName = borrower.deal.broker?.name || "Unknown";

    // Filter by broker if specified
    if (brokerFilter && !brokerName.toLowerCase().includes(brokerFilter.toLowerCase())) {
      continue;
    }

    if (!borrowerLiabilities.has(borrowerId)) {
      borrowerLiabilities.set(borrowerId, {
        borrowerId,
        borrowerName: `${borrower.first_name} ${borrower.last_name}`,
        loanCode: borrower.deal.loan_code,
        brokerName,
        liabilities: [],
      });
    }
    borrowerLiabilities.get(borrowerId)!.liabilities.push(l);
  }

  // Find borrowers with duplicates
  const duplicates: {
    borrowerId: string;
    borrowerName: string;
    loanCode: string;
    brokerName: string;
    totalCount: number;
    uniqueCount: number;
  }[] = [];

  for (const [, data] of borrowerLiabilities) {
    // Count unique liabilities by type+lender+balance
    const uniqueKeys = new Set(
      data.liabilities.map(l => `${l.type_code}|${l.lender}|${l.balance}`)
    );

    if (data.liabilities.length > uniqueKeys.size) {
      duplicates.push({
        borrowerId: data.borrowerId,
        borrowerName: data.borrowerName,
        loanCode: data.loanCode,
        brokerName: data.brokerName,
        totalCount: data.liabilities.length,
        uniqueCount: uniqueKeys.size,
      });
    }
  }

  // Sort by most duplicates
  duplicates.sort((a, b) => (b.totalCount - b.uniqueCount) - (a.totalCount - a.uniqueCount));

  // Summary
  console.log(`Broker filter: ${brokerFilter || "ALL"}`);
  console.log(`Total borrowers checked: ${borrowerLiabilities.size}`);
  console.log(`Borrowers with duplicates: ${duplicates.length}`);

  const affectedDeals = new Set(duplicates.map(d => d.loanCode));
  console.log(`Affected deals: ${affectedDeals.size}`);

  if (duplicates.length > 0) {
    console.log("\n--- Top 20 Borrowers with Duplicates ---\n");
    console.log("Loan Code       | Broker                 | Borrower Name          | Total | Unique | Dupes");
    console.log("-".repeat(95));

    for (const d of duplicates.slice(0, 20)) {
      const dupes = d.totalCount - d.uniqueCount;
      console.log(
        `${d.loanCode.padEnd(15)} | ${d.brokerName.slice(0, 22).padEnd(22)} | ${d.borrowerName.slice(0, 22).padEnd(22)} | ${String(d.totalCount).padStart(5)} | ${String(d.uniqueCount).padStart(6)} | ${String(dupes).padStart(5)}`
      );
    }

    if (duplicates.length > 20) {
      console.log(`\n... and ${duplicates.length - 20} more borrowers with duplicates`);
    }

    // List affected loan codes
    console.log("\n--- Affected Loan Codes (for re-sync) ---\n");
    console.log([...affectedDeals].join("\n"));
  } else {
    console.log("\n✅ No duplicates found!");
  }
}

checkDuplicates().catch(console.error);
