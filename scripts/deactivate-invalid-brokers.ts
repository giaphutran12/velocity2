/**
 * Deactivate brokers with invalid API keys
 *
 * Usage:
 *   npx tsx scripts/deactivate-invalid-brokers.ts
 *
 * Sets is_active=false for brokers whose Velocity API keys return 400 errors.
 * Run scripts/test-api-keys.ts first to identify which brokers have invalid keys.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const INVALID_BROKERS = [
  "Amanda Weeks",
  "Jayashree Venkatachalam",
  "Kam Virdi",
  "Karen John",
  "Keenan Marshall",
  "Nazneen Nasir Khan",
  "Patrick Khouri",
  "Pina Cundari",
  "Prem Hoonjan",
  "Shawn Cantwell",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`\nDeactivating ${INVALID_BROKERS.length} brokers with invalid API keys...\n`);

  const { data, error } = await supabase
    .from("vl_brokers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("name", INVALID_BROKERS)
    .select("name, is_active");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("Deactivated:");
  data?.forEach((b) => console.log(`  ✗ ${b.name}`));
  console.log(`\nDone! ${data?.length || 0} brokers marked as inactive.`);
}

main();
