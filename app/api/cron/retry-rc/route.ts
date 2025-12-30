import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRecordingInsights } from "@/lib/ringcentral";

/**
 * /api/cron/retry-rc - Retry failed RC recording syncs
 *
 * Reads from rc_sync_failures table, re-fetches insights from RC,
 * and attempts to upsert again. Marks resolved on success.
 *
 * @auth Bearer token in Authorization header (CRON_SECRET)
 *
 * @usage
 * ```bash
 * # Retry up to 10 failures (default)
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/retry-rc"
 *
 * # Retry up to 50 failures
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/retry-rc?limit=50"
 *
 * # Retry failures for specific extension
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/retry-rc?extensionId=660583043"
 * ```
 *
 * @param limit - Max records to retry (default: 10)
 * @param extensionId - Filter by extension (optional)
 * @param domain - RC domain (default: pbx)
 *
 * @returns JSON with retry results, still-failing records updated in rc_sync_failures
 */

const CRON_SECRET = process.env.CRON_SECRET;

interface TranscriptEntry {
  text?: string;
  speakerId?: string;
  start?: number;
  end?: number;
}

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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const extensionId = searchParams.get("extensionId");
  const domain = searchParams.get("domain") || "pbx";

  const supabase = getSupabase();

  try {
    // Get unresolved failures
    let query = supabase
      .from("rc_sync_failures")
      .select("*")
      .eq("resolved", false)
      .order("failed_at", { ascending: true })
      .limit(limit);

    if (extensionId) {
      query = query.eq("extension_id", extensionId);
    }

    const { data: failures, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!failures || failures.length === 0) {
      return NextResponse.json({
        message: "No failures to retry",
        durationMs: Date.now() - startTime,
      });
    }

    console.log(`Retrying ${failures.length} failed recordings`);

    const results = await Promise.all(
      failures.map(async (failure) => {
        try {
          // Re-fetch insights from RC
          const insights = await getRecordingInsights(failure.source_record_id, domain);

          if (!insights) {
            return { success: false, recordId: failure.source_record_id, error: "No insights returned" };
          }

          const transcriptText = extractTranscriptText(
            insights.insights?.Transcript as TranscriptEntry[] | undefined
          );

          // Upsert to rc_recordings
          const { error: upsertError } = await supabase.from("rc_recordings").upsert(
            {
              source_record_id: insights.sourceRecordId,
              source_session_id: insights.sourceSessionId,
              title: insights.title,
              rs_record_uri: insights.rsRecordUri,
              domain: insights.domain || domain,
              call_direction: insights.callDirection,
              owner_extension_id: insights.ownerExtensionId,
              recording_duration_ms: insights.recordingDurationMs,
              recording_start_time: insights.recordingStartTime,
              creation_time: insights.creationTime,
              last_modified_time: insights.lastModifiedTime,
              speaker_info: insights.speakerInfo ?? [],
              insights: insights.insights ?? {},
              transcript_text: transcriptText,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "source_record_id" }
          );

          if (upsertError) throw upsertError;

          // Mark as resolved
          await supabase
            .from("rc_sync_failures")
            .update({ resolved: true, retried_at: new Date().toISOString() })
            .eq("source_record_id", failure.source_record_id);

          return { success: true, recordId: failure.source_record_id };
        } catch (error) {
          // Update failure with new error
          await supabase
            .from("rc_sync_failures")
            .update({
              error_message: error instanceof Error ? error.message : "Unknown error",
              failed_at: new Date().toISOString(),
            })
            .eq("source_record_id", failure.source_record_id);

          return {
            success: false,
            recordId: failure.source_record_id,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    const retried = results.filter((r) => r.success).length;
    const stillFailed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Retried ${failures.length} failures: ${retried} resolved, ${stillFailed} still failing`,
      retried,
      stillFailed,
      durationMs: Date.now() - startTime,
      details: results,
    });
  } catch (error) {
    console.error("RC Retry error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
