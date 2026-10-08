import "server-only";
import { DEMO_ANNUNCI } from "./demo-data";
import { supabaseConfigurato } from "./supabase/server";
import { createPublicClient } from "./supabase/public";
import { GIORNI_VALIDITA, stanzeAperte, type Annuncio } from "./types";

/**
 * Recupera gli annunci in ricerca:
 *  - attivi;
 *  - confermati dall'host negli ultimi GIORNI_VALIDITA giorni (un annuncio
 *    dimenticato sparisce da solo, non resta "libero" per sempre);
 *  - con almeno una stanza non ancora presa (libera o in trattativa).
 * Usa Supabase se configurato, altrimenti il dataset dimostrativo.
 *
 * Contatti e via NON arrivano da qui: stanno in annunci_privati.
 */
export async function getAnnunci(): Promise<Annuncio[]> {
  if (!supabaseConfigurato()) return DEMO_ANNUNCI;

  const limite = new Date(Date.now() - GIORNI_VALIDITA * 86_400_000).toISOString();
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("apartments")
    .select("*, rooms(*), housemates(*)")
    .eq("attivo", true)
    .gte("confermato_il", limite);

  if (error || !data) return [];
  return (data as Annuncio[]).filter((a) => stanzeAperte(a).length > 0);
}

/** Recupera un singolo annuncio per id. */
export async function getAnnuncio(id: string): Promise<Annuncio | null> {
  if (!supabaseConfigurato()) {
    return DEMO_ANNUNCI.find((a) => a.id === id) ?? null;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("apartments")
    .select("*, rooms(*), housemates(*)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Annuncio;
}
