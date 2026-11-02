"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

// Mail abilitate a registrarsi come host (chi affitta e non è studente).
// La scrittura passa dalla RLS della tabella host_abilitati (solo admin).

export type StatoHost = { errore: string | null; ok: string | null };

export async function abilitaHost(_stato: StatoHost, formData: FormData): Promise<StatoHost> {
  if (!(await getAdminUser())) return { errore: "Area riservata.", ok: null };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 120) || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { errore: "Scrivi una mail valida.", ok: null };

  const supabase = await createClient();
  const { error } = await supabase.from("host_abilitati").upsert({ email, nota });
  if (error) return { errore: "Non sono riuscito a salvarla. Riprova tra poco.", ok: null };
  revalidatePath("/admin/host");
  return { errore: null, ok: `${email} è abilitata: ora può registrarsi come host dall'app.` };
}

export async function togliHost(formData: FormData) {
  if (!(await getAdminUser())) return;
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  await supabase.from("host_abilitati").delete().eq("email", email);
  revalidatePath("/admin/host");
}
