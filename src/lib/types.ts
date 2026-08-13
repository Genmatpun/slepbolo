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
  created_at: string;
}

export interface Room {
  id: string;
  apartment_id: string;
  tipo: TipoStanza;
  prezzo_mensile: number;
  spese_incluse: boolean;
  spese_stimate: number | null;
  disponibile_dal: string | null;
  permanenza_minima_mesi: number;
  stato: StatoStanza;
}

export interface Housemate {
  id: string;
  apartment_id: string;
  profile_id: string | null;
  nome_visualizzato: string;
  eta: number | null;
  corso: string | null;
  genere: string | null;
}

export interface Apartment {
  id: string;
  host_id: string;
  titolo: string;
  descrizione: string | null;
  zona: string;
  via: string | null;
  lat: number | null;
  lng: number | null;
  piano: string | null;
  genere: GenereCasa;
  camere_totali: number;
  camere_occupate: number;
  servizi: string[];
  regole: string[];
  contratto_tipo: string | null;
  cauzione: string | null;
  attivo: boolean;
  created_at: string;
}

/** Annuncio completo per card e pagina dettaglio. */
export interface Annuncio extends Apartment {
  rooms: Room[];
  housemates: Housemate[];
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

/** Prezzo mostrato in card/lista: il più basso tra le stanze libere. */
export function prezzoDa(a: Annuncio): number {
  const libere = a.rooms.filter((r) => r.stato === "libera");
  return libere.length ? Math.min(...libere.map((r) => r.prezzo_mensile)) : 0;
}
