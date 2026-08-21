import "server-only";
import { createClient, supabaseConfigurato } from "./supabase/server";

/**
 * Elenco email autorizzate all'area admin (env ADMIN_EMAILS, separate da virgola).
 * Solo il proprietario carica gli annunci: la scrittura passa comunque dalla RLS
 * come host proprietario, quindi nessuna chiave segreta lato client.
 */
function emailAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminUser {
  id: string;
  email: string;
}

/** Ritorna l'utente admin loggato, o null se non autenticato/non autorizzato. */
export async function getAdminUser(): Promise<AdminUser | null> {
  if (!supabaseConfigurato()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const allow = emailAdmin();
  // Se non è configurato nessun admin, autorizza qualsiasi utente loggato
  // (utile in sviluppo). In produzione imposta ADMIN_EMAILS.
  if (allow.length > 0 && !allow.includes(user.email.toLowerCase())) return null;

  return { id: user.id, email: user.email };
}
