import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

export function isSupabaseConfigured() {
  return url.length > 0 && (anonKey.length > 0 || serviceRoleKey.length > 0)
}

/** Browser-safe client — uses anon key, respects RLS */
export function createClient() {
  return createSupabaseClient(url, anonKey)
}

/** Server-only client — uses service_role key, bypasses RLS.
 *  Falls back to anon key if SUPABASE_SERVICE_ROLE_KEY is not set yet.
 *  Never expose this to the browser. */
export function createServiceClient() {
  const serviceKey = serviceRoleKey || anonKey
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
