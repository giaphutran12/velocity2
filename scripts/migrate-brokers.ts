/**
 * Migrate Brokers Script - Migrates broker API keys from CSV to vl_brokers table
 *
 * Usage:
 *   npx tsx scripts/migrate-brokers.ts              # Migrate all brokers
 *   npx tsx scripts/migrate-brokers.ts --dry-run    # Preview without inserting
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

interface Broker {
  name: string;
  api_key: string;
  base_url: string;
}

// Config
const CSV_PATH = path.join(process.cwd(), "env_Variables__c-12_8_2025.csv");
const VELOCITY_API_BASE = "https://api-velocity.newton.ca/api/forms";

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// Get Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key);
}

// Parse CSV to get brokers
function parseBrokersFromCSV(): Broker[] {
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");

  return lines.slice(1).map((line) => {
    const matches = line.match(/"([^"]*)"/g);
    if (!matches || matches.length < 5) {
      console.warn(`Skipping malformed line: ${line}`);
      return null;
    }

    const fields = matches.map((m) => m.replace(/"/g, ""));
    return {
      name: fields[4],       // SetupOwner.Name
      api_key: fields[1],    // API_Key__c
      base_url: fields[2] || VELOCITY_API_BASE, // base_Url__c
    };
  }).filter((b): b is Broker => b !== null && !!b.name && !!b.api_key);
}

async function main() {
  console.log("\n=== Migrate Brokers to vl_brokers ===\n");

  const brokers = parseBrokersFromCSV();
  console.log(`Found ${brokers.length} brokers in CSV`);

  if (dryRun) {
    console.log("\nDRY RUN - Preview:");
    brokers.forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.name} (${b.api_key.slice(0, 8)}...)`);
    });
    console.log("\nRun without --dry-run to insert into database.");
    return;
  }

  const supabase = getSupabase();

  // Upsert all brokers
  const rows = brokers.map((b) => ({
    name: b.name,
    api_key: b.api_key,
    base_url: b.base_url,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("vl_brokers")
    .upsert(rows, { onConflict: "name" })
    .select("id, name");

  if (error) {
    console.error("Error upserting brokers:", error);
    process.exit(1);
  }

  console.log(`\nSuccessfully upserted ${data.length} brokers:`);
  data.forEach((b) => {
    console.log(`  - ${b.name}`);
  });

  console.log("\nDone! Brokers are now in vl_brokers table.");
  console.log("The cron job at /api/cron/sync will use these for hourly sync.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
