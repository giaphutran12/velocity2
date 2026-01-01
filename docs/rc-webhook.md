# RingCentral Integration

Real-time insights via webhook + periodic audio sync via cron.

## Architecture

```
Call ends → RingSense processes → Webhook receives insights (real-time)
         → Cron polls call-log API → Gets audio URL (every 5 min)
         → Download cron → Uploads to Supabase Storage (every 10 min)
```

**Why cron for audio?** RC doesn't support call-log webhook subscriptions. Only presence, telephony sessions, and RingSense have webhooks.

## Endpoint

`POST https://bpportal.ca/api/rc/webhook`

Handles RingSense insights events only (call-log webhooks don't exist).

## Active Subscription

| Field | Value |
|-------|-------|
| ID | `3298447e-70a4-46e0-bebb-5895445b765b` |
| Filter | `/ai/ringsense/v1/public/accounts/~/domains/pbx/insights` |
| Expires | 2026-01-08 |

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/sync-rc` | Every 5 min | Polls call-log API for audio URLs |
| `/api/cron/download-rc-audio` | Every 10 min | Downloads audio to Supabase Storage |

## How It Works

1. **Insights ready** → RC sends webhook → stores transcript/summary
2. **Every 5 min** → Cron polls call-log API → stores `audio_content_uri`
3. **Every 10 min** → Download cron → uploads audio to Supabase Storage
4. Both upsert on `source_record_id` → merged record

## Security

- No signature verification (not available for subscription webhooks)
- Account ID check prevents spoofed requests
- Fallback: daily cron catches any missed data

## Renewal

Run before expiration (every 7 days):

```bash
# 1. Get fresh token
curl -X POST "https://platform.ringcentral.com/restapi/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "$RC_CLIENT_ID:$RC_CLIENT_SECRET" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=$RC_JWT"

# 2. Renew subscription
curl -X POST "https://platform.ringcentral.com/restapi/v1.0/subscription/3298447e-70a4-46e0-bebb-5895445b765b/renew" \
  -H "Authorization: Bearer $RC_ACCESS_TOKEN"
```

## Create Subscription

```bash
curl -X POST "https://platform.ringcentral.com/restapi/v1.0/subscription" \
  -H "Authorization: Bearer $RC_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventFilters": ["/ai/ringsense/v1/public/accounts/~/domains/pbx/insights"],
    "deliveryMode": {
      "transportType": "WebHook",
      "address": "https://bpportal.ca/api/rc/webhook"
    },
    "expiresIn": 604800
  }'
```

> **Note:** Call-log webhook subscriptions don't exist in RC. Audio URLs are fetched via cron polling the call-log API.

## Files

- [app/api/rc/webhook/route.ts](../app/api/rc/webhook/route.ts) - Webhook handler
- [lib/ringcentral.ts](../lib/ringcentral.ts) - RC API client (not modified for webhook)
