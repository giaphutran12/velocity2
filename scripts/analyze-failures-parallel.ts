/**
 * Parallel Failure Analysis Script - Re-syncs deals with concurrent API calls
 *
 * MUCH FASTER than analyze-failures.ts due to:
 * - Parallel year/page fetching
 * - Batch deal syncing instead of one-by-one
 * - Concurrent broker processing
 *
 * Usage:
 *   npx tsx scripts/analyze-failures-parallel.ts                    # Analyze top 3 failing brokers
 *   npx tsx scripts/analyze-failures-parallel.ts --broker "Riley"   # Specific broker
 *   npx tsx scripts/analyze-failures-parallel.ts --all              # All brokers with failures
 *   npx tsx scripts/analyze-failures-parallel.ts --concurrency 5    # 5 concurrent syncs (default: 10)
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
const DEALS_CACHE_DIR = path.join(process.cwd(), "scripts", "deals-cache");
const ERROR_LOG_PATH = path.join(process.cwd(), "scripts", "error-log.txt");

// Parse CLI args
const args = process.argv.slice(2);
const getArgValue = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const SYNC_CONCURRENCY = parseInt(getArgValue("--concurrency") || "10", 10);
const SYNC_BATCH_SIZE = parseInt(getArgValue("--batch-size") || "20", 10);
const PAGE_CONCURRENCY = 5;
const specificBroker = getArgValue("--broker");
const analyzeAll = args.includes("--all");
const verbose = args.includes("--verbose") || args.includes("-v");

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(DEALS_CACHE_DIR)) {
    fs.mkdirSync(DEALS_CACHE_DIR, { recursive: true });
  }
}

// Save deals to cache file
function saveDealsToCacheFile(brokerName: string, deals: unknown[]) {
  ensureCacheDir();
  const safeName = brokerName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const cachePath = path.join(DEALS_CACHE_DIR, `${safeName}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(deals, null, 2));
  console.log(`  Cached ${deals.length} deals to ${cachePath}`);
}

// Append error to log file with timestamp
function logError(broker: string, loanCode: string, error: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${broker}] ${loanCode}: ${error}\n`;
  fs.appendFileSync(ERROR_LOG_PATH, logLine);
}

// Append session marker to error log (no longer clears)
function appendSessionMarker() {
  fs.appendFileSync(ERROR_LOG_PATH, `\n=== Failure Analysis Session: ${new Date().toISOString()} ===\n\n`);
}

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

  const first = await fetchPage(broker, startDate, endDate, 1);
  const allDeals = [...first.deals];

  if (first.totalPages <= 1) return allDeals;

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

  const yearPromises = years.map(async (year) => {
    try {
      const deals = await fetchDealsForYear(broker, year);
      if (verbose && deals.length > 0) {
        console.log(`    ${year}: ${deals.length} deals`);
      }
      return deals;
    } catch (error) {
      if (verbose) {
        console.log(`    ${year}: error - ${error}`);
      }
      return [];
    }
  });

  const yearResults = await Promise.all(yearPromises);
  return yearResults.flat();
}

// Sync a batch of deals and get individual results
async function syncBatch(deals: unknown[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  try {
    const response = await fetch(SYNC_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deals }),
    });

    const result = await response.json();

    // If API returns individual results, use them
    if (result.results && Array.isArray(result.results)) {
      return result.results;
    }

    // Otherwise, mark all as success/fail based on response
    return deals.map((deal) => ({
      loanCode: (deal as { loanCode: string }).loanCode || "unknown",
      success: result.successful > 0,
      error: result.failed > 0 ? "Batch sync error" : undefined,
    }));
  } catch (error) {
    // On error, mark all deals as failed
    return deals.map((deal) => ({
      loanCode: (deal as { loanCode: string }).loanCode || "unknown",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

// Sync all deals in parallel batches
async function syncDealsParallel(
  deals: unknown[],
  onProgress: (synced: number, failed: number) => void
): Promise<SyncResult[]> {
  const allResults: SyncResult[] = [];
  const batches: unknown[][] = [];

  // Split into batches
  for (let i = 0; i < deals.length; i += SYNC_BATCH_SIZE) {
    batches.push(deals.slice(i, i + SYNC_BATCH_SIZE));
  }

  const syncLimiter = createLimiter(SYNC_CONCURRENCY);
  let completed = 0;

  const batchPromises = batches.map((batch) =>
    syncLimiter(async () => {
      const results = await syncBatch(batch);
      completed += batch.length;
      const failed = results.filter((r) => !r.success).length;
      onProgress(completed, failed);
      return results;
    })
  );

  const batchResults = await Promise.all(batchPromises);
  batchResults.forEach((results) => allResults.push(...results));

  return allResults;
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

async function main() {
  console.log("\n=== Velocity Parallel Failure Analysis ===\n");
  console.log(`Concurrency: ${SYNC_CONCURRENCY} syncs, batch size: ${SYNC_BATCH_SIZE}\n`);

  // Append session marker (no longer clears)
  appendSessionMarker();

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
    brokersToAnalyze = failingBrokers.slice(0, 3);
    console.log("Analyzing top 3 failing brokers (use --all for all):\n");
  }

  const allBrokers = parseBrokersFromCSV();
  const brokerMap = new Map<string, Broker>();
  allBrokers.forEach((b) => brokerMap.set(b.name, b));

  const allErrors: { broker: string; loanCode: string; error: string }[] = [];
  const errorPatterns: Map<string, ErrorPattern> = new Map();

  for (const failingBroker of brokersToAnalyze) {
    const broker = brokerMap.get(failingBroker.name);
    if (!broker) {
      console.log(`Broker "${failingBroker.name}" not found in CSV`);
      continue;
    }

    console.log(`\n[${failingBroker.name}] Fetching deals...`);

    const deals = await fetchBrokerDeals(broker);
    console.log(`  Found ${deals.length} deals`);

    // Save deals to cache file for later retry
    saveDealsToCacheFile(failingBroker.name, deals);

    console.log(`  Syncing in parallel...`);

    let lastLoggedProgress = 0;
    const results = await syncDealsParallel(deals, (synced, _failed) => {
      // Log progress every 100 deals
      if (synced - lastLoggedProgress >= 100) {
        console.log(`  Progress: ${synced}/${deals.length}`);
        lastLoggedProgress = synced;
      }
    });

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // Process failures
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        const error = result.error || "Unknown error";

        // Log to file immediately (survives script interruption)
        logError(failingBroker.name, result.loanCode, error);

        allErrors.push({
          broker: failingBroker.name,
          loanCode: result.loanCode,
          error,
        });

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
      });

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

  // Write results (merge with existing data)
  const outputPath = path.join(process.cwd(), "scripts", "failure-analysis.json");

  // Load existing data if present
  let existingErrors: { broker: string; loanCode: string; error: string }[] = [];
  let existingPatterns: ErrorPattern[] = [];

  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      existingErrors = existing.errors || [];
      existingPatterns = existing.patterns || [];
    } catch {
      // If parsing fails, start fresh
    }
  }

  // Merge errors (dedupe by loanCode)
  const seenLoanCodes = new Set(allErrors.map(e => e.loanCode));
  const mergedErrors = [
    ...allErrors,
    ...existingErrors.filter(e => !seenLoanCodes.has(e.loanCode))
  ];

  // Merge patterns
  const patternMap = new Map<string, ErrorPattern>();
  [...existingPatterns, ...sortedPatterns].forEach(p => {
    if (patternMap.has(p.pattern)) {
      const existing = patternMap.get(p.pattern)!;
      existing.count += p.count;
      existing.examples = [...existing.examples, ...p.examples].slice(0, 3);
    } else {
      patternMap.set(p.pattern, { ...p });
    }
  });
  const mergedPatterns = Array.from(patternMap.values()).sort((a, b) => b.count - a.count);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        parallel: true,
        concurrency: SYNC_CONCURRENCY,
        batchSize: SYNC_BATCH_SIZE,
        totalErrors: mergedErrors.length,
        patterns: mergedPatterns,
        errors: mergedErrors,
      },
      null,
      2
    )
  );
  console.log(`\nDetailed results saved to: ${outputPath} (merged with existing)`);

  // Recommendations
  console.log("\n" + "=".repeat(60));
  console.log("RECOMMENDATIONS");
  console.log("=".repeat(60));

  for (const pattern of sortedPatterns.slice(0, 5)) {
    const [type, field] = pattern.pattern.split(":");

    if (type === "invalid_numeric") {
      console.log(
        `\n* Field "${field}" has non-numeric values. Apply parseNumeric() in transformer.`
      );
    } else if (type === "invalid_date" || type === "invalid_timestamp") {
      console.log(
        `\n* Field "${field}" has invalid date/timestamp values. Apply parseDate()/parseDateOnly() in transformer.`
      );
    } else if (type === "invalid_boolean") {
      console.log(
        `\n* Field "${field}" has non-boolean values. Add boolean parser in transformer.`
      );
    } else if (type === "null_violation") {
      console.log(
        `\n* Field "${field}" is receiving null but column is NOT NULL. Provide default value.`
      );
    } else if (type === "fk_violation") {
      console.log(
        `\n* Foreign key violation - check insert order or missing parent records.`
      );
    } else {
      console.log(`\n* Pattern "${pattern.pattern}" needs investigation.`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
