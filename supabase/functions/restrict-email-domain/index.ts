import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const allowedDomains = ['bluepearlmortgage.ca', 'bluepearl.ca']

Deno.serve(async (req) => {
  console.log('=== HOOK CALLED ===')

  const payload = await req.text()
  const rawSecret = Deno.env.get('BEFORE_USER_CREATED_HOOK_SECRET')
  const secret = rawSecret?.replace('v1,whsec_', '')
  const headers = Object.fromEntries(req.headers)

  // DEBUG: Log what we're working with
  console.log('Headers received:', JSON.stringify(Object.keys(headers)))
  console.log('Secret exists:', !!rawSecret)
  console.log('Secret starts with v1,whsec_:', rawSecret?.startsWith('v1,whsec_'))
  console.log('Secret after strip (first 10 chars):', secret?.substring(0, 10) + '...')
  console.log('Payload length:', payload.length)

  // Check for standardwebhooks expected headers
  console.log('webhook-id:', headers['webhook-id'] || 'MISSING')
  console.log('webhook-timestamp:', headers['webhook-timestamp'] || 'MISSING')
  console.log('webhook-signature:', headers['webhook-signature'] || 'MISSING')

  if (!secret) {
    console.error('SECRET IS NOT SET!')
    return new Response(
      JSON.stringify({ error: { message: 'Hook configuration error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const wh = new Webhook(secret)

  try {
    const { user } = wh.verify(payload, headers) as { user: { email?: string } }
    console.log('Verification SUCCESS, email:', user.email)
    const email = user.email || ''
    const domain = email.split('@')[1]?.toLowerCase() || ''

    if (!allowedDomains.includes(domain)) {
      console.log('Domain rejected:', domain)
      return new Response(
        JSON.stringify({
          error: {
            message: 'Please sign up with your BluePearl email address.',
            http_code: 400,
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('Domain accepted:', domain)
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook verification FAILED:', error)
    console.error('Error message:', (error as Error).message)
    return new Response(
      JSON.stringify({ error: { message: 'Invalid request' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
