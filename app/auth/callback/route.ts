import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/login?error=verification_failed`)
    }

    if (data?.user) {
      // Check if user is admin first
      const adminCheck = await isAdmin(data.user.email)

      if (adminCheck) {
        // Admin path - require email verification
        if (!data.user.email_confirmed_at) {
          return NextResponse.redirect(
            `${origin}/login?error=email_not_verified&message=Please verify your email before accessing the system`
          )
        }
        // Verified admin → straight to deals
        return NextResponse.redirect(`${origin}/deals`)
      }

      // Non-admin path continues with existing broker logic...
      const userEmail = data.user.email || ''
      const firstname = userEmail.split('@')[0]

      // Try to find a matching broker by firstname
      const { data: suggestedBroker } = await supabase
        .from('vl_brokers')
        .select('id, name')
        .ilike('name', `${firstname}%`)
        .is('user_id', null)
        .limit(1)
        .single()

      if (suggestedBroker) {
        // Redirect to broker confirmation with suggestion
        return NextResponse.redirect(
          `${origin}/register/confirm-broker?suggested=${suggestedBroker.id}`
        )
      } else {
        // No suggestion found, still need to pick a broker
        return NextResponse.redirect(`${origin}/register/confirm-broker`)
      }
    }
  }

  // Default redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
