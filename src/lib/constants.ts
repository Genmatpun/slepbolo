// ============================================================
// Costanti condivise di SLEPBOLO
// ============================================================

/** Sedi UniBo con coordinate reali, usate per il calcolo distanze e i marker mappa. */
export const SEDI_UNIBO = [
  { key: "zamboni", nome: "Zamboni / Centro", lat: 44.4967, lng: 11.3518 },
  { key: "terracini", nome: "Ingegneria — Terracini", lat: 44.5215, lng: 11.3289 },
  { key: "agraria", nome: "Agraria — Filippo Re", lat: 44.4995, lng: 11.352 },
  { key: "belle-arti", nome: "Economia — Belle Arti", lat: 44.4975, lng: 11.349 },
  { key: "sant-orsola", nome: "Medicina — Sant'Orsola", lat: 44.488, lng: 11.362 },
  // Complesso del Navile, via Piero Gobetti 85 (Chimica, Astronomia). Coordinate da OpenStreetMap.
  { key: "navile", nome: "Navile — Chimica e Astronomia", lat: 44.521, lng: 11.337 },
] as const;

export type SedeKey = (typeof SEDI_UNIBO)[number]["key"];

/**
 * Zone di Bologna coperte dal servizio, in ordine alfabetico: con 20 voci
 * il menu si scorre, e l'ordine alfabetico è l'unico che non va imparato.
 */
export const ZONE_BOLOGNA = [
  "Barca",
  "Bolognina",
  "Borgo Panigale",
  "Centro storico",
  "Cirenaica",
  "Corticella",
  "Costa Saragozza",
  "Fiera",
  "Irnerio",
  "Lame",
  "Massarenti",
  "Mazzini",
  "Murri",
  "Navile",
  "Porta Saffi",
  "San Donato",
  "San Vitale",
  "Santo Stefano",
  "Saragozza",
  "Savena",
  "Zamboni",
] as const;

export type Zona = (typeof ZONE_BOLOGNA)[number];

export const GENERI_CASA = [
  { value: "indifferente", label: "Indifferente" },
  { value: "ragazze", label: "Ragazze" },
  { value: "ragazzi", label: "Ragazzi" },
  { value: "misto", label: "Mista" },
] as const;

export const TIPI_STANZA = [
  { value: "singola", label: "Singola" },
  { value: "doppia", label: "Doppia" },
] as const;

/** Stato di una stanza, con le parole che l'host userebbe. */
export const STATI_STANZA = [
  { value: "libera", label: "Libera" },
  { value: "in_trattativa", label: "In trattativa" },
  { value: "occupata", label: "Presa" },
] as const;

/**
 * Tipi di contratto. Non c'è "senza contratto": un affitto non registrato è
 * irregolare, e SLEPBOLO non lo ospita. L'agenzia è un campo a parte.
 */
export const CONTRATTI = [
  "4+4",
  "3+2 a canone concordato",
  "Per studenti (6-36 mesi)",
  "Transitorio",
  "Subentro",
  "Da definire",
] as const;

export const CAPARRE = ["Nessuna", "1 mensilità", "2 mensilità", "3 mensilità"] as const;

/** Cosa coprono le spese mensili: "325 + 65, comprende condominio, TARI e Wi-Fi". */
export const SPESE_VOCI = [
  "Condominio",
  "TARI",
  "Wi-Fi",
  "Luce",
  "Gas",
  "Acqua",
  "Riscaldamento",
] as const;

/** Dotazioni della casa. */
export const SERVIZI_CASA = [
  "Wi-Fi",
  "Lavatrice",
  "Lavastoviglie",
  "Asciugatrice",
  "Forno",
  "Microonde",
  "Aria condizionata",
  "Riscaldamento autonomo",
  "Balcone",
  "Ascensore",
  "Arredata",
  "Posto bici",
] as const;

/** Preferenze di chi abita la casa su chi cercano. */
export const PREFERENZE_CASA = [
  { value: "solo_studenti", label: "Solo studenti" },
  { value: "lavoratori_ok", label: "Anche lavoratori" },
  { value: "coppie_ok", label: "Coppie benvenute" },
  { value: "amici_ok", label: "Anche due amici insieme" },
  { value: "italiano", label: "Si parla italiano" },
  { value: "english_ok", label: "English ok" },
  { value: "no_brevi", label: "No affitti brevi" },
] as const;

