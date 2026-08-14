import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase per LETTURE PUBBLICHE (case, stanze, coinquilini).
 * Non usa i cookie di sessione, quindi funziona anche in fase di build
 * e ovunque fuori da una richiesta. La RLS lascia comunque vedere solo
 * gli appartamenti attivi (ruolo anon).
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
