import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testBroker(name: string, startDate: string, endDate: string) {
  const { data: broker } = await supabase
    .from("vl_brokers")
    .select("name, base_url, api_key")
    .eq("name", name)
    .single();

  if (!broker) {
    console.log(`Broker ${name} not found`);
    return;
  }

  const url = `${broker.base_url}/v1/deals?apikey=${broker.api_key}&startdate=${startDate}&enddate=${endDate}&datetype=1&page=1`;

  console.log(`Testing ${name}: ${startDate} to ${endDate}`);
  console.log(`URL: ${url.replace(broker.api_key, "***")}`);

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  console.log(`Status: ${response.status}`);

  if (response.ok) {
    const data = await response.json();
    console.log(`Success! Total deals: ${data.totalDeals}`);
  } else {
    const text = await response.text();
    console.log(`Error: ${text}`);
  }
  console.log("");
}

async function main() {
  // Test a failing broker with different dates
  const failingBroker = "Alika Walia";
  const workingBroker = "Sunny Dhillon";

  console.log("=== HYPOTHESIS: Date format or year 2026 issue ===\n");

  // Test failing broker with 2026 date
  await testBroker(failingBroker, "2026-01-01", "2026-01-01");

  // Test failing broker with 2025 date
  await testBroker(failingBroker, "2025-12-31", "2025-12-31");

  // Test failing broker with 2025 range
  await testBroker(failingBroker, "2025-12-01", "2025-12-31");

  // Test working broker with 2026 date
  await testBroker(workingBroker, "2026-01-01", "2026-01-01");

  // Test working broker with 2025 date
  await testBroker(workingBroker, "2025-12-31", "2025-12-31");
}

main().catch(console.error);