export function etichettaPreferenza(v: string): string {
  return PREFERENZE_CASA.find((p) => p.value === v)?.label ?? v;
}

export const LINGUE = ["Italiano", "English", "Español", "Français", "Deutsch", "Português", "Altro"] as const;

/** Anno di corso, come lo dicono gli studenti. */
export const ANNI_CORSO = [
  "1° triennale",
  "2° triennale",
  "3° triennale",
  "1° magistrale",
  "2° magistrale",
  "Ciclo unico",
  "Erasmus",
  "Dottorato",
] as const;

/** Genere del singolo coinquilino, mostrato al posto del nome (privacy). */
export const GENERI_COINQUILINO = [
  { value: "ragazza", label: "Ragazza" },
  { value: "ragazzo", label: "Ragazzo" },
  { value: "altro", label: "Altro" },
] as const;

/** Etichetta + emoji privacy-safe per un coinquilino (nessun nome). */
export function personaCoinquilino(genere: string | null | undefined): { emoji: string; label: string } {
  if (genere === "ragazza") return { emoji: "👩", label: "Ragazza" };
  if (genere === "ragazzo") return { emoji: "👨", label: "Ragazzo" };
  return { emoji: "🧑", label: "Coinquilino/a" };
}

export const SERVIZI_FILTRO = [
  "Spese incluse",
  "Wi-Fi",
  "Lavatrice",
  "Balcone",
  "Arredata",
  "Contratto registrato",
] as const;

export const ABITUDINI = [
  "Non fumo",
  "Fumo",
  "Studio a casa",
  "Rientro tardi",
  "Cucino spesso",
  "Ordinato/a",
  "Ho un animale",
  "Weekend fuori",
] as const;

/** Preferenze di stile di vita a categorie — usate nel profilo e nel modulo coinquilini. */
export const ABIT_CATEGORIE: { titolo: string; voci: string[] }[] = [
  { titolo: "Fumo", voci: ["Non fumo", "Fumo"] },
  { titolo: "Ritmi", voci: ["Mattiniero/a", "Sempre fuori", "Rientro tardi", "Weekend fuori"] },
  { titolo: "In casa", voci: ["Ordinato/a", "Cucino spesso", "Studio a casa", "Silenzioso/a", "Socievole", "Spesso ospiti"] },
  { titolo: "Animali", voci: ["Ho un animale", "Non ho animali"] },
  { titolo: "Altro", voci: ["Sportivo/a", "Vegetariano/a", "Vegano/a", "Musica alta", "Niente feste"] },
];

export const PREZZO_MIN = 250;
export const PREZZO_MAX = 700;

export const MOTIVI_SEGNALAZIONE = [
  { value: "gia_presa", label: "La stanza è già presa" },
  { value: "caparra_anticipata", label: "Chiede soldi prima della visita" },
  { value: "annuncio_inesistente", label: "La casa non esiste o le foto sono false" },
  { value: "prezzo_diverso", label: "Il prezzo è diverso da quello scritto" },
  { value: "agenzia", label: "È un'agenzia" },
  { value: "altro", label: "Altro" },
] as const;

// ---------- Calcolo distanze ----------

const R = 6371; // raggio terrestre km

/** Distanza in linea d'aria (km) tra due coordinate. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Minuti stimati a piedi (~4,8 km/h) e in bici (~14 km/h) verso una sede,
 * con un fattore 1,35 per approssimare le strade reali rispetto alla linea d'aria.
 */
export function tempiVersoSede(
  da: { lat: number; lng: number },
  sede: { lat: number; lng: number },
) {
  const km = haversineKm(da, sede) * 1.35;
  return {
    km,
    piedi: Math.max(1, Math.round((km / 4.8) * 60)),
    bici: Math.max(1, Math.round((km / 14) * 60)),
  };
}

/** Distanze verso tutte le sedi, ordinate dalla più vicina. */
export function distanzeSedi(punto: { lat: number; lng: number }) {
  return SEDI_UNIBO.map((s) => ({
    sede: s,
    ...tempiVersoSede(punto, s),
  })).sort((a, b) => a.km - b.km);
}
