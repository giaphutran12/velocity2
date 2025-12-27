/**
 * Parallel Batch Sync Script - Fetches deals from all brokers with concurrent API calls
 *
 * MUCH FASTER than batch-sync.ts due to:
 * - Parallel year fetching (5 years at once per broker)
 * - Parallel page fetching within each year
 * - Concurrent broker processing
 *
 * Usage:
 *   npx tsx scripts/batch-sync-parallel.ts                     # Sync all brokers
 *   npx tsx scripts/batch-sync-parallel.ts --concurrency 5     # 5 concurrent brokers (default: 3)
 *   npx tsx scripts/batch-sync-parallel.ts --limit 2           # Test with first 2 brokers
 *   npx tsx scripts/batch-sync-parallel.ts --broker "Garry"    # Sync specific broker
 *   npx tsx scripts/batch-sync-parallel.ts --dry-run           # Fetch only, no sync
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
const SYNC_API_URL = process.env.SYNC_API_URL || "http://localhost:3000/api/sync";
const CSV_PATH = path.join(process.cwd(), "env_Variables__c-12_8_2025.csv");

// Parse CLI args
const args = process.argv.slice(2);
const getArgValue = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const BROKER_CONCURRENCY = parseInt(getArgValue("--concurrency") || "3", 10);
const PAGE_CONCURRENCY = 5; // Pages within a year
const limit = getArgValue("--limit") ? parseInt(getArgValue("--limit")!, 10) : undefined;
const specificBroker = getArgValue("--broker");
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose") || args.includes("-v");

// Concurrency limiter
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

// Parse CSV to get brokers
function parseBrokersFromCSV(): Broker[] {
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");

  return lines.slice(1).map((line) => {
    const matches = line.match(/"([^"]*)"/g);
    if (!matches || matches.length < 5) return null;

    const fields = matches.map((m) => m.replace(/"/g, ""));
    return {
      name: fields[4],
      apiKey: fields[1],
      baseUrl: fields[2],
    };
  }).filter((b): b is Broker => b !== null);
}

// Fetch a single page
async function fetchPage(
  broker: Broker,
  startDate: string,
  endDate: string,
  page: number
): Promise<{ deals: unknown[]; totalPages: number }> {
  const url = `${broker.baseUrl}/v1/deals?apikey=${broker.apiKey}&startdate=${startDate}&enddate=${endDate}&datetype=1&page=${page}`;

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Velocity API error: ${response.status} - ${text}`);
  }

  const data: VelocityResponse = await response.json();
  return { deals: data.deals, totalPages: data.totalPages };
}

// Fetch all pages for a year in parallel
async function fetchDealsForYear(broker: Broker, year: number): Promise<unknown[]> {
  const startDate = `${year}-01-01`;
  const endDate = year === new Date().getFullYear()
    ? new Date().toISOString().split("T")[0]
    : `${year}-12-31`;

  // First request to get total pages
  const first = await fetchPage(broker, startDate, endDate, 1);
  const allDeals = [...first.deals];

  if (first.totalPages <= 1) return allDeals;

  // Fetch remaining pages in parallel
  const pageLimiter = createLimiter(PAGE_CONCURRENCY);
  const pagePromises: Promise<unknown[]>[] = [];

  for (let page = 2; page <= first.totalPages; page++) {
    pagePromises.push(
      pageLimiter(async () => {
        const result = await fetchPage(broker, startDate, endDate, page);
        return result.deals;
      })
    );
  }

  const pageResults = await Promise.all(pagePromises);
  pageResults.forEach((deals) => allDeals.push(...deals));

  return allDeals;
}

// Fetch all years in parallel for a broker
async function fetchBrokerDeals(broker: Broker): Promise<unknown[]> {
  const currentYear = new Date().getFullYear();
  const startYear = 2021;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);

  // Fetch all years in parallel
  const yearPromises = years.map(async (year) => {
    try {
      const deals = await fetchDealsForYear(broker, year);
      if (verbose && deals.length > 0) {
        console.log(`    ${broker.name} ${year}: ${deals.length} deals`);
      }
      return deals;
    } catch (error) {
      if (verbose) {
        console.log(`    ${broker.name} ${year}: error - ${error}`);
      }
      return [];
    }
  });

  const yearResults = await Promise.all(yearPromises);
  return yearResults.flat();
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

// Process a single broker
async function processBroker(broker: Broker, index: number, total: number): Promise<SyncResult> {
  const brokerStart = Date.now();
  console.log(`[${index + 1}/${total}] ${broker.name}`);

  try {
    const deals = await fetchBrokerDeals(broker);
    console.log(`  Found ${deals.length} deals`);

    if (dryRun) {
      return {
        broker: broker.name,
        dealsFound: deals.length,
        dealsSynced: 0,
        dealsFailed: 0,
        duration: Date.now() - brokerStart,
      };
    }

    const syncResult = await syncDeals(deals);
    console.log(`  Synced: ${syncResult.successful} | Failed: ${syncResult.failed}`);

    return {
      broker: broker.name,
      dealsFound: deals.length,
      dealsSynced: syncResult.successful,
      dealsFailed: syncResult.failed,
      duration: Date.now() - brokerStart,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${errorMsg}`);

    return {
      broker: broker.name,
      dealsFound: 0,
      dealsSynced: 0,
      dealsFailed: 0,
      error: errorMsg,
      duration: Date.now() - brokerStart,
    };
  }
}

async function main() {
  console.log("\n=== Velocity Parallel Batch Sync ===\n");
  console.log(`Concurrency: ${BROKER_CONCURRENCY} brokers, ${PAGE_CONCURRENCY} pages/year\n`);

  let brokers = parseBrokersFromCSV();
  console.log(`Found ${brokers.length} brokers in CSV`);

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

  console.log(`\nProcessing ${brokers.length} broker(s) with ${BROKER_CONCURRENCY} concurrent...\n`);
  console.log("-".repeat(60));

  const startTime = Date.now();
  const brokerLimiter = createLimiter(BROKER_CONCURRENCY);

  // Process all brokers with concurrency limit
  const resultPromises = brokers.map((broker, i) =>
    brokerLimiter(() => processBroker(broker, i, brokers.length))
  );

  const results = await Promise.all(resultPromises);

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

  const failedBrokers = results.filter((r) => r.error);
  if (failedBrokers.length > 0) {
    console.log("\nFailed Brokers:");
    failedBrokers.forEach((r) => {
      console.log(`  - ${r.broker}: ${r.error}`);
    });
  }

  // Write results
  const resultsPath = path.join(process.cwd(), "scripts", "batch-sync-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    parallel: true,
    concurrency: BROKER_CONCURRENCY,
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

  if (totalFailed > 0 || totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});