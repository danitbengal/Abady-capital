import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_CAPITAL_SUPABASE_URL?.trim() ?? ''
const publishableKey = import.meta.env.VITE_CAPITAL_SUPABASE_ANON_KEY?.trim() ?? ''

export const isCapitalSupabaseConfigured = Boolean(projectUrl && publishableKey)

export const capitalSupabase: SupabaseClient | null = isCapitalSupabaseConfigured
  ? createClient(projectUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: { headers: { 'x-application-name': 'abady-capital' } },
    })
  : null

export function requireCapitalSupabase(): SupabaseClient {
  if (!capitalSupabase) throw new Error('חיבור Supabase של מערכת הצהרות ההון אינו מוגדר.')
  return capitalSupabase
}
