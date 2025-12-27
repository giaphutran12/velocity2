import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function main() {
  console.log("Checking broker deal distribution...\n");

  // Count deals with and without broker_id
  const { count: withBroker } = await supabase
    .from("vl_deals")
    .select("*", { count: "exact", head: true })
    .not("broker_id", "is", null);

  const { count: withoutBroker } = await supabase
    .from("vl_deals")
    .select("*", { count: "exact", head: true })
    .is("broker_id", null);

  console.log("=== Deal Distribution ===");
  console.log(`Deals WITH broker_id: ${withBroker}`);
  console.log(`Deals WITHOUT broker_id: ${withoutBroker}`);
  console.log(`Total: ${(withBroker || 0) + (withoutBroker || 0)}`);
  console.log("");

  // Get all brokers
  const { data: brokers } = await supabase
    .from("vl_brokers")
    .select("id, name")
    .order("name");

  console.log("=== Deals per Broker ===");

  for (const broker of brokers || []) {
    const { count } = await supabase
      .from("vl_deals")
      .select("*", { count: "exact", head: true })
      .eq("broker_id", broker.id);

    console.log(`${broker.name}: ${count || 0} deals`);
  }
}

main().catch(console.error);
