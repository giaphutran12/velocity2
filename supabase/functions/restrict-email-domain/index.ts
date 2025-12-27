import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const allowedDomains = ['bluepearlmortgage.ca', 'bluepearl.ca']

Deno.serve(async (req) => {
  const payload = await req.text()
  const secret = Deno.env.get('BEFORE_USER_CREATED_HOOK_SECRET')?.replace('v1,whsec_', '')
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(secret!)

  try {
    const { user } = wh.verify(payload, headers) as { user: { email?: string } }
    const email = user.email || ''
    const domain = email.split('@')[1]?.toLowerCase() || ''

    if (!allowedDomains.includes(domain)) {
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

    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook verification failed:', error)
    return new Response(
      JSON.stringify({ error: { message: 'Invalid request' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
