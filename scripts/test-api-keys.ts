/**
 * Test API Keys Script - Validates Velocity API keys for all brokers
 *
 * Usage:
 *   npx tsx scripts/test-api-keys.ts                    # Test all brokers from DB
 *   npx tsx scripts/test-api-keys.ts --csv              # Use CSV fallback instead of DB
 *   npx tsx scripts/test-api-keys.ts --limit 5          # Test first 5 brokers only
 *   npx tsx scripts/test-api-keys.ts --broker "Name"    # Test specific broker
 *   npx tsx scripts/test-api-keys.ts --dry-run          # Show what would be tested
 *   npx tsx scripts/test-api-keys.ts --verbose          # Show detailed API responses
 */

import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

// Types
interface Broker {
  id?: string;
  name: string;
  api_key: string;
  base_url: string;
  is_active?: boolean;
}

interface TestResult {
  broker: string;
  status: "valid" | "invalid" | "error";
  httpStatus?: number;
  dealsCount?: number;
  errorMessage?: string;
  responseTime: number;
}

// Config
const CSV_PATH = path.join(process.cwd(), "env_Variables__c-12_8_2025.csv");
const DELAY_BETWEEN_REQUESTS_MS = 500;

// Parse CLI args
const args = process.argv.slice(2);
const useCSV = args.includes("--csv");
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose") || args.includes("-v");
const limit = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : undefined;
const specificBroker = args.includes("--broker")
  ? args[args.indexOf("--broker") + 1]
  : undefined;

// Get Supabase client
function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

