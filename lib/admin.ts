import { createClient } from '@/lib/supabase/server'

export async function isAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('admin_emails')
    .select('email')
    .eq('email', email.toLowerCase())
    .single()
  return !!data
}
