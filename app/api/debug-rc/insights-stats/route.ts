import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * /api/debug-rc/insights-stats - Analyze what insights are available
 *
 * @usage
 * curl "http://localhost:3000/api/debug-rc/insights-stats"
 */

export async function GET() {
  const supabase = getSupabase();

  const { data: recordings, error } = await supabase
    .from("rc_recordings")
    .select("id, title, recording_duration_ms, insights, transcript_text");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = {
    total: recordings?.length ?? 0,
    withTranscript: 0,
    withSummary: 0,
    withNextSteps: 0,
    withHighlights: 0,
    withAIScore: 0,
    withCallNotes: 0,
    withBulletedSummary: 0,
    hasAll3: [] as { id: string; title: string; duration_sec: number }[],
  };

  const insightKeys = ["Transcript", "Summary", "NextSteps", "Highlights", "AIScore", "CallNotes", "BulletedSummary"];

  for (const rec of recordings ?? []) {
    const insights = rec.insights as Record<string, unknown> | null;
    if (!insights) continue;

    const hasTranscript = !!insights.Transcript || !!rec.transcript_text;
    const hasSummary = !!insights.Summary;
    const hasNextSteps = !!insights.NextSteps;

    if (hasTranscript) stats.withTranscript++;
    if (hasSummary) stats.withSummary++;
    if (hasNextSteps) stats.withNextSteps++;
    if (insights.Highlights) stats.withHighlights++;
    if (insights.AIScore) stats.withAIScore++;
    if (insights.CallNotes) stats.withCallNotes++;
    if (insights.BulletedSummary) stats.withBulletedSummary++;

    if (hasTranscript && hasSummary && hasNextSteps) {
      stats.hasAll3.push({
        id: rec.id,
        title: rec.title ?? "Untitled",
        duration_sec: Math.round((rec.recording_duration_ms ?? 0) / 1000),
      });
    }
  }

  return NextResponse.json({
    stats,
    summary: `${stats.hasAll3.length}/${stats.total} recordings have Transcript + Summary + NextSteps`,
  });
}
