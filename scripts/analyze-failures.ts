/**
 * Failure Analysis Script - Re-syncs deals from high-failure brokers with detailed error capture
 *
 * Usage:
 *   npx tsx scripts/analyze-failures.ts                    # Analyze top 3 failing brokers
 *   npx tsx scripts/analyze-failures.ts --broker "Riley Morrison"  # Specific broker
 *   npx tsx scripts/analyze-failures.ts --all              # All brokers with failures
 */

import fs from "fs";
import path from "path";

// Types
interface Broker {
  name: string;
  apiKey: string;
  baseUrl: string;
}

interface VelocityResponse {
  pageNumber: number;
  totalPages: number;
  totalDeals: number;
  deals: unknown[];
}

interface SyncResult {
  loanCode: string;
  success: boolean;
  error?: string;
}

interface ErrorPattern {
  pattern: string;
  count: number;
  examples: { loanCode: string; error: string }[];
}

// Config
const SYNC_API_URL = process.env.SYNC_API_URL || "http://localhost:3000/api/sync";
const CSV_PATH = path.join(process.cwd(), "env_Variables__c-12_8_2025.csv");
const RESULTS_PATH = path.join(process.cwd(), "scripts", "batch-sync-results.json");

// Parse CLI args
const args = process.argv.slice(2);
const specificBroker = args.includes("--broker")
  ? args[args.indexOf("--broker") + 1]
  : undefined;
const analyzeAll = args.includes("--all");
const verbose = args.includes("--verbose") || args.includes("-v");

