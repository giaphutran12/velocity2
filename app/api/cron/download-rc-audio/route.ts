import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { downloadRecordingAudio, RCRateLimitInfo } from "@/lib/ringcentral";

/**
 * /api/cron/download-rc-audio - Download RC audio files to Supabase Storage
 *
 * Downloads audio from RingCentral and uploads to Supabase Storage bucket.
 * Only processes recordings that have audio_content_uri but no audio_storage_path.
 *
 * @auth Bearer token in Authorization header (CRON_SECRET)
 *
 * @usage
 * ```bash
 * # Download up to 10 audio files (default)
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/download-rc-audio"
 *
 * # Download up to 50 audio files
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/download-rc-audio?limit=50"
 *
 * # Download specific recording
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/download-rc-audio?recordId=abc123"
 *
 * # Download with date range (last 7 days)
 * curl -H "Authorization: Bearer $CRON_SECRET" \
 *   "http://localhost:3000/api/cron/download-rc-audio?days=7"
 * ```
 *
 * @param limit - Max records to process (default: 10)
 * @param days - Only process recordings from last N days (default: 30)
 * @param recordId - Specific recording ID to download (optional)
 *
 * @returns JSON with download results
 */

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Slugify broker name for filesystem-safe folder names
 * "Garry Singh" → "garry-singh"
 */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Format timestamp in Vancouver time (handles DST automatically)
 * "2024-12-15T22:30:22Z" → "20241215-143022"
 */
