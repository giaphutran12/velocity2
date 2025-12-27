/**
 * Batch Sync Script - Fetches deals from all 39 brokers and syncs to Supabase
 *
 * Usage:
 *   npx tsx scripts/batch-sync.ts                    # Sync all brokers
 *   npx tsx scripts/batch-sync.ts --limit 2          # Test with first 2 brokers
 *   npx tsx scripts/batch-sync.ts --broker "Garry Singh"  # Sync specific broker
 *   npx tsx scripts/batch-sync.ts --dry-run          # Fetch only, no sync
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
  broker: string;
  dealsFound: number;
  dealsSynced: number;
  dealsFailed: number;
  error?: string;
  duration: number;
}

// Config
const VELOCITY_API_BASE = "https://api-velocity.newton.ca/api/forms";
const SYNC_API_URL = process.env.SYNC_API_URL || "http://localhost:3000/api/sync";
const CSV_PATH = path.join(process.cwd(), "env_Variables__c-12_8_2025.csv");
const DELAY_BETWEEN_BROKERS_MS = 500; // Rate limiting

// Parse CLI args
const args = process.argv.slice(2);
const limit = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : undefined;
const specificBroker = args.includes("--broker")
  ? args[args.indexOf("--broker") + 1]
  : undefined;
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose") || args.includes("-v");

// Parse CSV to get brokers
function parseBrokersFromCSV(): Broker[] {
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");

  // Skip header row
  return lines.slice(1).map((line) => {
    // Parse CSV with quoted fields
    const matches = line.match(/"([^"]*)"/g);
    if (!matches || matches.length < 5) {
      console.warn(`Skipping malformed line: ${line}`);
      return null;
    }

    const fields = matches.map((m) => m.replace(/"/g, ""));
    return {
      name: fields[4], // SetupOwner.Name
      apiKey: fields[1], // API_Key__c
      baseUrl: fields[2], // base_Url__c
    };
  }).filter((b): b is Broker => b !== null);
}

// Fetch deals for a specific year (max 12 months per request)
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

    if (verbose) {
      console.log(`    Year ${year}, page ${page}/${totalPages}...`);
    }

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

// Fetch all deals for a broker (loops through years since max 12 months per request)
async function fetchBrokerDeals(broker: Broker): Promise<VelocityResponse> {
  const allDeals: unknown[] = [];
  const currentYear = new Date().getFullYear();
  const startYear = 2021; // API only allows past 5 years

  for (let year = startYear; year <= currentYear; year++) {
    try {
      const yearDeals = await fetchDealsForYear(broker, year);
      if (yearDeals.length > 0) {
        if (verbose) {
          console.log(`    ${year}: ${yearDeals.length} deals`);
        }
        allDeals.push(...yearDeals);
      }
      // Rate limit between years
      await sleep(100);
    } catch (error) {
      // Log but continue with other years
      if (verbose) {
        console.log(`    ${year}: error - ${error}`);
      }
    }
  }

  return {
    pageNumber: 1,
    totalPages: 1,
    totalDeals: allDeals.length,
    deals: allDeals,
  };
}

// Sync deals to Supabase via our API
async function syncDeals(deals: unknown[]): Promise<{ successful: number; failed: number }> {
  if (deals.length === 0) {
    return { successful: 0, failed: 0 };
  }

  const response = await fetch(SYNC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deals }),
  });

  if (!response.ok) {
    throw new Error(`Sync API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return {
    successful: result.successful || 0,
    failed: result.failed || 0,
  };
}

// Helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main
async function main() {
  console.log("\n=== Velocity Batch Sync ===\n");

  // Parse brokers
  let brokers = parseBrokersFromCSV();
  console.log(`Found ${brokers.length} brokers in CSV`);

  // Apply filters
  if (specificBroker) {
    brokers = brokers.filter((b) =>
      b.name.toLowerCase().includes(specificBroker.toLowerCase())
    );
    console.log(`Filtered to ${brokers.length} broker(s) matching "${specificBroker}"`);
  }

  if (limit) {
    brokers = brokers.slice(0, limit);
    console.log(`Limited to first ${limit} broker(s)`);
  }

  if (dryRun) {
    console.log("DRY RUN: Will fetch deals but not sync to Supabase");
  }

  console.log(`\nProcessing ${brokers.length} broker(s)...\n`);
  console.log("-".repeat(60));

  const results: SyncResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < brokers.length; i++) {
    const broker = brokers[i];
    const brokerStart = Date.now();

    console.log(`[${i + 1}/${brokers.length}] ${broker.name}`);

    try {
      // Fetch deals from Velocity
      const velocityData = await fetchBrokerDeals(broker);
      console.log(`  Found ${velocityData.totalDeals} deals`);

      if (dryRun) {
        results.push({
          broker: broker.name,
          dealsFound: velocityData.totalDeals,
          dealsSynced: 0,
          dealsFailed: 0,
          duration: Date.now() - brokerStart,
        });
      } else {
        // Sync to Supabase
        const syncResult = await syncDeals(velocityData.deals);
        console.log(`  Synced: ${syncResult.successful} | Failed: ${syncResult.failed}`);

        results.push({
          broker: broker.name,
          dealsFound: velocityData.totalDeals,
          dealsSynced: syncResult.successful,
          dealsFailed: syncResult.failed,
          duration: Date.now() - brokerStart,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR: ${errorMsg}`);

      results.push({
        broker: broker.name,
        dealsFound: 0,
        dealsSynced: 0,
        dealsFailed: 0,
        error: errorMsg,
        duration: Date.now() - brokerStart,
      });
    }

    // Rate limit between brokers
    if (i < brokers.length - 1) {
      await sleep(DELAY_BETWEEN_BROKERS_MS);
    }
  }

  // Summary
  const totalDuration = Date.now() - startTime;
  const totalFound = results.reduce((sum, r) => sum + r.dealsFound, 0);
  const totalSynced = results.reduce((sum, r) => sum + r.dealsSynced, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.dealsFailed, 0);
  const totalErrors = results.filter((r) => r.error).length;

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Brokers processed: ${brokers.length}`);
  console.log(`Total deals found: ${totalFound}`);
  if (!dryRun) {
    console.log(`Deals synced:      ${totalSynced}`);
    console.log(`Deals failed:      ${totalFailed}`);
  }
  console.log(`Broker errors:     ${totalErrors}`);
  console.log(`Total time:        ${(totalDuration / 1000).toFixed(1)}s`);

  // Show failed brokers
  const failedBrokers = results.filter((r) => r.error);
  if (failedBrokers.length > 0) {
    console.log("\nFailed Brokers:");
    failedBrokers.forEach((r) => {
      console.log(`  - ${r.broker}: ${r.error}`);
    });
  }

  // Write results to file
  const resultsPath = path.join(process.cwd(), "scripts", "batch-sync-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun,
    brokerCount: brokers.length,
    totalDealsFound: totalFound,
    totalDealsSynced: totalSynced,
    totalDealsFailed: totalFailed,
    brokerErrors: totalErrors,
    durationMs: totalDuration,
    results,
  }, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);

  // Exit with error code if any failures
  if (totalFailed > 0 || totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
