import type { Annuncio, GenereCasa, TipoStanza } from "./types";

// Dataset dimostrativo, identico al seed SQL. Usato quando Supabase
// non è configurato, così la ricerca/card/dettaglio funzionano da subito.

interface Spec {
  id: string;
  titolo: string;
  zona: string;
  via: string;
  lat: number;
  lng: number;
  piano: string;
  genere: GenereCasa;
  tot: number;
  occ: number;
  servizi: string[];
  contratto: string;
  cauzione: string;
  descrizione: string;
  prezzo: number;
  tipo: TipoStanza;
  speseIncl: boolean;
  speseStim: number | null;
  dal: string;
  minMesi: number;
  coinq: { n: string; e: number; c: string }[];
}

const SPECS: Spec[] = [
  { id: "a0000001-0000-0000-0000-000000000001", titolo: "Singola in trilocale a due passi da Zamboni", zona: "Zamboni", via: "Via Mascarella", lat: 44.4972, lng: 11.3535, piano: "2° senza ascensore", genere: "misto", tot: 3, occ: 2, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Contratto registrato", "Balcone"], contratto: "Registrato — studenti (3+2)", cauzione: "2 mensilità", descrizione: "Secondo piano in una traversa di via Mascarella. Cinque minuti a piedi da via Zamboni. Casa tranquilla ma non silenziosa: si cena spesso insieme.", prezzo: 480, tipo: "singola", speseIncl: true, speseStim: null, dal: "2026-09-01", minMesi: 12, coinq: [{ n: "Giulia", e: 23, c: "Lettere moderne" }, { n: "Marta", e: 22, c: "Scienze politiche" }] },
  { id: "a0000002-0000-0000-0000-000000000002", titolo: "Doppia in appartamento nuovo in Bolognina", zona: "Bolognina", via: "Via Fioravanti", lat: 44.5105, lng: 11.3448, piano: "4° con ascensore", genere: "misto", tot: 4, occ: 2, servizi: ["Wi-Fi", "Lavatrice", "Lavastoviglie", "Arredata", "Aria condizionata", "Bici/garage", "Contratto registrato"], contratto: "Registrato — transitorio", cauzione: "1 mensilità", descrizione: "Palazzina ristrutturata vicino alla stazione. Due camere ancora libere su quattro. Ottimo se studi a Terracini: dieci minuti di bici in piano.", prezzo: 290, tipo: "doppia", speseIncl: false, speseStim: 50, dal: "2026-10-01", minMesi: 6, coinq: [{ n: "Ahmed", e: 24, c: "Ingegneria informatica" }, { n: "Luca", e: 22, c: "Statistica" }] },
  { id: "a0000003-0000-0000-0000-000000000003", titolo: "Singola solo ragazze in Santo Stefano", zona: "Santo Stefano", via: "Via Castiglione", lat: 44.4885, lng: 11.3486, piano: "1° senza ascensore", genere: "ragazze", tot: 3, occ: 2, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Contratto registrato"], contratto: "Registrato — studenti (3+2)", cauzione: "2 mensilità", descrizione: "Zona bellissima e silenziosa sotto i portici di Castiglione. Casa ordinata, si studia molto. Cerchiamo una ragazza per almeno un anno accademico.", prezzo: 520, tipo: "singola", speseIncl: true, speseStim: null, dal: "2026-09-01", minMesi: 12, coinq: [{ n: "Sofia", e: 25, c: "Medicina" }, { n: "Elena", e: 24, c: "Giurisprudenza" }] },
  { id: "a0000004-0000-0000-0000-000000000004", titolo: "Stanza in quadrilocale zona Massarenti", zona: "Massarenti", via: "Via Massarenti", lat: 44.4892, lng: 11.3652, piano: "3° con ascensore", genere: "misto", tot: 4, occ: 3, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Bici/garage"], contratto: "Registrato — transitorio", cauzione: "1 mensilità", descrizione: "Ultima camera libera. Casa di studenti dell'area medica, il Sant'Orsola è dietro l'angolo. Turni e orari strani sono la normalità qui.", prezzo: 360, tipo: "singola", speseIncl: false, speseStim: 50, dal: "2026-09-01", minMesi: 6, coinq: [{ n: "Chiara", e: 23, c: "Infermieristica" }, { n: "Ilaria", e: 22, c: "Farmacia" }, { n: "Paolo", e: 26, c: "Medicina" }] },
  { id: "a0000005-0000-0000-0000-000000000005", titolo: "Due singole in casa indipendente a Murri", zona: "Murri", via: "Via Murri", lat: 44.4795, lng: 11.3558, piano: "Villetta su due livelli", genere: "misto", tot: 5, occ: 3, servizi: ["Wi-Fi", "Lavatrice", "Lavastoviglie", "Arredata", "Balcone", "Ammessi animali", "Bici/garage"], contratto: "Registrato — studenti (3+2)", cauzione: "2 mensilità", descrizione: "Casa con giardino e tavolo grande. Due camere libere insieme, ideale se cercate in due. Un po' fuori dal centro ma la 13 passa ogni cinque minuti.", prezzo: 420, tipo: "singola", speseIncl: false, speseStim: 80, dal: "2026-10-01", minMesi: 12, coinq: [{ n: "Federico", e: 25, c: "Architettura" }, { n: "Anna", e: 24, c: "Psicologia" }, { n: "Nikola", e: 23, c: "Erasmus — Economia" }] },
  { id: "a0000006-0000-0000-0000-000000000006", titolo: "Singola economica in Cirenaica", zona: "Cirenaica", via: "Via Libia", lat: 44.4932, lng: 11.3682, piano: "1° senza ascensore", genere: "ragazzi", tot: 3, occ: 2, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Si può fumare"], contratto: "Da concordare", cauzione: "1 mensilità", descrizione: "Camera libera anche per pochi mesi, perfetta per un semestre. Quartiere vivo, mercato sotto casa, birreria all'angolo.", prezzo: 330, tipo: "singola", speseIncl: true, speseStim: null, dal: "2026-08-20", minMesi: 3, coinq: [{ n: "Matteo", e: 22, c: "Ingegneria energetica" }, { n: "Simone", e: 23, c: "Informatica" }] },
  { id: "a0000007-0000-0000-0000-000000000007", titolo: "Camera luminosa in Saragozza", zona: "Saragozza", via: "Via Saragozza", lat: 44.4878, lng: 11.3332, piano: "3° con ascensore", genere: "ragazze", tot: 4, occ: 1, servizi: ["Wi-Fi", "Lavatrice", "Lavastoviglie", "Arredata", "Balcone", "Aria condizionata", "Contratto registrato"], contratto: "Registrato — studenti (3+2)", cauzione: "2 mensilità", descrizione: "Appartamento appena ristrutturato: tre camere ancora da riempire, quindi si sceglie insieme chi entra. Sotto i portici di San Luca.", prezzo: 450, tipo: "singola", speseIncl: false, speseStim: 50, dal: "2026-09-01", minMesi: 12, coinq: [{ n: "Beatrice", e: 24, c: "Farmacia" }] },
  { id: "a0000008-0000-0000-0000-000000000008", titolo: "Posto in doppia low cost a San Donato", zona: "San Donato", via: "Via San Donato", lat: 44.5092, lng: 11.3722, piano: "5° con ascensore", genere: "ragazzi", tot: 4, occ: 3, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Bici/garage"], contratto: "Registrato — transitorio", cauzione: "1 mensilità", descrizione: "Il prezzo più basso della zona, camera doppia con l'altro posto già occupato. Autobus 25 diretto per Terracini, oppure venti minuti di bici.", prezzo: 260, tipo: "doppia", speseIncl: true, speseStim: null, dal: "2026-10-01", minMesi: 6, coinq: [{ n: "Youssef", e: 21, c: "Ingegneria civile" }, { n: "Davide", e: 22, c: "Ingegneria civile" }, { n: "Andrea", e: 23, c: "Chimica" }] },
  { id: "a0000009-0000-0000-0000-000000000009", titolo: "Singola silenziosa a Porta Saffi", zona: "Porta Saffi", via: "Via Andrea Costa", lat: 44.4902, lng: 11.3205, piano: "2° con ascensore", genere: "misto", tot: 3, occ: 1, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Contratto registrato"], contratto: "Registrato — transitorio", cauzione: "1 mensilità", descrizione: "Casa tranquilla, chi ci abita lavora in dipartimento e sta fuori tutto il giorno. Due camere libere da gennaio, buona per il secondo semestre.", prezzo: 390, tipo: "singola", speseIncl: false, speseStim: 50, dal: "2027-01-01", minMesi: 6, coinq: [{ n: "Riccardo", e: 26, c: "Dottorando in Fisica" }] },
  { id: "a0000010-0000-0000-0000-000000000010", titolo: "Stanza in casa grande al Navile", zona: "Navile", via: "Via di Corticella", lat: 44.5248, lng: 11.352, piano: "Piano terra con corte", genere: "misto", tot: 5, occ: 4, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Ammessi animali", "Si può fumare", "Bici/garage"], contratto: "Da concordare", cauzione: "Nessuna", descrizione: "Casa rumorosa nel senso bello: cene, gente che passa, un gatto. Ultima camera. Se cerchi silenzio assoluto non è il posto giusto.", prezzo: 300, tipo: "singola", speseIncl: true, speseStim: null, dal: "2026-08-20", minMesi: 3, coinq: [{ n: "Sara", e: 24, c: "DAMS" }, { n: "Tommaso", e: 25, c: "Antropologia" }, { n: "Lea", e: 23, c: "Erasmus — DAMS" }, { n: "Gio", e: 27, c: "Fuori corso, lavora" }] },
  { id: "a0000011-0000-0000-0000-000000000011", titolo: "Singola in bilocale condiviso zona Fiera", zona: "Fiera", via: "Via Stalingrado", lat: 44.5148, lng: 11.3625, piano: "6° con ascensore", genere: "ragazze", tot: 2, occ: 1, servizi: ["Wi-Fi", "Lavatrice", "Lavastoviglie", "Arredata", "Aria condizionata", "Balcone", "Contratto registrato"], contratto: "Registrato — transitorio", cauzione: "1 mensilità", descrizione: "Solo in due in casa, quindi bagno quasi sempre libero. Palazzo moderno con portineria. Va bene per chi vuole studiare senza troppo caos.", prezzo: 410, tipo: "singola", speseIncl: true, speseStim: null, dal: "2026-09-01", minMesi: 6, coinq: [{ n: "Valentina", e: 26, c: "Magistrale in Economia" }] },
  { id: "a0000012-0000-0000-0000-000000000012", titolo: "Due camere in villetta alla Barca", zona: "Barca", via: "Via Tolmino", lat: 44.4872, lng: 11.3025, piano: "Villetta con giardino", genere: "misto", tot: 4, occ: 2, servizi: ["Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Ammessi animali", "Bici/garage"], contratto: "Registrato — studenti (3+2)", cauzione: "1 mensilità", descrizione: "Zona residenziale, aria buona e affitti bassi. Il Treno della Barca è a due passi. Serve la bici o il 21, ma si risparmiano cento euro al mese.", prezzo: 280, tipo: "singola", speseIncl: false, speseStim: 50, dal: "2026-10-01", minMesi: 12, coinq: [{ n: "Emanuele", e: 23, c: "Agraria" }, { n: "Nicolò", e: 22, c: "Scienze motorie" }] },
];

const HOST_ID = "00000000-0000-0000-0000-0000000000aa";

// Preferenze di vita d'esempio, assegnate a rotazione ai coinquilini demo.
const DEMO_ABIT: string[][] = [
  ["Non fumo", "Studio a casa"],
  ["Ordinato/a", "Cucino spesso"],
  ["Rientro tardi", "Weekend fuori"],
  ["Non fumo", "Ho un animale"],
];

export const DEMO_ANNUNCI: Annuncio[] = SPECS.map((s) => {
  const libere = s.tot - s.occ;
  return {
    id: s.id,
    host_id: HOST_ID,
    titolo: s.titolo,
    descrizione: s.descrizione,
    zona: s.zona,
    via: s.via,
    lat: s.lat,
    lng: s.lng,
    piano: s.piano,
    genere: s.genere,
    camere_totali: s.tot,
    camere_occupate: s.occ,
    servizi: s.servizi,
    regole: [],
    contratto_tipo: s.contratto,
    cauzione: s.cauzione,
    contatto_nome: "Host demo",
    contatto_telefono: "+39 051 000000",
    contatto_whatsapp: null,
    contatto_email: null,
    contatto_note: null,
    foto_urls: [],
    attivo: true,
    created_at: "2026-08-01T00:00:00Z",
    rooms: Array.from({ length: libere }, (_, i) => ({
      id: `${s.id}-r${i}`,
      apartment_id: s.id,
      tipo: s.tipo,
      prezzo_mensile: s.prezzo,
      spese_incluse: s.speseIncl,
      spese_stimate: s.speseStim,
      disponibile_dal: s.dal,
      permanenza_minima_mesi: s.minMesi,
      stato: "libera" as const,
    })),
    housemates: s.coinq.map((c, i) => ({
      id: `${s.id}-h${i}`,
      apartment_id: s.id,
      profile_id: null,
      nome_visualizzato: null,
      eta: c.e,
      corso: c.c,
      genere:
        s.genere === "ragazze"
          ? "ragazza"
          : s.genere === "ragazzi"
            ? "ragazzo"
            : i % 2 === 0
              ? "ragazza"
              : "ragazzo",
      abitudini: DEMO_ABIT[i % DEMO_ABIT.length],
    })),
  };
});
