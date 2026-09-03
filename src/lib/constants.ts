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
] as const;

export type SedeKey = (typeof SEDI_UNIBO)[number]["key"];

/** Zone di Bologna coperte dal servizio. */
export const ZONE_BOLOGNA = [
  "Bolognina",
  "Cirenaica",
  "Saragozza",
  "Massarenti",
  "Murri",
  "Navile",
  "San Donato",
  "Santo Stefano",
  "Zamboni",
  "Barca",
  "Fiera",
  "Porta Saffi",
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

export const PREZZO_MIN = 250;
export const PREZZO_MAX = 700;

export const MOTIVI_SEGNALAZIONE = [
  { value: "caparra_anticipata", label: "Richiesta di caparra anticipata" },
  { value: "annuncio_inesistente", label: "Annuncio inesistente" },
  { value: "prezzo_diverso", label: "Prezzo diverso dal reale" },
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
