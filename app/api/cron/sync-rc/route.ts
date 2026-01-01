import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fetchRecordingsWithInsights } from "@/lib/ringcentral";

/**
 * /api/cron/sync-rc - Sync RingCentral recordings to Supabase
 *
 * Fetches call recordings with RingSense insights from RingCentral API
 * and upserts them to the rc_recordings table.
 *
 * @auth Bearer token in Authorization header (CRON_SECRET)
 *
 * @usage
 * ```bash
 * # Sync ALL brokers with RC mappings (recommended)
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/sync-rc?extensionId=all"
 *
 * # Sync default extension (Garry) for last 30 days
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/sync-rc"
 *
 * # Sync specific extension
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/sync-rc?extensionId=660583043"
 *
 * # Sync with date range
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/sync-rc?dateFrom=2024-12-01T00:00:00Z&dateTo=2024-12-31T23:59:59Z"
 * ```
 *
 * @param extensionId - RC extension ID, or "all" for all mapped brokers (default: 660583043 / Garry)
 * @param dateFrom - ISO date string (default: 30 days ago)
 * @param dateTo - ISO date string (default: now)
 * @param domain - RC domain: pbx|rcv|rcx|nice-incontact|ms-teams (default: pbx)
 * @param fullSync - Set to "true" to disable smart sync and fetch all recordings in date range
 *
 * Smart Sync (default): Only fetches recordings newer than the last synced recording for each extension.
 * This avoids re-fetching thousands of recordings that are already in the database.
 *
 * @returns JSON with sync results, failures logged to rc_sync_failures table
 */

const CRON_SECRET = process.env.CRON_SECRET;

interface TranscriptEntry {
  text?: string;
  speakerId?: string;
  start?: number;
  end?: number;
}

/**
 * Extracts plain text from RingSense transcript array
 * @param transcript - Array of transcript entries with text, speakerId, timestamps
 * @returns Concatenated text or null if no valid entries
 */
function extractTranscriptText(
  transcript: TranscriptEntry[] | undefined
): string | null {
  if (!transcript || !Array.isArray(transcript)) {
    return null;
  }

  const texts = transcript
    .map((entry) => entry.text)
    .filter((text): text is string => typeof text === "string" && text.length > 0);

  return texts.length > 0 ? texts.join(" ") : null;
}

const VALID_DOMAINS = ["pbx", "rcv", "rcx", "nice-incontact", "ms-teams"] as const;
const VALID_DIRECTIONS = ["Inbound", "Outbound"] as const;

/**
 * Validates and normalizes call direction to match DB constraint
 * @param direction - Raw direction from RC API (could be null, different casing)
 * @returns Valid direction or null if invalid/missing
 */
function normalizeCallDirection(direction: string | undefined | null): string | null {
  if (!direction) return null;

  // Normalize casing: "inbound" -> "Inbound", "OUTBOUND" -> "Outbound"
  const normalized = direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase();

  if (VALID_DIRECTIONS.includes(normalized as typeof VALID_DIRECTIONS[number])) {
    return normalized;
  }

  console.warn(`Invalid call_direction: "${direction}" (normalized: "${normalized}")`);
  return null;
}

/**
 * Validates domain against DB constraint
 * @param domain - Domain from RC API
 * @param fallback - Fallback domain if invalid
 * @returns Valid domain
 */
function validateDomain(domain: string | undefined | null, fallback: string): string {
  if (domain && VALID_DOMAINS.includes(domain as typeof VALID_DOMAINS[number])) {
    return domain;
  }
  if (domain) {
    console.warn(`Invalid domain: "${domain}", using fallback: "${fallback}"`);
  }
  return fallback;
}

/**
 * Formats error for logging - handles Supabase errors which may not have .message
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    // Supabase errors often have { message, details, hint, code }
    const e = error as Record<string, unknown>;
    if (e.message) return String(e.message);
    if (e.code) return `Code: ${e.code}${e.details ? ` - ${e.details}` : ""}`;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Converts empty strings to null for TIMESTAMPTZ columns
 * PostgreSQL can't parse "" as a timestamp
 */
function toTimestamp(value: string | undefined | null): string | null {
  if (!value || value === "") return null;
  return value;
}

