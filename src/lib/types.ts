// Tipi di dominio, allineati allo schema Supabase.

export type GenereCasa = "ragazze" | "ragazzi" | "misto" | "indifferente";
export type TipoStanza = "singola" | "doppia";
export type StatoStanza = "libera" | "in_trattativa" | "occupata";
export type StatoCandidatura = "inviata" | "letta" | "accettata" | "rifiutata";

export interface Profile {
  id: string;
  nome: string;
  cognome: string | null;
  eta: number | null;
  corso_laurea: string | null;
  anno: string | null;
  sede_principale: string | null;
  genere: string | null;
  bio: string | null;
  foto_url: string | null;
  abitudini: string[];
  budget_max: number | null;
  verificato_unibo: boolean;
  studente_lavoratore: boolean;
  lingue: string[];
  zone_preferite: string[];
  cerco_dal: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  apartment_id: string;
  tipo: TipoStanza;
  /** Posti letto liberi in questa stanza: "due posti in doppia" = doppia con 2. */
  posti_liberi: number;
  prezzo_mensile: number;
  spese_incluse: boolean;
  spese_stimate: number | null;
  /** Cosa coprono le spese: condominio, TARI, Wi-Fi… */
  spese_comprendono: string[];
  disponibile_dal: string | null;
  disponibile_fino: string | null;
  permanenza_minima_mesi: number;
  nota: string | null;
  stato: StatoStanza;
  aggiornato_il: string;
}

export interface Housemate {
  id: string;
  apartment_id: string;
  profile_id: string | null;
  /** Non più mostrato pubblicamente (privacy). Mantenuto per compatibilità. */
  nome_visualizzato: string | null;
  eta: number | null;
  corso: string | null;
  /** "ragazza" | "ragazzo" | "altro" | null */
  genere: string | null;
  /** Preferenze di vita mostrate in scheda (es. "Non fumo", "Studio a casa"). */
  abitudini: string[];
  /** "confermato" (manuale o invito accettato) | "in_attesa" (invito da confermare entro 24h). */
  stato: string;
  /** Scadenza dell'invito (solo per stato "in_attesa"). */
  scadenza_invito: string | null;
}

/** Coinquilini da mostrare pubblicamente: confermati + inviti non ancora scaduti. */
export function coinquiliniVisibili(housemates: Housemate[]): Housemate[] {
  const ora = Date.now();
  return housemates.filter(
    (h) =>
      h.stato === "confermato" ||
      (h.stato === "in_attesa" && h.scadenza_invito != null && new Date(h.scadenza_invito).getTime() > ora),
  );
}

/**
 * Parte PUBBLICA dell'annuncio: la legge chiunque, anche senza login.
 * Contatti, via e coordinate esatte stanno in AnnuncioPrivato.
 * lat/lng qui sono già arrotondate dal database (griglia di ~280 m).
 */
export interface Apartment {
  id: string;
  host_id: string;
  titolo: string;
  descrizione: string | null;
  zona: string;
  lat: number | null;
  lng: number | null;
  piano: string | null;
  genere: GenereCasa;
  camere_totali: number;
  camere_occupate: number;
  bagni: number | null;
  servizi: string[];
  regole: string[];
  preferenze: string[];
  vicino_a: string | null;
  contratto_tipo: string | null;
  tramite_agenzia: boolean;
  cauzione: string | null;
  foto_urls: string[];
  link_foto: string | null;
  attivo: boolean;
  created_at: string;
  aggiornato_il: string;
  /** Ultima volta che l'host ha detto "è ancora libera". */
  confermato_il: string;
}

/**
 * Parte PROTETTA: la leggono solo l'host, l'admin e gli studenti entrati
 * con la mail UniBo (regola nel database, tabella annunci_privati).
 */
export interface AnnuncioPrivato {
  apartment_id: string;
  contatto_nome: string | null;
  contatto_telefono: string | null;
  contatto_whatsapp: string | null;
  contatto_email: string | null;
  contatto_note: string | null;
  via: string | null;
  lat: number | null;
  lng: number | null;
}

/** Annuncio completo per card e pagina dettaglio. */
export interface Annuncio extends Apartment {
  rooms: Room[];
  housemates: Housemate[];
}

/** Un annuncio "Cerco stanza" della bacheca. */
export interface Cerco {
  id: string;
  profile_id: string;
  nome: string;
  eta: number | null;
  genere: string | null;
  corso: string | null;
  anno: string | null;
  lavoratore: boolean;
  testo: string;
  zone: string[];
  budget_max: number | null;
  dal: string | null;
  tipo: "singola" | "doppia" | "posto_letto" | "indifferente" | null;
  contatto: string | null;
  attivo: boolean;
  confermato_il: string;
  created_at: string;
}

// ---------- Ciclo di vita ----------

/** Dopo quanti giorni senza conferma un annuncio sparisce dalla ricerca. */
export const GIORNI_VALIDITA = 14;

const GIORNO_MS = 86_400_000;

/** Giorni interi trascorsi da una data ISO (0 = oggi). */
export function giorniDa(iso: string | null | undefined, ora = Date.now()): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, Math.floor((ora - t) / GIORNO_MS));
}

/** "aggiornato oggi" · "ieri" · "3 giorni fa" · "2 settimane fa". */
export function quandoAggiornato(iso: string | null | undefined, ora = Date.now()): string {
  const g = giorniDa(iso, ora);
  if (g === Infinity) return "";
  if (g === 0) return "aggiornato oggi";
  if (g === 1) return "aggiornato ieri";
  if (g < 14) return `aggiornato ${g} giorni fa`;
  const s = Math.floor(g / 7);
  return s < 5 ? `aggiornato ${s} settimane fa` : "aggiornato più di un mese fa";
}

/** L'annuncio è scaduto: l'host non lo conferma da più di GIORNI_VALIDITA giorni. */
export function annuncioScaduto(a: Pick<Apartment, "confermato_il">, ora = Date.now()): boolean {
  return giorniDa(a.confermato_il, ora) > GIORNI_VALIDITA;
}

/** Giorni che restano prima che l'annuncio sparisca (0 = sparisce oggi). */
export function giorniAllaScadenza(a: Pick<Apartment, "confermato_il">, ora = Date.now()): number {
  return Math.max(0, GIORNI_VALIDITA - giorniDa(a.confermato_il, ora));
}

export interface Application {
  id: string;
  room_id: string;
  student_id: string;
  messaggio: string | null;
  stato: StatoCandidatura;
  created_at: string;
}

export interface Message {
  id: string;
  application_id: string;
  sender_id: string;
  testo: string;
  letto_at: string | null;
  created_at: string;
}

/** Numero di camere libere di un annuncio. */
export function camereLibere(a: Annuncio): number {
  return a.rooms.filter((r) => r.stato === "libera").length;
}

/** Stanze ancora proponibili: libere o in trattativa (non ancora prese). */
export function stanzeAperte(a: Annuncio): Room[] {
  return a.rooms.filter((r) => r.stato !== "occupata");
}

/** Prezzo mostrato in card/lista: il più basso tra le stanze ancora aperte. */
export function prezzoDa(a: Annuncio): number {
  const libere = a.rooms.filter((r) => r.stato === "libera");
  const pool = libere.length ? libere : stanzeAperte(a);
  return pool.length ? Math.min(...pool.map((r) => r.prezzo_mensile)) : 0;
}
