# Implementation Handoff: D2 - Broker Authentication

## Decision Summary
**Winner:** H5 - Supabase Auth with Email Domain Restriction
**R_eff:** 0.95
**Status:** ACCEPTED

---

## Context Files to Read First

Before implementing, read these files in order:

1. **Decision Record:** `.quint/decisions/D2-broker-authentication.json`
2. **Evidence:** `.quint/evidence/E3-supabase-auth-docs.json`
3. **Hypothesis:** `.quint/hypotheses/H5-supabase-auth.json`
4. **Current Supabase Client:** `lib/supabase.ts`
5. **Deals Page:** `app/deals/page.tsx`
6. **Brokers Table Migration:** `supabase/migrations/20241227070000_brokers_table.sql`

---

## Implementation Requirements

### 1. Install Package
```bash
npm install @supabase/ssr
```

### 2. Create Supabase Client Utilities

**lib/supabase/server.ts** - Server-side client with cookies
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**lib/supabase/client.ts** - Browser client
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**lib/supabase/middleware.ts** - Session refresh
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated (except for login page)
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

### 3. Create Middleware (middleware.ts at root)
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/deals/:path*',
    // Add other protected routes
  ],
}
```

### 4. Create Auth Pages

**app/login/page.tsx** - Login for existing users
- Simple email/password form
- Call `supabase.auth.signInWithPassword()`
- Redirect to /deals on success

**app/register/page.tsx** - Registration flow with broker linking
1. Email/password form
2. Call `supabase.auth.signUp()` with email confirmation enabled
3. Show "Check your email for verification link" message

**app/auth/callback/route.ts** - Handle email verification callback
1. Verify the OTP token from email link
2. Extract firstname from email (e.g., `nav@bluepearlmortgage.ca` → "Nav")
3. Query `vl_brokers` for matching name (case-insensitive)
4. Redirect to `/register/confirm-broker?suggested={broker_id}`

**app/register/confirm-broker/page.tsx** - Broker confirmation
1. Show: "Are you **{suggested_broker_name}**?"
2. If YES → Link user_id to that broker, redirect to /deals
3. If NO → Show picklist of **unclaimed brokers** (where `user_id IS NULL`)
4. User selects correct broker → Link and redirect

### Registration Flow Diagram
```
[Register] → [Email Sent] → [Click Link] → [Confirm Broker] → [Dashboard]
                                              ↓
                                    "Is this you: Nav Cheema?"
                                         ↓ YES      ↓ NO
                                      [Link]    [Pick from list]
```

### Key Queries for Broker Linking

**Infer broker from email:**
```typescript
const email = user.email // nav@bluepearlmortgage.ca
const firstname = email.split('@')[0] // "nav"

const { data: suggestedBroker } = await supabase
  .from('vl_brokers')
  .select('id, name')
  .ilike('name', `${firstname}%`)
  .is('user_id', null) // Only unclaimed
  .single()
```

**Get unclaimed brokers for picklist:**
```typescript
const { data: unclaimedBrokers } = await supabase
  .from('vl_brokers')
  .select('id, name')
  .is('user_id', null)
  .order('name')
```

**Link user to broker:**
```typescript
await supabase
  .from('vl_brokers')
  .update({ user_id: user.id })
  .eq('id', selectedBrokerId)
```

### 5. Database Migrations

**Migration 1: Add user_id to vl_brokers**
```sql
ALTER TABLE vl_brokers ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE INDEX idx_brokers_user_id ON vl_brokers(user_id);
```

**Migration 2: Add broker_id to vl_deals**
```sql
ALTER TABLE vl_deals ADD COLUMN broker_id UUID REFERENCES vl_brokers(id);
CREATE INDEX idx_deals_broker_id ON vl_deals(broker_id);
```

**Migration 3: RLS Policies**
```sql
-- Enable RLS
ALTER TABLE vl_deals ENABLE ROW LEVEL SECURITY;

