"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { syncDeal } from "@/lib/sync-deal";
import { fetchDealsInRange } from "@/lib/velocity-api";
import { revalidatePath } from "next/cache";

interface Broker {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
}

interface RefreshResult {
  success: boolean;
  message: string;
  dealsSynced: number;
  dealsFailed: number;
}

export async function refreshDeals(brokerId?: string): Promise<RefreshResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: "Unauthorized",
      dealsSynced: 0,
      dealsFailed: 0,
    };
  }

  const userIsAdmin = await isAdmin(user.email);
  const adminSupabase = await createAdminClient();

  // Determine which broker(s) to sync
  let brokersToSync: Broker[] = [];

  if (userIsAdmin && !brokerId) {
    // Admin refreshing all
    const { data } = await adminSupabase
      .from("vl_brokers")
      .select("id, name, api_key, base_url")
      .eq("is_active", true);
    brokersToSync = data || [];
  } else if (userIsAdmin && brokerId) {
    // Admin refreshing specific broker
    const { data } = await adminSupabase
      .from("vl_brokers")
      .select("id, name, api_key, base_url")
      .eq("id", brokerId)
      .eq("is_active", true)
      .maybeSingle();
    if (data) brokersToSync = [data];
  } else {
    // Broker refreshing their own
    const { data } = await adminSupabase
      .from("vl_brokers")
      .select("id, name, api_key, base_url")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (data) brokersToSync = [data];
  }

  if (brokersToSync.length === 0) {
    return {
      success: false,
      message: "No broker found",
      dealsSynced: 0,
      dealsFailed: 0,
    };
  }

  let totalSynced = 0;
  let totalFailed = 0;

  for (const broker of brokersToSync) {
    try {
      // Get last deal date for smart range
      const { data: lastDeal } = await adminSupabase
        .from("vl_deals")
        .select("date_created")
        .eq("broker_id", broker.id)
        .order("date_created", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startDate =
        lastDeal?.date_created?.split("T")[0] ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      // Fetch and sync deals
      const deals = await fetchDealsInRange(broker, startDate, endDate);
      const results = await Promise.all(
        deals.map((d) => syncDeal(d, broker.id))
      );

      const synced = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      // Update broker sync status
      await adminSupabase
        .from("vl_brokers")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_deals_count: deals.length,
          last_sync_error: failed > 0 ? `${failed} deals failed` : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", broker.id);

      totalSynced += synced;
      totalFailed += failed;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Update broker with error
      await adminSupabase
        .from("vl_brokers")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", broker.id);

      // Continue with other brokers
      console.error(`[REFRESH] ${broker.name} ERROR:`, errorMsg);
    }

    // Rate limit between brokers
    if (brokersToSync.length > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  revalidatePath("/deals");

  return {
    success: true,
    message: `Refreshed ${brokersToSync.length} broker(s)`,
    dealsSynced: totalSynced,
    dealsFailed: totalFailed,
  };
}
