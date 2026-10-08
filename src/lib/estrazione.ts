import { z } from "zod/v4";
import { CONTRATTI, PREFERENZE_CASA, SERVIZI_CASA, SPESE_VOCI, ZONE_BOLOGNA } from "./constants";

// ============================================================
// Cosa si ricava da un annuncio incollato da WhatsApp.
//
// Ogni campo può restare vuoto: meglio un buco che l'utente riempie,
// che un dato inventato che finisce online. Lo schema lo impone anche
// al modello (output strutturato), e dopo lo ricontrolliamo noi.
// ============================================================

const nullabile = <T extends z.ZodType>(t: T) => t.nullable();

export const StanzaEstratta = z.object({
  tipo: z.enum(["singola", "doppia"]),
  posti_liberi: z.number().int(),
  prezzo_mensile: nullabile(z.number().int()),
  spese_incluse: nullabile(z.boolean()),
  spese_mensili: nullabile(z.number().int()),
  spese_comprendono: z.array(z.enum(SPESE_VOCI)),
  disponibile_dal: nullabile(z.string()),
  disponibile_fino: nullabile(z.string()),
  permanenza_minima_mesi: nullabile(z.number().int()),
  nota: nullabile(z.string()),
});

export const AnnuncioEstratto = z.object({
  titolo: nullabile(z.string()),
  zona: nullabile(z.enum(ZONE_BOLOGNA)),
  via: nullabile(z.string()),
  piano: nullabile(z.string()),
  bagni: nullabile(z.number().int()),
  camere_totali: nullabile(z.number().int()),
  genere_casa: nullabile(z.enum(["ragazze", "ragazzi", "misto", "indifferente"])),
  stanze: z.array(StanzaEstratta),
  contratto: nullabile(z.enum(CONTRATTI)),
  tramite_agenzia: nullabile(z.boolean()),
  senza_contratto: z.boolean(),
  caparra: nullabile(z.string()),
  coinquilini: z.array(
    z.object({
      genere: nullabile(z.enum(["ragazza", "ragazzo", "altro"])),
      eta: nullabile(z.number().int()),
      corso: nullabile(z.string()),
    }),
  ),
  servizi: z.array(z.enum(SERVIZI_CASA)),
  preferenze: z.array(z.enum(PREFERENZE_CASA.map((p) => p.value) as [string, ...string[]])),
  vicino_a: nullabile(z.string()),
  link_foto: nullabile(z.string()),
  descrizione: nullabile(z.string()),
  contatto_nome: nullabile(z.string()),
  contatto_telefono: nullabile(z.string()),
});

export type AnnuncioEstratto = z.infer<typeof AnnuncioEstratto>;
export type StanzaEstratta = z.infer<typeof StanzaEstratta>;

/** Risposta dell'endpoint /api/estrai-annuncio. */
export type RispostaEstrazione =
  | { ok: true; dati: AnnuncioEstratto }
  | { ok: false; errore: string };

export const LUNGHEZZA_MAX = 4000;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Secondo controllo, dopo il modello: numeri in intervalli sensati, date
 * nel formato giusto, link solo https. Quello che non torna diventa null.
 */
export function ripulisci(d: AnnuncioEstratto): AnnuncioEstratto {
  const tra = (n: number | null, min: number, max: number) => (n != null && n >= min && n <= max ? n : null);
  const data = (s: string | null) => (s && DATA.test(s) ? s : null);
  const corto = (s: string | null, max: number) => (s ? s.trim().slice(0, max) || null : null);
  let link: string | null = null;
  try {
    if (d.link_foto && new URL(d.link_foto).protocol === "https:") link = d.link_foto;
  } catch {
    link = null;
  }
  return {
    ...d,
    titolo: corto(d.titolo, 80),
    via: corto(d.via, 120),
    piano: corto(d.piano, 40),
    bagni: tra(d.bagni, 1, 6),
    camere_totali: tra(d.camere_totali, 1, 12),
    stanze: d.stanze.slice(0, 8).map((s) => ({
      ...s,
      posti_liberi: tra(s.posti_liberi, 1, 6) ?? 1,
      prezzo_mensile: tra(s.prezzo_mensile, 50, 3000),
      spese_mensili: tra(s.spese_mensili, 1, 1000),
      disponibile_dal: data(s.disponibile_dal),
      disponibile_fino: data(s.disponibile_fino),
      permanenza_minima_mesi: tra(s.permanenza_minima_mesi, 1, 24),
      nota: corto(s.nota, 160),
    })),
    caparra: corto(d.caparra, 60),
    coinquilini: d.coinquilini.slice(0, 10).map((c) => ({ ...c, eta: tra(c.eta, 16, 99), corso: corto(c.corso, 80) })),
    vicino_a: corto(d.vicino_a, 200),
    link_foto: link,
    descrizione: corto(d.descrizione, 2000),
    contatto_nome: corto(d.contatto_nome, 40),
    contatto_telefono: corto(d.contatto_telefono, 30),
  };
}