async function syncExtension(
  supabase: ReturnType<typeof getSupabase>,
  extensionId: string,
  domain: string,
  dateFrom: string,
  dateTo: string,
  useSmartSync: boolean = true
): Promise<{
  extensionId: string;
  recordingsFound: number;
  successful: number;
  failed: number;
  skippedDueToSmartSync: boolean;
  effectiveDateFrom: string;
  failedDetails?: Array<{ recordId: string; error: string }>;
}> {
  let effectiveDateFrom = dateFrom;

  // Smart sync: check last synced recording for this extension
  if (useSmartSync) {
    const { data: lastSynced } = await supabase
      .from("rc_recordings")
      .select("recording_start_time")
      .eq("owner_extension_id", extensionId)
      .order("recording_start_time", { ascending: false })
      .limit(1)
      .single();

    if (lastSynced?.recording_start_time) {
      // Use last synced time minus 1 day buffer (to catch any stragglers)
      const lastTime = new Date(lastSynced.recording_start_time);
      const bufferTime = new Date(lastTime.getTime() - 24 * 60 * 60 * 1000);

      // Only use smart date if it's more recent than the requested dateFrom
      if (bufferTime > new Date(dateFrom)) {
        effectiveDateFrom = bufferTime.toISOString();
        console.log(`Smart sync: last recording at ${lastSynced.recording_start_time}, using ${effectiveDateFrom} as dateFrom`);
      }
    }
  }

  console.log(`Fetching RC recordings for extension ${extensionId} from ${effectiveDateFrom} to ${dateTo}`);

  // Query existing record IDs to skip (avoid re-fetching insights we already have)
  const { data: existingRecords } = await supabase
    .from("rc_recordings")
    .select("source_record_id")
    .eq("owner_extension_id", extensionId)
    .gte("recording_start_time", effectiveDateFrom);

  const skipRecordIds = new Set(
    existingRecords?.map((r) => r.source_record_id).filter((id): id is string => !!id) || []
  );
  if (skipRecordIds.size > 0) {
    console.log(`  Found ${skipRecordIds.size} existing records to skip`);
  }

  // Track results progressively as each record is fetched and inserted
  const successful: Array<{ recordId: string }> = [];
  const failed: Array<{ recordId: string; error: string }> = [];

  // Progressive insert callback - each record is inserted immediately after fetching insights
  // This ensures crash resilience: if sync fails mid-way, already-processed records are in DB
  const onRecordFetched = async (rec: Awaited<ReturnType<typeof fetchRecordingsWithInsights>>[0], index: number, total: number) => {
    const recordId = rec.sourceRecordId;
    if (!recordId) {
      console.warn(`  Skipping record ${index}: no sourceRecordId`);
      return;
    }

    try {
      const transcriptText = extractTranscriptText(
        rec.insights?.Transcript as TranscriptEntry[] | undefined
      );

      const validDomain = validateDomain(rec.domain, domain);
      const validDirection = normalizeCallDirection(rec.callDirection);

      const { error } = await supabase.from("rc_recordings").upsert(
        {
          source_record_id: recordId,
          source_session_id: rec.sourceSessionId,
          title: rec.title,
          rs_record_uri: rec.rsRecordUri,
          domain: validDomain,
          call_direction: validDirection,
          owner_extension_id: rec.ownerExtensionId,
          recording_duration_ms: rec.recordingDurationMs,
          recording_start_time: toTimestamp(rec.recordingStartTime),
          creation_time: toTimestamp(rec.creationTime),
          last_modified_time: toTimestamp(rec.lastModifiedTime),
          speaker_info: rec.speakerInfo ?? [],
          insights: rec.insights ?? {},
          transcript_text: transcriptText,
          audio_content_uri: rec.audioContentUri,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "source_record_id" }
      );

      if (error) throw error;
      successful.push({ recordId });

      if ((index + 1) % 10 === 0 || index === total - 1) {
        console.log(`  Inserted ${index + 1}/${total} (${successful.length} ok, ${failed.length} failed)`);
      }
    } catch (error) {
      const errorMsg = formatError(error);
      console.error(`Failed to sync record ${recordId}:`, errorMsg);
      failed.push({ recordId, error: errorMsg });
    }
  };

  const recordings = await fetchRecordingsWithInsights(extensionId, {
    dateFrom: effectiveDateFrom,
    dateTo,
    domain,
    onRecordFetched,
    skipRecordIds,
  });

  if (recordings.length === 0) {
    return {
      extensionId,
      recordingsFound: 0,
      successful: 0,
      failed: 0,
      skippedDueToSmartSync: effectiveDateFrom !== dateFrom,
      effectiveDateFrom,
    };
  }

  // Log failures to database
  if (failed.length > 0) {
    await Promise.all(
      failed.map((f) =>
        supabase.from("rc_sync_failures").upsert(
          {
            source_record_id: f.recordId,
            extension_id: extensionId,
            error_message: f.error,
            failed_at: new Date().toISOString(),
            resolved: false,
          },
          { onConflict: "source_record_id", ignoreDuplicates: false }
        )
      )
    );
  }

  // Mark successful records as resolved
  if (successful.length > 0) {
    const successIds = successful.map((s) => s.recordId);
    await supabase
      .from("rc_sync_failures")
      .update({ resolved: true, retried_at: new Date().toISOString() })
      .in("source_record_id", successIds);
  }

  return {
    extensionId,
    recordingsFound: recordings.length,
    successful: successful.length,
    failed: failed.length,
    skippedDueToSmartSync: effectiveDateFrom !== dateFrom,
    effectiveDateFrom,
    failedDetails: failed.length > 0 ? failed.map((f) => ({ recordId: f.recordId, error: f.error })) : undefined,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Parse query params
  const GARRY_EXTENSION_ID = "660583043";
  const extensionIdParam = searchParams.get("extensionId") || GARRY_EXTENSION_ID;
  const domain = searchParams.get("domain") || "pbx";

  // Default date range: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dateFrom = searchParams.get("dateFrom") || thirtyDaysAgo.toISOString();
  const dateTo = searchParams.get("dateTo") || now.toISOString();
  const startFrom = searchParams.get("startFrom"); // Resume from this broker name
  const fullSync = searchParams.get("fullSync") === "true"; // Disable smart sync, fetch all

  const supabase = getSupabase();

  try {
    // Handle extensionId=all - sync all mapped brokers
    if (extensionIdParam === "all") {
      const { data: brokers, error: brokersError } = await supabase
        .from("vl_brokers")
        .select("rc_extension_id, name")
        .not("rc_extension_id", "is", null);

      if (brokersError) throw brokersError;

      if (!brokers || brokers.length === 0) {
        return NextResponse.json({
          message: "No brokers with RC extension mappings found",
          durationMs: Date.now() - startTime,
        });
      }

      // Sort by name for consistent ordering (important for resume)
      brokers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      // Resume logic: skip brokers until we find startFrom
      let brokersToSync = brokers;
      let skippedCount = 0;
      if (startFrom) {
        const startIndex = brokers.findIndex(
          (b) => b.name?.toLowerCase() === startFrom.toLowerCase()
        );
        if (startIndex === -1) {
          return NextResponse.json(
            { error: `Broker "${startFrom}" not found. Available: ${brokers.map((b) => b.name).join(", ")}` },
            { status: 400 }
          );
        }
        brokersToSync = brokers.slice(startIndex);
        skippedCount = startIndex;
        console.log(`Resuming from "${startFrom}" (skipping ${skippedCount} brokers)`);
      }

      console.log(`Syncing ${brokersToSync.length} brokers${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}...`);

      const allResults = [];
      for (let i = 0; i < brokersToSync.length; i++) {
        const broker = brokersToSync[i];
        const nextBroker = brokersToSync[i + 1]?.name || null;
        console.log(`\n--- [${i + 1}/${brokersToSync.length}] Syncing ${broker.name} (${broker.rc_extension_id}) ---`);
        console.log(`    If this fails, resume with: ?extensionId=all&startFrom=${encodeURIComponent(broker.name)}`);

        const result = await syncExtension(supabase, broker.rc_extension_id, domain, dateFrom, dateTo, !fullSync);
        allResults.push({ brokerName: broker.name, nextBroker, ...result });

        // Rate limiting between brokers
        await new Promise((r) => setTimeout(r, 2000));
      }

      const totalRecordings = allResults.reduce((sum, r) => sum + r.recordingsFound, 0);
      const totalSuccessful = allResults.reduce((sum, r) => sum + r.successful, 0);
      const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

      return NextResponse.json({
        message: `Synced ${totalSuccessful}/${totalRecordings} recordings across ${brokersToSync.length} brokers${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`,
        brokersProcessed: brokersToSync.length,
        brokersSkipped: skippedCount,
        brokersTotal: brokers.length,
        totalRecordings,
        totalSuccessful,
        totalFailed,
        dateFrom,
        dateTo,
        domain,
        startedFrom: startFrom || brokers[0]?.name,
        durationMs: Date.now() - startTime,
        brokerResults: allResults,
      });
    }

    // Single extension sync (original behavior)
    const result = await syncExtension(supabase, extensionIdParam, domain, dateFrom, dateTo, !fullSync);

    if (result.recordingsFound === 0) {
      return NextResponse.json({
        message: result.skippedDueToSmartSync
          ? "No new recordings found (smart sync active)"
          : "No recordings found",
        extensionId: extensionIdParam,
        dateFrom,
        effectiveDateFrom: result.effectiveDateFrom,
        dateTo,
        domain,
        smartSync: !fullSync,
        durationMs: Date.now() - startTime,
      });
    }

    return NextResponse.json({
      message: `Synced ${result.successful}/${result.recordingsFound} recordings`,
      extensionId: extensionIdParam,
      dateFrom,
      effectiveDateFrom: result.effectiveDateFrom,
      dateTo,
      domain,
      smartSync: !fullSync,
      recordingsFound: result.recordingsFound,
      successful: result.successful,
      failed: result.failed,
      failedLogged: result.failed > 0,
      durationMs: Date.now() - startTime,
      failedDetails: result.failedDetails,
    });
  } catch (error) {
    console.error("RC Cron Sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        extensionId: extensionIdParam,
        dateFrom,
        dateTo,
        domain,
      },
      { status: 500 }
    );
  }
}