// Parse CSV to get brokers
function parseBrokersFromCSV(): Broker[] {
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");

  return lines.slice(1).map((line) => {
    const matches = line.match(/"([^"]*)"/g);
    if (!matches || matches.length < 5) {
      return null;
    }

    const fields = matches.map((m) => m.replace(/"/g, ""));
    return {
      name: fields[4],
      apiKey: fields[1],
      baseUrl: fields[2],
    };
  }).filter((b): b is Broker => b !== null);
}

// Get brokers with failures from last run
function getBrokersWithFailures(): { name: string; failed: number }[] {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error("No batch-sync-results.json found. Run batch-sync first.");
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
  return results.results
    .filter((r: { dealsFailed: number }) => r.dealsFailed > 0)
    .map((r: { broker: string; dealsFailed: number }) => ({
      name: r.broker,
      failed: r.dealsFailed,
    }))
    .sort((a: { failed: number }, b: { failed: number }) => b.failed - a.failed);
}

// Fetch deals for a specific year
async function fetchDealsForYear(broker: Broker, year: number): Promise<unknown[]> {
  const allDeals: unknown[] = [];
  let page = 1;
  let totalPages = 1;

  const startDate = `${year}-01-01`;
  const endDate = year === new Date().getFullYear()
    ? new Date().toISOString().split("T")[0]
    : `${year}-12-31`;

  while (page <= totalPages) {
    const url = `${broker.baseUrl}/v1/deals?apikey=${broker.apiKey}&startdate=${startDate}&enddate=${endDate}&datetype=1&page=${page}`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Velocity API error: ${response.status} - ${text}`);
    }

    const data: VelocityResponse = await response.json();
    allDeals.push(...data.deals);
    totalPages = data.totalPages;
    page++;

    if (page <= totalPages) {
      await sleep(200);
    }
  }

  return allDeals;
}

// Fetch all deals for a broker
async function fetchBrokerDeals(broker: Broker): Promise<unknown[]> {
  const allDeals: unknown[] = [];
  const currentYear = new Date().getFullYear();
  const startYear = 2021;

  for (let year = startYear; year <= currentYear; year++) {
    try {
      const yearDeals = await fetchDealsForYear(broker, year);
      if (yearDeals.length > 0) {
        if (verbose) {
          console.log(`    ${year}: ${yearDeals.length} deals`);
        }
        allDeals.push(...yearDeals);
      }
      await sleep(100);
    } catch (error) {
      if (verbose) {
        console.log(`    ${year}: error - ${error}`);
      }
    }
  }

  return allDeals;
}

// Sync a single deal and capture detailed error
async function syncSingleDeal(deal: unknown): Promise<SyncResult> {
  const loanCode = (deal as { loanCode: string }).loanCode || "unknown";

  try {
    const response = await fetch(SYNC_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deals: [deal] }),
    });

    const result = await response.json();

    if (result.results && result.results[0]) {
      return result.results[0];
    }

    return {
      loanCode,
      success: result.successful === 1,
      error: result.failed > 0 ? "Unknown error" : undefined,
    };
  } catch (error) {
    return {
      loanCode,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Categorize error into pattern
function getErrorPattern(error: string): string {
  if (error.includes("invalid input syntax for type numeric")) {
    const match = error.match(/column "([^"]+)"/);
    return match ? `invalid_numeric:${match[1]}` : "invalid_numeric:unknown";
  }
  if (error.includes("invalid input syntax for type date")) {
    const match = error.match(/column "([^"]+)"/);
    return match ? `invalid_date:${match[1]}` : "invalid_date:unknown";
  }
  if (error.includes("invalid input syntax for type timestamp")) {
    const match = error.match(/column "([^"]+)"/);
    return match ? `invalid_timestamp:${match[1]}` : "invalid_timestamp:unknown";
  }
  if (error.includes("invalid input syntax for type boolean")) {
    const match = error.match(/column "([^"]+)"/);
    return match ? `invalid_boolean:${match[1]}` : "invalid_boolean:unknown";
  }
  if (error.includes("violates foreign key constraint")) {
    return "fk_violation";
  }
  if (error.includes("violates not-null constraint")) {
    const match = error.match(/column "([^"]+)"/);
    return match ? `null_violation:${match[1]}` : "null_violation:unknown";
  }
  if (error.includes("duplicate key")) {
    return "duplicate_key";
  }
  return `other:${error.slice(0, 50)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n=== Velocity Failure Analysis ===\n");

  // Get brokers with failures
  const failingBrokers = getBrokersWithFailures();

  if (failingBrokers.length === 0) {
    console.log("No failures found in last batch sync!");
    return;
  }

  console.log("Brokers with failures:");
  failingBrokers.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name}: ${b.failed} failures`);
  });
  console.log();

  // Determine which brokers to analyze
  let brokersToAnalyze = failingBrokers;

  if (specificBroker) {
    brokersToAnalyze = failingBrokers.filter((b) =>
      b.name.toLowerCase().includes(specificBroker.toLowerCase())
    );
    if (brokersToAnalyze.length === 0) {
      console.error(`No failing broker matches "${specificBroker}"`);
      process.exit(1);
    }
  } else if (!analyzeAll) {
    // Default: top 3 failing brokers
    brokersToAnalyze = failingBrokers.slice(0, 3);
    console.log("Analyzing top 3 failing brokers (use --all for all):\n");
  }

  // Get broker credentials from CSV
  const allBrokers = parseBrokersFromCSV();
  const brokerMap = new Map<string, Broker>();
  allBrokers.forEach((b) => brokerMap.set(b.name, b));

  // Collect all errors
  const allErrors: { broker: string; loanCode: string; error: string }[] = [];
  const errorPatterns: Map<string, ErrorPattern> = new Map();

  for (const failingBroker of brokersToAnalyze) {
    const broker = brokerMap.get(failingBroker.name);
    if (!broker) {
      console.log(`Broker "${failingBroker.name}" not found in CSV`);
      continue;
    }

    console.log(`\n[${failingBroker.name}] Fetching deals...`);

    // Fetch deals
    const deals = await fetchBrokerDeals(broker);
    console.log(`  Found ${deals.length} deals, syncing individually...`);

    let successCount = 0;
    let failCount = 0;

    // Sync each deal individually to capture errors
    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const result = await syncSingleDeal(deal);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        const error = result.error || "Unknown error";

        allErrors.push({
          broker: failingBroker.name,
          loanCode: result.loanCode,
          error,
        });

        // Categorize error
        const pattern = getErrorPattern(error);
        if (!errorPatterns.has(pattern)) {
          errorPatterns.set(pattern, { pattern, count: 0, examples: [] });
        }
        const p = errorPatterns.get(pattern)!;
        p.count++;
        if (p.examples.length < 3) {
          p.examples.push({ loanCode: result.loanCode, error });
        }

        if (verbose) {
          console.log(`    FAIL [${result.loanCode}]: ${error.slice(0, 80)}`);
        }
      }

      // Progress update every 50 deals
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${deals.length} (${failCount} failures)`);
      }

      // Rate limiting
      await sleep(50);
    }

    console.log(`  Complete: ${successCount} success, ${failCount} failures`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("ERROR PATTERN ANALYSIS");
  console.log("=".repeat(60));

  const sortedPatterns = Array.from(errorPatterns.values()).sort(
    (a, b) => b.count - a.count
  );

  if (sortedPatterns.length === 0) {
    console.log("\nNo errors found! All deals synced successfully.");
  } else {
    for (const pattern of sortedPatterns) {
      console.log(`\n[${pattern.count}x] ${pattern.pattern}`);
      pattern.examples.forEach((ex) => {
        console.log(`    ${ex.loanCode}: ${ex.error.slice(0, 100)}`);
      });
    }
  }

  // Write detailed results
  const outputPath = path.join(process.cwd(), "scripts", "failure-analysis.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalErrors: allErrors.length,
        patterns: sortedPatterns,
        errors: allErrors,
      },
      null,
      2
    )
  );
  console.log(`\nDetailed results saved to: ${outputPath}`);

  // Recommendations
  console.log("\n" + "=".repeat(60));
  console.log("RECOMMENDATIONS");
  console.log("=".repeat(60));

  for (const pattern of sortedPatterns.slice(0, 5)) {
    const [type, field] = pattern.pattern.split(":");

    if (type === "invalid_numeric") {
      console.log(
        `\n• Field "${field}" has non-numeric values. Apply parseNumeric() in transformer.`
      );
    } else if (type === "invalid_date" || type === "invalid_timestamp") {
      console.log(
        `\n• Field "${field}" has invalid date/timestamp values. Apply parseDate()/parseDateOnly() in transformer.`
      );
    } else if (type === "invalid_boolean") {
      console.log(
        `\n• Field "${field}" has non-boolean values. Add boolean parser in transformer.`
      );
    } else if (type === "null_violation") {
      console.log(
        `\n• Field "${field}" is receiving null but column is NOT NULL. Provide default value.`
      );
    } else if (type === "fk_violation") {
      console.log(
        `\n• Foreign key violation - check insert order or missing parent records.`
      );
    } else {
      console.log(`\n• Pattern "${pattern.pattern}" needs investigation.`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
