import { coinquiliniVisibili, giorniDa, type Annuncio, type StatoStanza } from "./types";

// ============================================================
// Forma dei dati che arriva all'app mobile.
//
// Si costruisce sul server (app/app/page.tsx) e finisce dentro la pagina:
// quindi qui c'è SOLO ciò che chiunque può vedere. Niente telefono,
// email, WhatsApp, via: quelli si chiedono dopo, da loggati, alla
// tabella annunci_privati.
// ============================================================

export interface MobileStanza {
  id: string;
  tipo: "Singola" | "Doppia";
  /** Posti letto liberi: "2 posti in doppia". */
  posti: number;
  prezzo: number;
  speseIncl: boolean;
  spese: number | null;
  speseComprendono: string[];
  dal: string | null;
  fino: string | null;
  min: number;
  nota: string | null;
  stato: StatoStanza;
}

export interface MobileAnnuncio {
  id: string;
  hostId: string;
  titolo: string;
  zona: string;
  /** Coordinate approssimate (griglia di ~280 m), mai quelle esatte. */
  lat: number;
  lng: number;
  tot: number;
  occ: number;
  /** Prezzo più basso tra le stanze ancora aperte. */
  prezzo: number;
  tipo: string;
  spese: string;
  speseIncl: boolean;
  min: number;
  contratto: string;
  /** true se il contratto è registrato (tutto tranne "Da definire"). */
  registrato: boolean;
  agenzia: boolean;
  caparra: string | null;
  piano: string | null;
  bagni: number | null;
  genere: "ragazze" | "ragazzi" | "misto" | "indifferente";
  preferenze: string[];
  vicinoA: string | null;
  linkFoto: string | null;
  servizi: string[];
  descrizione: string;
  coinq: { g: string; e: number | null; c: string; ab: string[]; pending: boolean }[];
  foto: string[];
  stanze: MobileStanza[];
  /** Posti letto liberi in totale. */
  liberi: number;
  /** Stanze in trattativa (non ancora prese). */
  inTrattativa: number;
  /** Prima data di disponibilità tra le stanze aperte. */
  dal: string | null;
  aggiornato: string;
  confermato: string;
}

const CENTRO = { lat: 44.494, lng: 11.342 };

function etichettaSpese(incl: boolean, importo: number | null): string {
  if (incl) return "spese incluse";
  if (importo) return `+${importo} € spese`;
  return "spese escluse";
}

export function aMobile(a: Annuncio): MobileAnnuncio {
  const aperte = a.rooms.filter((r) => r.stato !== "occupata");
  const libere = aperte.filter((r) => r.stato === "libera");
  // la stanza "di copertina": la più economica tra le libere, se no tra le aperte
  const pool = libere.length ? libere : aperte;
  const prima = [...pool].sort((x, y) => x.prezzo_mensile - y.prezzo_mensile)[0];

  const stanze: MobileStanza[] = a.rooms.map((r) => ({
    id: r.id,
    tipo: r.tipo === "doppia" ? "Doppia" : "Singola",
    posti: r.posti_liberi ?? 1,
    prezzo: r.prezzo_mensile,
    speseIncl: r.spese_incluse,
    spese: r.spese_stimate,
    speseComprendono: r.spese_comprendono ?? [],
    dal: r.disponibile_dal,
    fino: r.disponibile_fino ?? null,
    min: r.permanenza_minima_mesi,
    nota: r.nota ?? null,
    stato: r.stato,
  }));

  const date = aperte.map((r) => r.disponibile_dal).filter((d): d is string => !!d).sort();
  const contratto = a.contratto_tipo || "Da definire";

  return {
    id: a.id,
    hostId: a.host_id,
    titolo: a.titolo,
    zona: a.zona,
    lat: a.lat ?? CENTRO.lat,
    lng: a.lng ?? CENTRO.lng,
    tot: a.camere_totali,
    occ: a.camere_occupate,
    prezzo: prima?.prezzo_mensile ?? 0,
    tipo: prima?.tipo === "doppia" ? "Doppia" : "Singola",
    spese: etichettaSpese(!!prima?.spese_incluse, prima?.spese_stimate ?? null),
    speseIncl: !!prima?.spese_incluse,
    min: prima?.permanenza_minima_mesi ?? 6,
    contratto,
    // Ogni tipo di contratto in elenco è registrato; anche i valori vecchi
    // ("Registrato — studenti (3+2)"). Solo "da definire/concordare" no.
    registrato: !/^da (definire|concordare)$/i.test(contratto),
    agenzia: !!a.tramite_agenzia,
    caparra: a.cauzione ?? null,
    piano: a.piano ?? null,
    bagni: a.bagni ?? null,
    genere: a.genere,
    preferenze: a.preferenze ?? [],
    vicinoA: a.vicino_a ?? null,
    linkFoto: a.link_foto ?? null,
    servizi: a.servizi ?? [],
    descrizione: a.descrizione ?? "",
    coinq: coinquiliniVisibili(a.housemates).map((h) => ({
      g: h.genere ?? "",
      e: h.eta,
      c: h.corso ?? "",
      ab: h.abitudini ?? [],
      pending: h.stato === "in_attesa",
    })),
    foto: a.foto_urls ?? [],
    stanze,
    liberi: libere.reduce((n, r) => n + (r.posti_liberi ?? 1), 0),
    inTrattativa: aperte.filter((r) => r.stato === "in_trattativa").length,
    dal: date[0] ?? null,
    aggiornato: a.aggiornato_il ?? a.created_at,
    confermato: a.confermato_il ?? a.created_at,
  };
}

/** Ordine predefinito: prima le case aggiornate di recente, poi le più economiche. */
export function ordinaPerFreschezza(x: MobileAnnuncio, y: MobileAnnuncio): number {
  const d = giorniDa(x.aggiornato) - giorniDa(y.aggiornato);
  return d !== 0 ? d : x.prezzo - y.prezzo;
}
