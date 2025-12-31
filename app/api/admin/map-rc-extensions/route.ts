import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listExtensions, RCExtension } from "@/lib/ringcentral";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") !== "false";

  try {
    // Fetch RC extensions
    const extensions = await listExtensions();
    console.log(`Found ${extensions.length} RC extensions`);

    // Fetch VL brokers
    const { data: brokers, error: brokersError } = await supabase
      .from("vl_brokers")
      .select("id, name, rc_extension_id");

    if (brokersError) throw brokersError;
    console.log(`Found ${brokers?.length} VL brokers`);

    // Build mapping
    const matches: Array<{
      brokerId: string;
      brokerName: string;
      extensionId: string;
      extensionName: string;
      extensionNumber: string;
      alreadyMapped: boolean;
    }> = [];

    const unmatched: Array<{ brokerName: string; brokerId: string }> = [];
    const unmatchedExtensions: RCExtension[] = [];

    // Create extension lookup by normalized name
    const extensionByName = new Map<string, RCExtension>();
    for (const ext of extensions) {
      if (ext.status !== "Enabled") continue;
      const normalized = normalizeName(ext.name);
      extensionByName.set(normalized, ext);
    }

    // Match brokers to extensions
    for (const broker of brokers || []) {
      const normalizedBroker = normalizeName(broker.name);
      const matchedExt = extensionByName.get(normalizedBroker);

      if (matchedExt) {
        matches.push({
          brokerId: broker.id,
          brokerName: broker.name,
          extensionId: matchedExt.id,
          extensionName: matchedExt.name,
          extensionNumber: matchedExt.extensionNumber,
          alreadyMapped: !!broker.rc_extension_id,
        });
        extensionByName.delete(normalizedBroker);
      } else {
        unmatched.push({ brokerName: broker.name, brokerId: broker.id });
      }
    }

    // Remaining extensions that didn't match
    unmatchedExtensions.push(...extensionByName.values());

    // Apply updates if not dry run
    let updated = 0;
    if (!dryRun) {
      for (const match of matches) {
        if (match.alreadyMapped) continue;

        const { error } = await supabase
          .from("vl_brokers")
          .update({ rc_extension_id: match.extensionId })
          .eq("id", match.brokerId);

        if (error) {
          console.error(`Failed to update ${match.brokerName}:`, error);
        } else {
          updated++;
        }
      }
    }

    return NextResponse.json({
      dryRun,
      summary: {
        totalExtensions: extensions.length,
        totalBrokers: brokers?.length || 0,
        matched: matches.length,
        alreadyMapped: matches.filter((m) => m.alreadyMapped).length,
        unmatchedBrokers: unmatched.length,
        unmatchedExtensions: unmatchedExtensions.length,
        updated: dryRun ? 0 : updated,
      },
      matches,
      unmatchedBrokers: unmatched,
      unmatchedExtensions: unmatchedExtensions.map((e) => ({
        id: e.id,
        name: e.name,
        extensionNumber: e.extensionNumber,
      })),
    });
  } catch (error) {
    console.error("Extension mapping error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
