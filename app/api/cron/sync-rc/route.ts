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
 * @param extensionId - RC extension ID (default: 660583043 / Garry)
 * @param dateFrom - ISO date string (default: 30 days ago)
 * @param dateTo - ISO date string (default: now)
 * @param domain - RC domain: pbx|rcv|rcx|nice-incontact|ms-teams (default: pbx)
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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;

  // Parse query params
  const GARRY_EXTENSION_ID = "660583043";
  const extensionId = searchParams.get("extensionId") || GARRY_EXTENSION_ID;
  const domain = searchParams.get("domain") || "pbx";

  // Default date range: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dateFrom = searchParams.get("dateFrom") || thirtyDaysAgo.toISOString();
  const dateTo = searchParams.get("dateTo") || now.toISOString();

  try {
    // Fetch recordings with insights from RingCentral
    console.log(`Fetching RC recordings for extension ${extensionId} from ${dateFrom} to ${dateTo}`);

    const recordings = await fetchRecordingsWithInsights(extensionId, {
      dateFrom,
      dateTo,
      domain,
    });

    console.log(`Found ${recordings.length} recordings with insights`);

    if (recordings.length === 0) {
      return NextResponse.json({
        message: "No recordings found",
        extensionId,
        dateFrom,
        dateTo,
        domain,
        durationMs: Date.now() - startTime,
      });
    }

    // Sync to Supabase
    const supabase = getSupabase();
    const results = await Promise.all(
      recordings.map(async (rec) => {
        try {
          const transcriptText = extractTranscriptText(
            rec.insights?.Transcript as TranscriptEntry[] | undefined
          );

          // Validate fields to avoid CHECK constraint violations
          const validDomain = validateDomain(rec.domain, domain);
          const validDirection = normalizeCallDirection(rec.callDirection);

          const { error } = await supabase.from("rc_recordings").upsert(
            {
              source_record_id: rec.sourceRecordId,
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
          return { success: true, recordId: rec.sourceRecordId };
        } catch (error) {
          const errorMsg = formatError(error);
          console.error(`Failed to sync record ${rec.sourceRecordId}:`, errorMsg);
          return {
            success: false,
            recordId: rec.sourceRecordId,
            error: errorMsg,
          };
        }
      })
    );

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success) as Array<{
      success: false;
      recordId: string;
      error: string;
    }>;
    const duration = Date.now() - startTime;

    // Log failures to database for retry
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

    // Mark successful records as resolved (if they were previously failed)
    if (successful.length > 0) {
      const successIds = successful.map((s) => s.recordId);
      await supabase
        .from("rc_sync_failures")
        .update({ resolved: true, retried_at: new Date().toISOString() })
        .in("source_record_id", successIds);
    }

    return NextResponse.json({
      message: `Synced ${successful.length}/${recordings.length} recordings`,
      extensionId,
      dateFrom,
      dateTo,
      domain,
      recordingsFound: recordings.length,
      successful: successful.length,
      failed: failed.length,
      failedLogged: failed.length > 0,
      durationMs: duration,
      failedDetails: failed.length > 0 ? failed : undefined,
    });
  } catch (error) {
    console.error("RC Cron Sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        extensionId,
        dateFrom,
        dateTo,
        domain,
      },
      { status: 500 }
    );
  }
}