// Fetch brokers from Supabase
async function fetchBrokersFromDB(): Promise<Broker[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase credentials not configured");
  }

  const { data, error } = await supabase
    .from("vl_brokers")
    .select("id, name, api_key, base_url, is_active")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch brokers: ${error.message}`);
  }

  return data || [];
}

// Parse CSV fallback
function parseBrokersFromCSV(): Broker[] {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");

  return lines
    .slice(1)
    .map((line) => {
      const matches = line.match(/"([^"]*)"/g);
      if (!matches || matches.length < 5) {
        return null;
      }

      const fields = matches.map((m) => m.replace(/"/g, ""));
      return {
        name: fields[4], // SetupOwner.Name
        api_key: fields[1], // API_Key__c
        base_url: fields[2], // base_Url__c
      };
    })
    .filter((b): b is Broker => b !== null);
}

// Test a single broker's API key
async function testBrokerApiKey(broker: Broker): Promise<TestResult> {
  const startTime = Date.now();
  const today = new Date().toISOString().split("T")[0];

  // Build URL using same pattern as velocity-api.ts
  const url = `${broker.base_url}/v1/deals?apikey=${broker.api_key}&startdate=${today}&enddate=${today}&datetype=1&page=1`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        broker: broker.name,
        status: "valid",
        httpStatus: response.status,
        dealsCount: data.totalDeals ?? data.deals?.length ?? 0,
        responseTime,
      };
    } else {
      // Try to get error message from response
      let errorMessage: string;
      try {
        const text = await response.text();
        // Try to parse as JSON for structured error
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          errorMessage = text || `HTTP ${response.status}`;
        }
      } catch {
        errorMessage = `HTTP ${response.status} ${response.statusText}`;
      }

      return {
        broker: broker.name,
        status: "invalid",
        httpStatus: response.status,
        errorMessage: errorMessage.substring(0, 200), // Truncate long errors
        responseTime,
      };
    }
  } catch (error) {
    return {
      broker: broker.name,
      status: "error",
      errorMessage:
        error instanceof Error ? error.message : "Unknown network error",
      responseTime: Date.now() - startTime,
    };
  }
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Format table row
function formatRow(
  name: string,
  status: string,
  details: string,
  time: string
): string {
  const namePad = name.padEnd(25);
  const statusPad = status.padEnd(10);
  const detailsPad = details.padEnd(40);
  return `${namePad} ${statusPad} ${detailsPad} ${time}`;
}

// Main
async function main() {
  console.log("\n=== Velocity API Key Validator ===\n");

  // Load brokers
  let brokers: Broker[];
  let source: string;

  if (useCSV) {
    brokers = parseBrokersFromCSV();
    source = "CSV";
  } else {
    try {
      brokers = await fetchBrokersFromDB();
      source = "Database";
    } catch (error) {
      console.log(
        `Could not fetch from DB (${error instanceof Error ? error.message : "unknown error"})`
      );
      console.log("Falling back to CSV...\n");
      brokers = parseBrokersFromCSV();
      source = "CSV (fallback)";
    }
  }

  console.log(`Source: ${source}`);
  console.log(`Total brokers found: ${brokers.length}`);

  // Apply filters
  if (specificBroker) {
    brokers = brokers.filter((b) =>
      b.name.toLowerCase().includes(specificBroker.toLowerCase())
    );
    console.log(
      `Filtered to ${brokers.length} broker(s) matching "${specificBroker}"`
    );
  }

  if (limit) {
    brokers = brokers.slice(0, limit);
    console.log(`Limited to first ${limit} broker(s)`);
  }

  if (brokers.length === 0) {
    console.log("\nNo brokers to test.");
    return;
  }

  // Dry run - just show what would be tested
  if (dryRun) {
    console.log("\n[DRY RUN] Would test the following brokers:\n");
    brokers.forEach((b, i) => {
      const activeStatus =
        b.is_active !== undefined
          ? b.is_active
            ? " (active)"
            : " (inactive)"
          : "";
      console.log(`  ${i + 1}. ${b.name}${activeStatus}`);
      if (verbose) {
        console.log(`     URL: ${b.base_url}`);
        console.log(`     Key: ${b.api_key.substring(0, 8)}...`);
      }
    });
    console.log(`\nTotal: ${brokers.length} broker(s)`);
    return;
  }

  // Run tests
  console.log(`\nTesting ${brokers.length} broker(s)...\n`);
  console.log("-".repeat(90));
  console.log(formatRow("BROKER", "STATUS", "DETAILS", "TIME"));
  console.log("-".repeat(90));

  const results: TestResult[] = [];

  for (let i = 0; i < brokers.length; i++) {
    const broker = brokers[i];
    const result = await testBrokerApiKey(broker);
    results.push(result);

    // Format output
    let statusIcon: string;
    let details: string;

    if (result.status === "valid") {
      statusIcon = "\x1b[32mVALID\x1b[0m"; // Green
      details = `${result.dealsCount} deals today`;
    } else if (result.status === "invalid") {
      statusIcon = "\x1b[31mINVALID\x1b[0m"; // Red
      details = result.errorMessage || "Unknown error";
    } else {
      statusIcon = "\x1b[33mERROR\x1b[0m"; // Yellow
      details = result.errorMessage || "Network error";
    }

    const time = `${result.responseTime}ms`;
    console.log(formatRow(broker.name.substring(0, 24), statusIcon, details.substring(0, 39), time));

    if (verbose && result.status !== "valid") {
      console.log(`     Full error: ${result.errorMessage}`);
    }

    // Rate limiting
    if (i < brokers.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  // Summary
  const valid = results.filter((r) => r.status === "valid");
  const invalid = results.filter((r) => r.status === "invalid");
  const errors = results.filter((r) => r.status === "error");

  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));
  console.log(`Total tested:  ${results.length}`);
  console.log(`\x1b[32mValid:         ${valid.length}\x1b[0m`);
  console.log(`\x1b[31mInvalid:       ${invalid.length}\x1b[0m`);
  console.log(`\x1b[33mErrors:        ${errors.length}\x1b[0m`);

  // Show invalid brokers with details
  if (invalid.length > 0) {
    console.log("\n--- Invalid API Keys ---");
    invalid.forEach((r) => {
      console.log(`  ${r.broker}: ${r.errorMessage}`);
    });
  }

  // Show error brokers
  if (errors.length > 0) {
    console.log("\n--- Network/Connection Errors ---");
    errors.forEach((r) => {
      console.log(`  ${r.broker}: ${r.errorMessage}`);
    });
  }

  // Save results to JSON
  const resultsPath = path.join(
    process.cwd(),
    "scripts",
    "api-keys-test-results.json"
  );
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        source,
        totalTested: results.length,
        valid: valid.length,
        invalid: invalid.length,
        errors: errors.length,
        results: results.map((r) => ({
          broker: r.broker,
          status: r.status,
          httpStatus: r.httpStatus,
          dealsCount: r.dealsCount,
          errorMessage: r.errorMessage,
          responseTimeMs: r.responseTime,
        })),
      },
      null,
      2
    )
  );
  console.log(`\nResults saved to: ${resultsPath}`);

  // Exit with error code if any invalid keys
  if (invalid.length > 0 || errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
