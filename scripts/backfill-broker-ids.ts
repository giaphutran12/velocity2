/**
 * Backfill broker_id for all deals
 *
 * Runs locally against production Supabase - no timeout limits.
 * Processes one broker at a time with progress tracking.
 *
 * Usage:
 *   npx tsx scripts/backfill-broker-ids.ts              # Run all brokers sequentially
 *   npx tsx scripts/backfill-broker-ids.ts --parallel   # Run all brokers in parallel (fast!)
 *   npx tsx scripts/backfill-broker-ids.ts --list       # List brokers only
 *   npx tsx scripts/backfill-broker-ids.ts --broker 1   # Run specific broker (by index)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

// Parse CLI args
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const parallel = args.includes("--parallel");
const brokerIndex = args.includes("--broker")
  ? parseInt(args[args.indexOf("--broker") + 1], 10)
  : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface Broker {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
}

interface VelocityResponse {
  pageNumber: number;
  totalPages: number;
  totalDeals: number;
  deals: { loanCode: string }[];
}

// Fetch deals for a single year
async function fetchDealsForYear(broker: Broker, year: number): Promise<{ loanCode: string }[]> {
  const allDeals: { loanCode: string }[] = [];
  let page = 1;
  let totalPages = 1;

  const startDate = `${year}-01-01`;
  const endDate = year === new Date().getFullYear()
    ? new Date().toISOString().split("T")[0]
    : `${year}-12-31`;

  while (page <= totalPages) {
    const url = `${broker.base_url}/v1/deals?apikey=${broker.api_key}&startdate=${startDate}&enddate=${endDate}&datetype=1&page=${page}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  API error for ${year} page ${page}: ${response.status}`);
      break;
    }

    const data: VelocityResponse = await response.json();
    allDeals.push(...data.deals);
    totalPages = data.totalPages;

    if (page < totalPages) {
      process.stdout.write(`  Year ${year}: page ${page}/${totalPages}\r`);
    }
    page++;

    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }

  return allDeals;
}

// Update broker_id for deals by loan_code
async function updateDeals(brokerId: string, loanCodes: string[]): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < loanCodes.length; i += batchSize) {
    const batch = loanCodes.slice(i, i + batchSize);

    const { error, count } = await supabase
      .from("vl_deals")
      .update({ broker_id: brokerId })
      .in("loan_code", batch)
      .is("broker_id", null); // Only update if not already set

    if (error) {
      console.error(`  Batch error: ${error.message}`);
      failed += batch.length;
    } else {
      updated += count || 0;
    }

    process.stdout.write(`  Updated ${Math.min(i + batchSize, loanCodes.length)}/${loanCodes.length}\r`);
  }

  return { updated, failed };
}

async function main() {
  console.log("\n=== Backfill broker_id for deals ===\n");

  // Check current state
  const { count: withoutBroker } = await supabase
    .from("vl_deals")
    .select("*", { count: "exact", head: true })
    .is("broker_id", null);

  console.log(`Deals without broker_id: ${withoutBroker}\n`);

  if (withoutBroker === 0) {
    console.log("All deals already have broker_id. Nothing to do.");
    return;
  }

  // Get all active brokers
  const { data: brokers, error: brokersError } = await supabase
    .from("vl_brokers")
    .select("id, name, api_key, base_url")
    .eq("is_active", true);

  if (brokersError || !brokers?.length) {
    console.error("Failed to fetch brokers:", brokersError?.message);
    return;
  }

  console.log(`Found ${brokers.length} active broker(s):\n`);
  brokers.forEach((b, i) => console.log(`  [${i}] ${b.name}`));

  // --list: just show brokers and exit
  if (listOnly) {
    console.log("\nUse --broker <index> to run a specific broker");
    return;
  }

  // --broker <index>: filter to single broker
  let brokersToProcess = brokers;
  if (brokerIndex !== null) {
    if (brokerIndex < 0 || brokerIndex >= brokers.length) {
      console.error(`\nInvalid broker index: ${brokerIndex}`);
      return;
    }
    brokersToProcess = [brokers[brokerIndex]];
    console.log(`\nRunning only: ${brokersToProcess[0].name}`);
  }

  const currentYear = new Date().getFullYear();

  // Process a single broker
  async function processBroker(broker: Broker): Promise<{ broker: string; dealsFound: number; updated: number }> {
    console.log(`\n[${broker.name}] Fetching deals from Velocity API...`);

    const allLoanCodes: string[] = [];

    // Fetch deals for each year
    for (let year = 2021; year <= currentYear; year++) {
      const yearDeals = await fetchDealsForYear(broker, year);
      allLoanCodes.push(...yearDeals.map((d) => d.loanCode));
      if (!parallel) console.log(`  Year ${year}: ${yearDeals.length} deals`);
    }

    console.log(`  [${broker.name}] Total: ${allLoanCodes.length} deals from API`);

    if (allLoanCodes.length === 0) {
      return { broker: broker.name, dealsFound: 0, updated: 0 };
    }

    // Update broker_id for matching deals
    const { updated, failed } = await updateDeals(broker.id, allLoanCodes);

    console.log(`  [${broker.name}] Done: ${updated} updated, ${failed} failed`);
    return { broker: broker.name, dealsFound: allLoanCodes.length, updated };
  }

  let results: { broker: string; dealsFound: number; updated: number }[];

  if (parallel) {
    console.log(`\nRunning ${brokersToProcess.length} brokers in PARALLEL...\n`);
    results = await Promise.all(brokersToProcess.map(processBroker));
  } else {
    console.log(`\nRunning ${brokersToProcess.length} brokers sequentially...`);
    results = [];
    for (const broker of brokersToProcess) {
      const result = await processBroker(broker);
      results.push(result);
    }
  }

  // Summary
  console.log("\n=== Summary ===\n");
  for (const r of results) {
    console.log(`${r.broker}: ${r.updated}/${r.dealsFound} deals updated`);
  }

  // Final count
  const { count: remaining } = await supabase
    .from("vl_deals")
    .select("*", { count: "exact", head: true })
    .is("broker_id", null);

  console.log(`\nRemaining deals without broker_id: ${remaining}`);
}

main().catch(console.error);
