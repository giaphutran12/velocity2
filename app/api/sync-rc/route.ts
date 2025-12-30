import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * /api/sync-rc - Syncs RingCentral call recording data to Supabase
 *
 * Auth: Requires Bearer token in Authorization header (uses CRON_SECRET)
 * Usage: curl -X POST -H "Authorization: Bearer $CRON_SECRET" -d '{"recordings":[...]}' https://yoursite.com/api/sync-rc
 */

interface TranscriptEntry {
  text?: string;
  start?: number;
  end?: number;
  speakerId?: string;
}

interface RCRecordingPayload {
  recordId: string;
  sessionId?: string;
  title?: string;
  rsRecordUri?: string;
  domain?: "pbx" | "rcv" | "rcx" | "nice-incontact" | "ms-teams";
  direction?: "Inbound" | "Outbound";
  ownerExtensionId?: string;
  durationMs?: number;
  startTime?: string;
  creationTime?: string;
  lastModifiedTime?: string;
  speakerInfo?: unknown[];
  insights?: {
    Transcript?: TranscriptEntry[];
    Summary?: unknown;
    NextSteps?: unknown;
    Highlights?: unknown;
    AIScore?: unknown;
    InCallNotes?: unknown;
    AICoach?: unknown;
  };
}

function extractTranscriptText(insights: RCRecordingPayload["insights"]): string | null {
  if (!insights?.Transcript || !Array.isArray(insights.Transcript)) {
    return null;
  }

  const texts = insights.Transcript
    .map((entry) => entry.text)
    .filter((text): text is string => typeof text === "string" && text.length > 0);

  return texts.length > 0 ? texts.join(" ") : null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    let recordings: RCRecordingPayload[];
    if (body.recordings) {
      recordings = body.recordings;
    } else if (Array.isArray(body)) {
      recordings = body;
    } else if (body.recordId) {
      recordings = [body];
    } else {
      return NextResponse.json(
        { error: "Invalid request body. Expected recordings array or single recording with recordId." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const results = await Promise.all(
      recordings.map(async (rec) => {
        try {
          const transcriptText = extractTranscriptText(rec.insights);

          const { error } = await supabase.from("rc_recordings").upsert(
            {
              source_record_id: rec.recordId,
              source_session_id: rec.sessionId,
              title: rec.title,
              rs_record_uri: rec.rsRecordUri,
              domain: rec.domain,
              call_direction: rec.direction,
              owner_extension_id: rec.ownerExtensionId,
              recording_duration_ms: rec.durationMs,
              recording_start_time: rec.startTime,
              creation_time: rec.creationTime,
              last_modified_time: rec.lastModifiedTime,
              speaker_info: rec.speakerInfo ?? [],
              insights: rec.insights ?? {},
              transcript_text: transcriptText,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "source_record_id" }
          );

          if (error) throw error;
          return { success: true, recordId: rec.recordId };
        } catch (error) {
          return {
            success: false,
            recordId: rec.recordId,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json({
      message: `Synced ${successful.length}/${recordings.length} recordings`,
      successful: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error("RC Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    message: "POST RingCentral recording data to this endpoint to sync to Supabase",
    example: "POST with body: { recordings: [...] }",
    fields: {
      required: ["recordId"],
      optional: [
        "sessionId",
        "title",
        "rsRecordUri",
        "domain",
        "direction",
        "ownerExtensionId",
        "durationMs",
        "startTime",
        "creationTime",
        "lastModifiedTime",
        "speakerInfo",
        "insights",
      ],
    },
  });
}
