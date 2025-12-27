/**
 * Retry Failures Script - Re-syncs only failed deals from cached data
 *
 * Prerequisites:
 *   - Run analyze-failures-parallel.ts first (creates deals cache + failure-analysis.json)
 *
 * Usage:
 *   npx tsx scripts/retry-failures.ts                    # Retry all failed deals
 *   npx tsx scripts/retry-failures.ts --broker "Nav"     # Retry specific broker
 *   npx tsx scripts/retry-failures.ts --dry-run          # Show what would be retried
 */

import fs from "fs";
import path from "path";

interface SyncResult {
  loanCode: string;
  success: boolean;
  error?: string;
}

interface FailureAnalysis {
  timestamp: string;
  totalErrors: number;
  errors: { broker: string; loanCode: string; error: string }[];
}

// Config
const SYNC_API_URL = process.env.SYNC_API_URL || "http://localhost:3000/api/sync";
const DEALS_CACHE_DIR = path.join(process.cwd(), "scripts", "deals-cache");
const FAILURE_ANALYSIS_PATH = path.join(process.cwd(), "scripts", "failure-analysis.json");
const RETRY_LOG_PATH = path.join(process.cwd(), "scripts", "retry-log.txt");

// Parse CLI args
const args = process.argv.slice(2);
const specificBroker = args.includes("--broker")
  ? args[args.indexOf("--broker") + 1]
  : undefined;
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose") || args.includes("-v");

// Get failed loanCodes from failure-analysis.json
function getFailedLoanCodes(): Map<string, Set<string>> {
  if (!fs.existsSync(FAILURE_ANALYSIS_PATH)) {
    console.error("No failure-analysis.json found. Run analyze-failures-parallel.ts first.");
    process.exit(1);
  }

  const analysis: FailureAnalysis = JSON.parse(fs.readFileSync(FAILURE_ANALYSIS_PATH, "utf-8"));
  const brokerFailures = new Map<string, Set<string>>();

  for (const error of analysis.errors) {
    if (!brokerFailures.has(error.broker)) {
      brokerFailures.set(error.broker, new Set());
    }
    brokerFailures.get(error.broker)!.add(error.loanCode);
  }

  return brokerFailures;
}

// Get cached deals for a broker
function getCachedDeals(brokerName: string): unknown[] | null {
  const safeName = brokerName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const cachePath = path.join(DEALS_CACHE_DIR, `${safeName}.json`);

  if (!fs.existsSync(cachePath)) {
    console.log(`  No cache file found for ${brokerName}`);
    return null;
  }

  return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
}

// Sync a single deal
async function syncDeal(deal: unknown): Promise<SyncResult> {
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

// Log retry result
function logRetry(broker: string, loanCode: string, success: boolean, error?: string) {
  const timestamp = new Date().toISOString();
  const status = success ? "SUCCESS" : "FAILED";
  const logLine = `[${timestamp}] [${broker}] ${loanCode}: ${status}${error ? ` - ${error}` : ""}\n`;
  fs.appendFileSync(RETRY_LOG_PATH, logLine);
}

async function main() {
  console.log("\n=== Velocity Retry Failures ===\n");

  // Get failed loanCodes grouped by broker
  const brokerFailures = getFailedLoanCodes();

  if (brokerFailures.size === 0) {
    console.log("No failures found in failure-analysis.json!");
    return;
  }

  console.log("Brokers with failures:");
  for (const [broker, loanCodes] of brokerFailures) {
    console.log(`  ${broker}: ${loanCodes.size} failed deals`);
  }
  console.log();

  // Filter by specific broker if provided
  let brokersToRetry = Array.from(brokerFailures.keys());
  if (specificBroker) {
    brokersToRetry = brokersToRetry.filter((b) =>
      b.toLowerCase().includes(specificBroker.toLowerCase())
    );
    if (brokersToRetry.length === 0) {
      console.error(`No broker matches "${specificBroker}"`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log("DRY RUN - Would retry:\n");
    for (const broker of brokersToRetry) {
      const loanCodes = brokerFailures.get(broker)!;
      console.log(`[${broker}] ${loanCodes.size} deals:`);
      for (const loanCode of Array.from(loanCodes).slice(0, 5)) {
        console.log(`  - ${loanCode}`);
      }
      if (loanCodes.size > 5) {
        console.log(`  ... and ${loanCodes.size - 5} more`);
      }
    }
    return;
  }

  // Initialize retry log
  fs.writeFileSync(RETRY_LOG_PATH, `=== Retry Started: ${new Date().toISOString()} ===\n\n`);

  let totalRetried = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const broker of brokersToRetry) {
    const failedLoanCodes = brokerFailures.get(broker)!;
    console.log(`\n[${broker}] Retrying ${failedLoanCodes.size} failed deals...`);

    // Get cached deals
    const allDeals = getCachedDeals(broker);
    if (!allDeals) {
      console.log(`  Skipping - no cached deals`);
      continue;
    }

    // Filter to only failed deals
    const dealsToRetry = allDeals.filter((deal) => {
      const loanCode = (deal as { loanCode: string }).loanCode;
      return failedLoanCodes.has(loanCode);
    });

    console.log(`  Found ${dealsToRetry.length} deals to retry from cache`);

    for (let i = 0; i < dealsToRetry.length; i++) {
      const deal = dealsToRetry[i];
      const result = await syncDeal(deal);

      logRetry(broker, result.loanCode, result.success, result.error);
      totalRetried++;

      if (result.success) {
        totalSuccess++;
        if (verbose) {
          console.log(`    OK [${result.loanCode}]`);
        }
      } else {
        totalFailed++;
        console.log(`    FAIL [${result.loanCode}]: ${result.error?.slice(0, 60)}`);
      }

      // Progress every 10
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${dealsToRetry.length}`);
      }

      // Small delay
      await new Promise((r) => setTimeout(r, 50));
    }

    console.log(`  Complete`);
  }

  // Summary
  console.log("\n" + "=".repeat(40));
  console.log("RETRY SUMMARY");
  console.log("=".repeat(40));
  console.log(`Total retried: ${totalRetried}`);
  console.log(`Successful:    ${totalSuccess}`);
  console.log(`Still failing: ${totalFailed}`);
  console.log(`\nDetailed log: ${RETRY_LOG_PATH}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
