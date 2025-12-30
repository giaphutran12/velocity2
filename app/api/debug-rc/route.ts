import { NextRequest, NextResponse } from "next/server";
import { getRecordingInsights } from "@/lib/ringcentral";

/**
 * /api/debug-rc - Debug specific RC recordings
 *
 * @usage
 * curl "http://localhost:3000/api/debug-rc?recordId=3174133669043"
 */

export async function GET(request: NextRequest) {
  const recordId = request.nextUrl.searchParams.get("recordId");
  const domain = request.nextUrl.searchParams.get("domain") || "pbx";

  if (!recordId) {
    return NextResponse.json({ error: "recordId required" }, { status: 400 });
  }

  try {
    console.log(`Fetching insights for record ${recordId}...`);
    const insights = await getRecordingInsights(recordId, domain);

    if (!insights) {
      return NextResponse.json({
        recordId,
        status: "no_insights",
        message: "getRecordingInsights returned null (likely 404)",
      });
    }

    // Log the raw data to see what we're dealing with
    console.log("Raw insights:", JSON.stringify(insights, null, 2));

    return NextResponse.json({
      recordId,
      status: "found",
      data: {
        sourceRecordId: insights.sourceRecordId,
        sourceSessionId: insights.sourceSessionId,
        title: insights.title,
        domain: insights.domain,
        callDirection: insights.callDirection,
        ownerExtensionId: insights.ownerExtensionId,
        recordingDurationMs: insights.recordingDurationMs,
        recordingStartTime: insights.recordingStartTime,
        creationTime: insights.creationTime,
        lastModifiedTime: insights.lastModifiedTime,
        speakerInfoCount: insights.speakerInfo?.length ?? 0,
        insightsKeys: insights.insights ? Object.keys(insights.insights) : [],
        // Check for problematic fields
        validation: {
          callDirectionRaw: insights.callDirection,
          callDirectionType: typeof insights.callDirection,
          domainRaw: insights.domain,
          domainType: typeof insights.domain,
        },
      },
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      {
        recordId,
        status: "error",
        error: error instanceof Error ? error.message : JSON.stringify(error),
      },
      { status: 500 }
    );
  }
}
