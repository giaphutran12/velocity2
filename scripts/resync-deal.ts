/**
 * Re-sync specific deal(s) to fix duplicate liabilities
 *
 * This fetches the deal from Velocity API and re-syncs it through our API,
 * which now has delete-before-insert logic to prevent duplicates.
 *
 * Usage:
 *   npx tsx scripts/resync-deal.ts VBLUE-113033
 *   npx tsx scripts/resync-deal.ts VBLUE-113033 VBLUE-111953 VBLUE-113094
 *   npx tsx scripts/resync-deal.ts --broker "Karny"  # Re-sync all deals for a broker
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET!;

if (!supabaseUrl || !supabaseKey || !cronSecret) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or CRON_SECRET");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CLI args
const args = process.argv.slice(2);
const brokerIdx = args.indexOf("--broker");
const brokerFilter = brokerIdx !== -1 ? args[brokerIdx + 1] : null;
const loanCodes = args.filter(a => a.startsWith("VBLUE-"));

interface Broker {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
}

interface VelocityDeal {
  loanCode: string;
  // ... other fields from Velocity API
}

// Fetch a single deal from Velocity API
async function fetchDealFromVelocity(broker: Broker, loanCode: string): Promise<VelocityDeal | null> {
  const url = `${broker.base_url}/v1/deal?apikey=${broker.api_key}&loancode=${loanCode}`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(`  Velocity API error for ${loanCode}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`  Error fetching ${loanCode}:`, error);
    return null;
  }
}

// Sync deal through our API
async function syncDeal(deal: VelocityDeal, brokerId: string): Promise<boolean> {
  // Call our sync API which has the delete-before-insert fix
  const syncUrl = process.env.SYNC_API_URL || "http://localhost:3000/api/sync";

  try {
    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ deals: [{ ...deal, broker_id: brokerId }] }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`  Sync API error: ${response.status} - ${text}`);
      return false;
    }

    const result = await response.json();
    return result.successful > 0;
  } catch (error) {
    console.error(`  Sync error:`, error);
    return false;
  }
}

async function main() {
  console.log("\n=== Re-sync Deals to Fix Duplicates ===\n");

  // Get deals to re-sync
  let dealsToSync: { loanCode: string; brokerId: string; brokerName: string; broker: Broker }[] = [];

  if (brokerFilter) {
    // Get all deals for a broker
    const { data: broker } = await supabase
      .from("vl_brokers")
      .select("id, name, api_key, base_url")
      .ilike("name", `%${brokerFilter}%`)
      .single();

    if (!broker) {
      console.error(`Broker not found: ${brokerFilter}`);
      process.exit(1);
    }

    console.log(`Broker: ${broker.name}`);

    const { data: deals } = await supabase
      .from("vl_deals")
      .select("loan_code")
      .eq("broker_id", broker.id);

    if (!deals || deals.length === 0) {
      console.log("No deals found for this broker");
      return;
    }

    dealsToSync = deals.map(d => ({
      loanCode: d.loan_code,
      brokerId: broker.id,
      brokerName: broker.name,
      broker: broker as Broker,
    }));

    console.log(`Found ${dealsToSync.length} deals to re-sync\n`);
  } else if (loanCodes.length > 0) {
    // Get specific deals
    for (const loanCode of loanCodes) {
      const { data: deal } = await supabase
        .from("vl_deals")
        .select(`loan_code, broker_id, broker:vl_brokers(id, name, api_key, base_url)`)
        .eq("loan_code", loanCode)
        .single();

      if (!deal) {
        console.error(`Deal not found: ${loanCode}`);
        continue;
      }

      const broker = deal.broker as unknown as Broker;
      if (!broker?.api_key) {
        console.error(`No broker credentials for: ${loanCode}`);
        continue;
      }

      dealsToSync.push({
        loanCode: deal.loan_code,
        brokerId: broker.id,
        brokerName: broker.name,
        broker,
      });
    }

    console.log(`Found ${dealsToSync.length} deals to re-sync\n`);
  } else {
    console.error("Usage: npx tsx scripts/resync-deal.ts VBLUE-113033 [VBLUE-xxx ...]");
    console.error("   or: npx tsx scripts/resync-deal.ts --broker \"Karny\"");
    process.exit(1);
  }

  // Re-sync each deal
  let success = 0;
  let failed = 0;

  for (const deal of dealsToSync) {
    process.stdout.write(`[${success + failed + 1}/${dealsToSync.length}] ${deal.loanCode}... `);

    // Fetch fresh data from Velocity
    const velocityDeal = await fetchDealFromVelocity(deal.broker, deal.loanCode);
    if (!velocityDeal) {
      console.log("SKIP (not in Velocity)");
      failed++;
      continue;
    }

    // Sync through our API (which has the fix)
    const ok = await syncDeal(velocityDeal, deal.brokerId);
    if (ok) {
      console.log("✓");
      success++;
    } else {
      console.log("FAILED");
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Done ===`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
