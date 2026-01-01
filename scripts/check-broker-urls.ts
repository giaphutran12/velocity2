import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const workingBrokers = [
  "Gurjit Sandhu",
  "Jennifer Souvanvong",
  "Karny Mehat",
  "Shaneen Mohammed",
  "Sunny Dhillon",
  "Valerie Roy",
];

async function main() {
  const { data: brokers } = await supabase
    .from("vl_brokers")
    .select("name, base_url, api_key, last_sync_at, is_active")
    .order("name");

  console.log("=== WORKING BROKERS ===");
  for (const b of brokers?.filter((b) => workingBrokers.includes(b.name)) ||
    []) {
    console.log(`${b.name}:`);
    console.log(`  base_url: ${b.base_url}`);
    console.log(`  api_key: ${b.api_key.substring(0, 20)}...`);
    console.log(`  last_sync: ${b.last_sync_at}`);
  }

  console.log("\n=== ALL FAILING BROKERS ===");
  for (const b of brokers?.filter((b) => !workingBrokers.includes(b.name)) ||
    []) {
    console.log(`${b.name}:`);
    console.log(`  base_url: ${b.base_url}`);
    console.log(`  api_key: ${b.api_key.substring(0, 20)}...`);
    console.log(`  last_sync: ${b.last_sync_at}`);
  }

  // Compare unique base_urls
  const workingUrls = new Set(
    brokers?.filter((b) => workingBrokers.includes(b.name)).map((b) => b.base_url)
  );
  const failingUrls = new Set(
    brokers?.filter((b) => !workingBrokers.includes(b.name)).map((b) => b.base_url)
  );

  console.log("\n=== UNIQUE BASE_URLS ===");
  console.log("Working:", [...workingUrls]);
  console.log("Failing:", [...failingUrls]);
}

main().catch(console.error);