-- Policy: Brokers can only see their own deals
CREATE POLICY "Brokers see own deals" ON vl_deals
  FOR SELECT
  USING (
    broker_id IN (
      SELECT id FROM vl_brokers WHERE user_id = auth.uid()
    )
  );
```

### 6. Edge Function for Email Domain Restriction

**supabase/functions/restrict-email-domain/index.ts**
```typescript
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const allowedDomains = ['bluepearlmortgage.ca', 'bluepearl.ca']

Deno.serve(async (req) => {
  const payload = await req.text()
  const secret = Deno.env.get('BEFORE_USER_CREATED_HOOK_SECRET')?.replace('v1,whsec_', '')
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(secret)

  try {
    const { user } = wh.verify(payload, headers)
    const email = user.email || ''
    const domain = email.split('@')[1] || ''

    if (!allowedDomains.includes(domain)) {
      return new Response(
        JSON.stringify({
          error: { message: 'Please sign up with your BluePearl email address.', http_code: 400 }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid request' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

### 7. Update Sync Process

Modify `app/api/cron/sync/route.ts` to:
1. Get broker_id from vl_brokers based on the API key being used
2. Set broker_id on each deal being synced

### 8. Update Deals Page

Modify `app/deals/page.tsx` to:
1. Get authenticated user via `createClient().auth.getUser()`
2. Get broker from vl_brokers where user_id = auth.uid()
3. Filter deals by broker_id (or rely on RLS)

---

## Environment Variables Required

Add to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Note: Keep `SUPABASE_SERVICE_ROLE_KEY` for the sync process (bypasses RLS).

---

## Testing Checklist

**Registration Flow:**
- [ ] Non-BluePearl email signup is rejected (edge function)
- [ ] BluePearl email signup sends verification email
- [ ] Clicking verification link redirects to confirm-broker page
- [ ] Firstname inference suggests correct broker (nav@ → "Nav Cheema")
- [ ] "Yes" button links user to broker and redirects to /deals
- [ ] "No" button shows picklist of unclaimed brokers
- [ ] Selecting broker from picklist links correctly
- [ ] Already-claimed brokers don't appear in picklist

**Login Flow:**
- [ ] Login with correct credentials works
- [ ] Login redirects to /deals
- [ ] Wrong credentials show error

**Protected Routes:**
- [ ] Unauthenticated user redirected to /login
- [ ] Authenticated user can access /deals
- [ ] Broker can only see their own deals (RLS)
- [ ] Search returns only broker's deals
- [ ] Deal detail page restricted to owner

**Sync:**
- [ ] Sync process sets broker_id correctly

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/supabase/server.ts` | CREATE |
| `lib/supabase/client.ts` | CREATE |
| `lib/supabase/middleware.ts` | CREATE |
| `middleware.ts` | CREATE |
| `app/login/page.tsx` | CREATE - email/password login |
| `app/register/page.tsx` | CREATE - signup with email verification |
| `app/auth/callback/route.ts` | CREATE - handle email verification |
| `app/register/confirm-broker/page.tsx` | CREATE - broker linking UI |
| `app/deals/page.tsx` | MODIFY - add auth check, show broker's deals |
| `app/deals/[loanCode]/page.tsx` | MODIFY - add auth check |
| `app/api/cron/sync/route.ts` | MODIFY - set broker_id |
| `supabase/functions/restrict-email-domain/` | CREATE |
| `supabase/migrations/` | CREATE - 3 new migrations |

---

## Constraints (DO NOT VIOLATE)

1. **Never read .env files** - use environment variables only
2. **Use @supabase/ssr** - NOT @supabase/auth-helpers-nextjs (deprecated)
3. **Keep service role key** for sync process - it needs to bypass RLS
4. **Email domains:** Only `@bluepearlmortgage.ca` and `@bluepearl.ca`
5. **Run `npm run build`** when complete to verify no errors
