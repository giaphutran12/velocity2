import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { listExtensions } from "@/lib/ringcentral";

/**
 * /api/debug-rc/sync-stats - Diagnose why rc_recordings has fewer rows than expected
 *
 * @usage
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/debug-rc/sync-stats"
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  try {
    // 1. Total recordings in database
    const { count: totalRecordings } = await supabase
      .from("rc_recordings")
      .select("*", { count: "exact", head: true });

    // 2. Recordings by extension (who has the most?)
    const { data: byExtension } = await supabase
      .from("rc_recordings")
      .select("owner_extension_id")
      .then(async (res) => {
        if (!res.data) return { data: [] };
        const counts: Record<string, number> = {};
        for (const r of res.data) {
          const ext = r.owner_extension_id || "unknown";
          counts[ext] = (counts[ext] || 0) + 1;
        }
        return {
          data: Object.entries(counts)
            .map(([ext, count]) => ({ extension_id: ext, count }))
            .sort((a, b) => b.count - a.count),
        };
      });

    // 3. Recordings by date (when were they recorded?)
    const { data: byDate } = await supabase
      .from("rc_recordings")
      .select("recording_start_time")
      .order("recording_start_time", { ascending: false })
      .limit(1000)
      .then((res) => {
        if (!res.data) return { data: [] };
        const counts: Record<string, number> = {};
        for (const r of res.data) {
          const date = r.recording_start_time
            ? new Date(r.recording_start_time).toISOString().split("T")[0]
            : "unknown";
          counts[date] = (counts[date] || 0) + 1;
        }
        return {
          data: Object.entries(counts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30), // Last 30 days
        };
      });

    // 4. Sync failures
    const { data: failures, count: failureCount } = await supabase
      .from("rc_sync_failures")
      .select("*", { count: "exact" })
      .eq("resolved", false)
      .limit(10);

    // 5. Mapped brokers in vl_brokers
    const { data: mappedBrokers } = await supabase
      .from("vl_brokers")
      .select("name, rc_extension_id")
      .not("rc_extension_id", "is", null);

    // 6. RC extensions (from API)
    let rcExtensions: { id: string; name: string }[] = [];
    try {
      const exts = await listExtensions();
      rcExtensions = exts.map((e) => ({ id: e.id, name: e.name }));
    } catch (e) {
      console.error("Failed to fetch RC extensions:", e);
    }

    // 7. Cross-reference: which extensions are mapped vs not
    const mappedIds = new Set(mappedBrokers?.map((b) => b.rc_extension_id) || []);
    const unmappedExtensions = rcExtensions.filter((e) => !mappedIds.has(e.id));
    const mappedExtensions = rcExtensions.filter((e) => mappedIds.has(e.id));

    // 8. Which mapped brokers have recordings?
    const extensionsWithRecordings = new Set(byExtension?.map((e) => e.extension_id) || []);
    const mappedWithoutRecordings = mappedBrokers?.filter(
      (b) => b.rc_extension_id && !extensionsWithRecordings.has(b.rc_extension_id)
    );

    return NextResponse.json({
      summary: {
        totalRecordings,
        totalMappedBrokers: mappedBrokers?.length || 0,
        totalRcExtensions: rcExtensions.length,
        unmappedExtensions: unmappedExtensions.length,
        unresolvedFailures: failureCount || 0,
        mappedBrokersWithoutRecordings: mappedWithoutRecordings?.length || 0,
      },
      hypothesis1_OnlyGarryHasInsights: {
        description: "If true, Garry (660583043) should have most/all recordings",
        recordingsByExtension: byExtension?.slice(0, 10),
      },
      hypothesis2_MappingIncomplete: {
        description: "Extensions exist in RC but not mapped to vl_brokers",
        mappedBrokers: mappedBrokers?.map((b) => ({ name: b.name, ext: b.rc_extension_id })),
        unmappedExtensions: unmappedExtensions.slice(0, 10),
        mappedExtensionsNotInDb: mappedWithoutRecordings,
      },
      hypothesis3_RecentRecordingsOnly: {
        description: "If RingSense just enabled, only recent recordings have insights",
        recordingsByDate: byDate,
      },
      syncFailures: {
        count: failureCount,
        samples: failures?.slice(0, 5),
      },
    });
  } catch (error) {
    console.error("Debug stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
