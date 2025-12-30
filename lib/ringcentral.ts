/**
 * RingCentral API Client
 *
 * Handles JWT authentication and RingSense API calls.
 * Uses server-to-server JWT flow for background sync.
 *
 * @env RC_CLIENT_ID - RingCentral app client ID
 * @env RC_CLIENT_SECRET - RingCentral app client secret
 * @env RC_JWT - JWT token for server-to-server auth
 * @env RC_ACCOUNT_ID - Account ID (optional, defaults to "~")
 *
 * @usage
 * ```typescript
 * import { fetchRecordingsWithInsights, getRecordingInsights } from "@/lib/ringcentral";
 *
 * // Fetch all recordings with insights for an extension
 * const recordings = await fetchRecordingsWithInsights("660583043", {
 *   dateFrom: "2024-12-01T00:00:00Z",
 *   dateTo: "2024-12-31T23:59:59Z",
 *   domain: "pbx",
 * });
 *
 * // Get insights for a specific recording
 * const insights = await getRecordingInsights("3174133669043", "pbx");
 * ```
 */

const RC_BASE_URL = "https://platform.ringcentral.com";

interface RCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RCCallRecord {
  id: string;
  sessionId?: string;
  startTime?: string;
  duration?: number;
  direction?: "Inbound" | "Outbound";
  recording?: {
    id: string;
    uri: string;
    type: string;
    contentUri: string;
  };
  from?: {
    phoneNumber?: string;
    name?: string;
    extensionId?: string;
  };
  to?: {
    phoneNumber?: string;
    name?: string;
    extensionId?: string;
  };
}

interface RCCallLogResponse {
  records: RCCallRecord[];
  paging?: {
    page: number;
    totalPages: number;
    perPage: number;
    totalElements: number;
  };
  navigation?: {
    nextPage?: { uri: string };
  };
}

interface RCInsightsResponse {
  title?: string;
  rsRecordUri?: string;
  domain?: string;
  sourceRecordId?: string;
  sourceSessionId?: string;
  callDirection?: string;
  ownerExtensionId?: string;
  recordingDurationMs?: number;
  recordingStartTime?: string;
  creationTime?: string;
  lastModifiedTime?: string;
  speakerInfo?: unknown[];
  audioContentUri?: string;
  insights?: {
    Transcript?: Array<{ text?: string; speakerId?: string; start?: number; end?: number }>;
    Summary?: unknown;
    NextSteps?: unknown;
    Highlights?: unknown;
    AIScore?: unknown;
    CallNotes?: unknown;
    BulletedSummary?: unknown;
  };
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get access token using JWT authentication
 */
export async function getAccessToken(): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientId = process.env.RC_CLIENT_ID;
  const clientSecret = process.env.RC_CLIENT_SECRET;
  const jwt = process.env.RC_JWT;

  if (!clientId || !clientSecret || !jwt) {
    throw new Error("Missing RC credentials: RC_CLIENT_ID, RC_CLIENT_SECRET, or RC_JWT");
  }

  const response = await fetch(`${RC_BASE_URL}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RC OAuth failed: ${response.status} - ${text}`);
  }

  const data: RCTokenResponse = await response.json();

  // Cache token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * List call records with recordings for an extension
 */
export async function listCallRecords(
  extensionId: string = "~",
  options: {
    dateFrom?: string;
    dateTo?: string;
    withRecording?: boolean;
    perPage?: number;
  } = {}
): Promise<RCCallRecord[]> {
  const token = await getAccessToken();
  const accountId = process.env.RC_ACCOUNT_ID || "~";

  const params = new URLSearchParams({
    view: "Detailed",
    withRecording: String(options.withRecording ?? true),
    perPage: String(options.perPage ?? 100),
  });

  if (options.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options.dateTo) params.set("dateTo", options.dateTo);

  const allRecords: RCCallRecord[] = [];
  let nextPageUri: string | null =
    `${RC_BASE_URL}/restapi/v1.0/account/${accountId}/extension/${extensionId}/call-log?${params}`;

  while (nextPageUri) {
    const response = await fetch(nextPageUri, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RC Call Log failed: ${response.status} - ${text}`);
    }

    const data: RCCallLogResponse = await response.json();
    allRecords.push(...data.records);

    nextPageUri = data.navigation?.nextPage?.uri || null;

    // Rate limiting
    if (nextPageUri) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allRecords;
}

/**
 * Get RingSense insights for a recording
 */
export async function getRecordingInsights(
  sourceRecordId: string,
  domain: string = "pbx"
): Promise<RCInsightsResponse | null> {
  const token = await getAccessToken();
  const accountId = process.env.RC_ACCOUNT_ID || "~";

  const url = `${RC_BASE_URL}/ai/ringsense/v1/public/accounts/${accountId}/domains/${domain}/records/${sourceRecordId}/insights`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // No insights available for this recording
      return null;
    }
    const text = await response.text();
    console.error(`RC Insights failed for ${sourceRecordId}: ${response.status} - ${text}`);
    return null;
  }

  return response.json();
}

/**
 * Fetch call records with RingSense insights
 */
export async function fetchRecordingsWithInsights(
  extensionId: string = "~",
  options: {
    dateFrom?: string;
    dateTo?: string;
    domain?: string;
  } = {}
): Promise<RCInsightsResponse[]> {
  const domain = options.domain ?? "pbx";

  // Get call records with recordings
  const callRecords = await listCallRecords(extensionId, {
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    withRecording: true,
  });

  const recordingsWithInsights: RCInsightsResponse[] = [];

  for (const record of callRecords) {
    if (!record.recording?.id) continue;

    const insights = await getRecordingInsights(record.recording.id, domain);

    if (insights) {
      // Merge call record data with insights
      recordingsWithInsights.push({
        ...insights,
        sourceRecordId: insights.sourceRecordId || record.recording.id,
        sourceSessionId: insights.sourceSessionId || record.sessionId,
        callDirection: insights.callDirection || record.direction,
        recordingDurationMs: insights.recordingDurationMs || (record.duration ? record.duration * 1000 : undefined),
        recordingStartTime: insights.recordingStartTime || record.startTime,
        audioContentUri: record.recording.contentUri,
      });
    }

    // Rate limiting between API calls
    await new Promise((r) => setTimeout(r, 300));
  }

  return recordingsWithInsights;
}

/**
 * Download audio file from RingCentral
 * @param contentUri - The RC content URI for the audio file
 * @returns Audio file as ArrayBuffer with content type
 */
export async function downloadRecordingAudio(
  contentUri: string
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const token = await getAccessToken();

  const response = await fetch(contentUri, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const data = await response.arrayBuffer();

  return { data, contentType };
}
