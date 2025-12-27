/**
 * Clean up duplicate liabilities directly in Supabase
 *
 * For each borrower, keeps only the first occurrence of each unique liability
 * (based on type_code + lender + balance combination).
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicates.ts VBLUE-113033           # Clean one deal
 *   npx tsx scripts/cleanup-duplicates.ts --broker "Karny"       # Clean all deals for broker
 *   npx tsx scripts/cleanup-duplicates.ts --all                  # Clean ALL duplicates
 *   npx tsx scripts/cleanup-duplicates.ts --dry-run VBLUE-113033 # Preview without deleting
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Concurrency limiter - run N tasks at once
function createLimiter(concurrency: number) {
  let running = 0;
  const queue: (() => void)[] = [];

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    while (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      queue.shift()?.();
    }
  };
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cleanAll = args.includes("--all");
const brokerIdx = args.indexOf("--broker");
const brokerFilter = brokerIdx !== -1 ? args[brokerIdx + 1] : null;
const loanCodes = args.filter(a => a.startsWith("VBLUE-"));

interface Liability {
  id: string;
  borrower_id: string;
  type_code: number | null;
  lender: string | null;
  balance: number | null;
}

async function cleanupDuplicatesForBorrower(borrowerId: string, borrowerName: string): Promise<{ deleted: number; kept: number }> {
  // Get all liabilities for this borrower WITH PAGINATION
  const liabilities: Liability[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: page, error } = await supabase
      .from("vl_borrower_liabilities")
      .select("id, borrower_id, type_code, lender, balance")
      .eq("borrower_id", borrowerId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`  Error fetching liabilities for ${borrowerName}:`, error);
      return { deleted: 0, kept: 0 };
    }
    if (!page || page.length === 0) break;
    liabilities.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  if (liabilities.length === 0) {
    return { deleted: 0, kept: 0 };
  }

  // Find duplicates - keep first occurrence of each unique combination
  const seen = new Map<string, string>(); // key -> first id
  const toDelete: string[] = [];

  for (const l of liabilities) {
    const key = `${l.type_code}|${l.lender}|${l.balance}`;

    if (seen.has(key)) {
      // This is a duplicate - mark for deletion
      toDelete.push(l.id);
    } else {
      // First occurrence - keep it
      seen.set(key, l.id);
    }
  }

  if (toDelete.length === 0) {
    return { deleted: 0, kept: liabilities.length };
  }

  if (dryRun) {
    console.log(`  ${borrowerName}: would delete ${toDelete.length}/${liabilities.length} (keeping ${seen.size})`);
    return { deleted: toDelete.length, kept: seen.size };
  }

  // Delete duplicates in batches (Supabase .in() has limits)
  const BATCH_SIZE = 100;
  let deletedCount = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const { error: deleteError } = await supabase
      .from("vl_borrower_liabilities")
      .delete()
      .in("id", batch);

    if (deleteError) {
      console.error(`  Error deleting batch for ${borrowerName}:`, deleteError);
    } else {
      deletedCount += batch.length;
    }
  }

  console.log(`  ${borrowerName}: deleted ${toDelete.length}/${liabilities.length} (kept ${seen.size})`);
  return { deleted: toDelete.length, kept: seen.size };
}

async function main() {
  console.log("\n=== Cleanup Duplicate Liabilities ===\n");

  if (dryRun) {
    console.log("DRY RUN - no changes will be made\n");
  }

  // Get borrowers to clean
  let borrowersToClean: { id: string; name: string; loanCode: string }[] = [];

  if (cleanAll) {
    // Get all borrowers WITH PAGINATION (Supabase default limit is 1000)
    console.log("Fetching all borrowers...");
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data: page, error } = await supabase
        .from("vl_borrowers")
        .select("id, first_name, last_name, deal:vl_deals(loan_code)")
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("Error fetching borrowers:", error);
        break;
      }
      if (!page || page.length === 0) break;

      borrowersToClean.push(...page.map(b => ({
        id: b.id,
        name: `${b.first_name} ${b.last_name}`,
        loanCode: (b.deal as { loan_code: string }[])?.[0]?.loan_code || "Unknown",
      })));

      if (page.length < pageSize) break;
      offset += pageSize;
      console.log(`  Fetched ${borrowersToClean.length} borrowers...`);
    }

    console.log(`Cleaning ALL ${borrowersToClean.length} borrowers\n`);
  } else if (brokerFilter) {
    // Get borrowers for broker's deals
    const { data: broker } = await supabase
      .from("vl_brokers")
      .select("id, name")
      .ilike("name", `%${brokerFilter}%`)
      .single();

    if (!broker) {
      console.error(`Broker not found: ${brokerFilter}`);
      process.exit(1);
    }

    const { data: deals } = await supabase
      .from("vl_deals")
      .select("id, loan_code")
      .eq("broker_id", broker.id);

    if (!deals || deals.length === 0) {
      console.log("No deals found");
      return;
    }

    for (const deal of deals) {
      const { data: borrowers } = await supabase
        .from("vl_borrowers")
        .select("id, first_name, last_name")
        .eq("deal_id", deal.id);

      if (borrowers) {
        borrowersToClean.push(...borrowers.map(b => ({
          id: b.id,
          name: `${b.first_name} ${b.last_name}`,
          loanCode: deal.loan_code,
        })));
      }
    }

    console.log(`Cleaning ${borrowersToClean.length} borrowers for broker: ${broker.name}\n`);
  } else if (loanCodes.length > 0) {
    // Get borrowers for specific deals
    for (const loanCode of loanCodes) {
      const { data: deal } = await supabase
        .from("vl_deals")
        .select("id")
        .eq("loan_code", loanCode)
        .single();

      if (!deal) {
        console.error(`Deal not found: ${loanCode}`);
        continue;
      }

      const { data: borrowers } = await supabase
        .from("vl_borrowers")
        .select("id, first_name, last_name")
        .eq("deal_id", deal.id);

      if (borrowers) {
        borrowersToClean.push(...borrowers.map(b => ({
          id: b.id,
          name: `${b.first_name} ${b.last_name}`,
          loanCode,
        })));
      }
    }

    console.log(`Cleaning ${borrowersToClean.length} borrowers for ${loanCodes.length} deal(s)\n`);
  } else {
    console.error("Usage:");
    console.error("  npx tsx scripts/cleanup-duplicates.ts VBLUE-113033");
    console.error("  npx tsx scripts/cleanup-duplicates.ts --broker \"Karny\"");
    console.error("  npx tsx scripts/cleanup-duplicates.ts --all");
    console.error("  npx tsx scripts/cleanup-duplicates.ts --dry-run VBLUE-113033");
    process.exit(1);
  }

  // Clean each borrower IN PARALLEL (500 concurrent)
  const CONCURRENCY = 500;
  const limiter = createLimiter(CONCURRENCY);
  let totalDeleted = 0;
  let totalKept = 0;
  let processed = 0;

  const results = await Promise.all(
    borrowersToClean.map((borrower) =>
      limiter(async () => {
        const result = await cleanupDuplicatesForBorrower(borrower.id, `${borrower.loanCode} - ${borrower.name}`);
        processed++;
        if (processed % 100 === 0) {
          console.log(`  Progress: ${processed}/${borrowersToClean.length}`);
        }
        return result;
      })
    )
  );

  for (const result of results) {
    totalDeleted += result.deleted;
    totalKept += result.kept;
  }

  console.log(`\n=== Done ===`);
  console.log(`Total deleted: ${totalDeleted}`);
  console.log(`Total kept: ${totalKept}`);

  if (dryRun) {
    console.log("\nThis was a DRY RUN. Run without --dry-run to actually delete.");
  }
}

main().catch(console.error);
