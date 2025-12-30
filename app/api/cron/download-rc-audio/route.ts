import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { downloadRecordingAudio } from "@/lib/ringcentral";

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
 * ```
 *
 * @param limit - Max records to process (default: 10)
 * @param recordId - Specific recording ID to download (optional)
 *
 * @returns JSON with download results
 */

const CRON_SECRET = process.env.CRON_SECRET;

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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const specificRecordId = searchParams.get("recordId");

  const supabase = getSupabase();

  try {
    // Get recordings that need audio downloaded
    let query = supabase
      .from("rc_recordings")
      .select("id, source_record_id, audio_content_uri, title")
      .not("audio_content_uri", "is", null)
      .is("audio_storage_path", null)
      .limit(limit);

    if (specificRecordId) {
      query = supabase
        .from("rc_recordings")
        .select("id, source_record_id, audio_content_uri, title")
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

    console.log(`Downloading audio for ${recordings.length} recordings (sequential with rate limiting)`);

    const results: Array<{ success: boolean; recordId: string; storagePath?: string; error?: string }> = [];

    // Process sequentially to avoid rate limiting
    for (const rec of recordings) {
      try {
        if (!rec.audio_content_uri) {
          results.push({ success: false, recordId: rec.source_record_id, error: "No audio URI" });
          continue;
        }

        // Download from RingCentral
        const { data: audioData, contentType } = await downloadRecordingAudio(
          rec.audio_content_uri
        );

        // Generate storage path
        const ext = getFileExtension(contentType);
        const storagePath = `${rec.source_record_id}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("rc-audio")
          .upload(storagePath, audioData, {
            contentType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Update database with storage path
        const { error: updateError } = await supabase
          .from("rc_recordings")
          .update({ audio_storage_path: storagePath })
          .eq("id", rec.id);

        if (updateError) throw updateError;

        results.push({ success: true, recordId: rec.source_record_id, storagePath });
        console.log(`Downloaded ${results.length}/${recordings.length}: ${rec.source_record_id}`);

        // Rate limiting: wait 1 second between downloads (RC has strict limits)
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`Failed ${rec.source_record_id}: ${errorMsg}`);
        results.push({
          success: false,
          recordId: rec.source_record_id,
          error: errorMsg,
        });

        // If rate limited, wait longer before continuing
        if (errorMsg.includes("429")) {
          console.log("Rate limited, waiting 5 seconds...");
          await new Promise((r) => setTimeout(r, 5000));
        }
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
