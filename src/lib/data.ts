import "server-only";
import { DEMO_ANNUNCI } from "./demo-data";
import { createClient, supabaseConfigurato } from "./supabase/server";
import type { Annuncio } from "./types";

/**
 * Recupera tutti gli annunci in ricerca (attivi, con almeno una stanza libera).
 * Usa Supabase se configurato, altrimenti il dataset dimostrativo.
 */
export async function getAnnunci(): Promise<Annuncio[]> {
  if (!supabaseConfigurato()) return DEMO_ANNUNCI;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("apartments")
    .select("*, rooms(*), housemates(*)")
    .eq("attivo", true);

  if (error || !data) return [];
  return (data as Annuncio[]).filter((a) => a.rooms.some((r) => r.stato === "libera"));
}

/** Recupera un singolo annuncio per id. */
export async function getAnnuncio(id: string): Promise<Annuncio | null> {
  if (!supabaseConfigurato()) {
    return DEMO_ANNUNCI.find((a) => a.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("apartments")
    .select("*, rooms(*), housemates(*)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Annuncio;
}
