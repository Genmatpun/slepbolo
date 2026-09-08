"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  adminConfigurato,
  apriSessione,
  azzeraTentativi,
  chiudiSessione,
  passwordCorretta,
  registraFallimento,
  sessioneValida,
  troppiTentativi,
} from "@/lib/credenziali/sessione";
import { createAdminClient, serviceRoleConfigurata } from "@/lib/credenziali/utenti";

export type StatoLogin = { errore: string | null };

async function ipRichiesta(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "sconosciuto"
  );
}

export async function accedi(_stato: StatoLogin, formData: FormData): Promise<StatoLogin> {
  if (!adminConfigurato()) {
    return {
      errore:
        "ADMIN_PASSWORD non è impostata sul server. Finché manca, la pagina resta chiusa a tutti.",
    };
  }

  const ip = await ipRichiesta();
  if (troppiTentativi(ip)) {
    return { errore: "Troppi tentativi falliti. Riprova fra un quarto d'ora." };
  }

  if (!passwordCorretta(String(formData.get("password") ?? ""))) {
    registraFallimento(ip);
    // Messaggio unico: non diciamo se la password è "quasi giusta".
    return { errore: "Password non corretta." };
  }

  azzeraTentativi(ip);
  await apriSessione();
  revalidatePath("/admin/credenziali");
  return { errore: null };
}

export async function esci(): Promise<void> {
  await chiudiSessione();
  redirect("/admin/credenziali");
}

/**
 * Elimina definitivamente un account.
 *
 * Cancella prima la password in chiaro, poi l'utente da auth.users. Da lì la
 * cascata del database si porta via il profilo e, con quello, appartamenti,
 * candidature e messaggi di quella persona. Non si torna indietro.
 */
export async function eliminaUtente(formData: FormData): Promise<void> {
  if (!(await sessioneValida())) redirect("/admin/credenziali");
  if (!serviceRoleConfigurata()) return;

  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "");
  // Solo UUID: senza questo controllo un id malformato arriverebbe all'API.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;

  const supabase = createAdminClient();

  // La cascata coprirebbe le righe con user_id, non quelle salvate senza.
  await supabase.from("credenziali").delete().eq("user_id", id);
  if (email.includes("@")) await supabase.from("credenziali").delete().eq("email", email);

  await supabase.auth.admin.deleteUser(id);

  revalidatePath("/admin/credenziali");
}