function formatTimestamp(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoDate));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get(
    "minute"
  )}${get("second")}`;
}

/**
 * Build storage path with broker folder and uniqueness suffix
 * Returns: "garry-singh/20241215-143022-garry-singh-669043.mp3"
 */
function buildStoragePath(
  brokerSlug: string,
  timestamp: string,
  sourceRecordId: string,
  ext: string
): string {
  const shortHash = sourceRecordId.slice(-6);
  return `${brokerSlug}/${timestamp}-${brokerSlug}-${shortHash}.${ext}`;
}

function getFileExtension(contentType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
  };
  return map[contentType] || "mp3";
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 6000;

type Recording = {
  id: string;
  source_record_id: string;
  audio_content_uri: string | null;
  title: string | null;
  owner_extension_id: string | null;
  recording_start_time: string | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const specificRecordId = searchParams.get("recordId");

  // Calculate date range (align with sync-rc behavior)
  const dateFrom = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  const supabase = getSupabase();

  try {
    // Fetch broker extension mapping for file naming
    const { data: brokers } = await supabase
      .from("vl_brokers")
      .select("rc_extension_id, name")
      .not("rc_extension_id", "is", null);

    const brokerMap = new Map<string, string>(
      brokers?.map((b) => [b.rc_extension_id, b.name]) ?? []
    );

    // Get recordings that need audio downloaded (within date range)
    let query = supabase
      .from("rc_recordings")
      .select(
        "id, source_record_id, audio_content_uri, title, owner_extension_id, recording_start_time"
      )
      .not("audio_content_uri", "is", null)
      .is("audio_storage_path", null)
      .gte("recording_start_time", dateFrom)
      .limit(limit);

    if (specificRecordId) {
      query = supabase
        .from("rc_recordings")
        .select(
          "id, source_record_id, audio_content_uri, title, owner_extension_id, recording_start_time"
        )
        .eq("id", specificRecordId);
    }

    const { data: recordings, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!recordings || recordings.length === 0) {
      return NextResponse.json({
        message: specificRecordId
          ? "Recording not found or already has audio"
          : "No recordings need audio download",
        durationMs: Date.now() - startTime,
      });
    }

    const batches = chunk(recordings, BATCH_SIZE);
    console.log(
      `Downloading audio for ${recordings.length} recordings in ${batches.length} batches of ${BATCH_SIZE}`
    );

    const results: Array<{
      success: boolean;
      recordId: string;
      storagePath?: string;
      error?: string;
      rateLimit?: RCRateLimitInfo;
    }> = [];

    // Process single recording
    async function processRecording(rec: Recording) {
      try {
        if (!rec.audio_content_uri) {
          const errorMsg = "No audio URI";
          await supabase
            .from("rc_recordings")
            .update({ download_error: errorMsg })
            .eq("id", rec.id);
          return {
            success: false,
            recordId: rec.source_record_id,
            error: errorMsg,
          };
        }

        const brokerName = rec.owner_extension_id
          ? brokerMap.get(rec.owner_extension_id)
          : null;

        if (!brokerName) {
          const errorMsg = `No broker mapping for extension ${rec.owner_extension_id}`;
          console.error(`Skipping ${rec.source_record_id}: ${errorMsg}`);
          await supabase
            .from("rc_recordings")
            .update({ download_error: errorMsg })
            .eq("id", rec.id);
          return {
            success: false,
            recordId: rec.source_record_id,
            error: errorMsg,
          };
        }

        if (!rec.recording_start_time) {
          const errorMsg = "No recording_start_time";
          console.error(`Skipping ${rec.source_record_id}: ${errorMsg}`);
          await supabase
            .from("rc_recordings")
            .update({ download_error: errorMsg })
            .eq("id", rec.id);
          return {
            success: false,
            recordId: rec.source_record_id,
            error: errorMsg,
          };
        }

        const {
          data: audioData,
          contentType,
          rateLimit,
        } = await downloadRecordingAudio(rec.audio_content_uri);

        if (rateLimit.group) {
          console.log(
            `RC Rate Limit: group=${rateLimit.group} remaining=${rateLimit.remaining}/${rateLimit.limit}`
          );
        }

        const ext = getFileExtension(contentType);
        const brokerSlug = slugifyName(brokerName);
        const timestamp = formatTimestamp(rec.recording_start_time);
        const storagePath = buildStoragePath(
          brokerSlug,
          timestamp,
          rec.source_record_id,
          ext
        );

        const { error: uploadError } = await supabase.storage
          .from("rc-audio")
          .upload(storagePath, audioData, {
            contentType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase
          .from("rc_recordings")
          .update({ audio_storage_path: storagePath, download_error: null })
          .eq("id", rec.id);

        if (updateError) throw updateError;

        console.log(`Downloaded: ${storagePath}`);
        return {
          success: true,
          recordId: rec.source_record_id,
          storagePath,
          rateLimit,
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed ${rec.source_record_id}: ${errorMsg}`);
        await supabase
          .from("rc_recordings")
          .update({ download_error: errorMsg })
          .eq("id", rec.id);
        return {
          success: false,
          recordId: rec.source_record_id,
          error: errorMsg,
        };
      }
    }

    // Process in batches with delay between batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `Processing batch ${i + 1}/${batches.length} (${
          batch.length
        } recordings)`
      );

      const batchResults = await Promise.all(batch.map(processRecording));
      results.push(...batchResults);

      // Check rate limit status
      const rateLimited = batchResults.some((r) => r.error?.includes("429"));
      const lowestRemaining = Math.min(
        ...batchResults
          .filter((r) => r.rateLimit?.remaining != null)
          .map((r) => r.rateLimit!.remaining!)
      );

      // Wait between batches (longer if rate limited or running low)
      if (i < batches.length - 1) {
        let delay = BATCH_DELAY_MS;
        if (rateLimited) {
          delay = 60000; // 65 seconds - RC rate limit window is 60s
          console.log("Rate limited (429), waiting 65s for window reset");
        } else if (lowestRemaining <= 3) {
          delay = 30000; // 30 seconds when running low
          console.log(
            `Rate limit low (${lowestRemaining} remaining), waiting 30s`
          );
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json({
      message: `Downloaded ${successful.length}/${recordings.length} audio files`,
      successful: successful.length,
      failed: failed.length,
      durationMs: Date.now() - startTime,
      details: results,
    });
  } catch (error) {
    console.error("RC Audio Download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
