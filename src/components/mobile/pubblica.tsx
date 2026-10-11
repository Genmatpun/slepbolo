"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { geocodaVia } from "@/lib/geocoding";
import {
  ABIT_CATEGORIE,
  CAPARRE,
  CONTRATTI,
  GENERI_COINQUILINO,
  PREFERENZE_CASA,
  SERVIZI_CASA,
  SPESE_VOCI,
  ZONE_BOLOGNA,
  personaCoinquilino,
} from "@/lib/constants";
import type { AnnuncioEstratto, RispostaEstrazione } from "@/lib/estrazione";
import type { AnnuncioPrivato, Housemate, Room, StatoStanza } from "@/lib/types";
import { SPIEGA_CONTRATTO } from "./glossario";
import { BOTTONE, C, CAMPO, EASE, css, dataBreve, euro, oggiISO } from "./stile";
import { Campo, CampoTesto, Chip, Foglio, Icona, Segmenti, useSchermo } from "./ui";

// ============================================================
// Pubblica una casa — dentro l'app, a passi.
//
// Si parte incollando il messaggio che si è già scritto per WhatsApp:
// il modulo si riempie da solo, e la persona controlla ogni passo prima
// di pubblicare. Oppure si compila a mano.
// In modifica le stanze esistenti tengono il loro stato (libera, in
// trattativa, presa): niente più "cancella tutto e ricrea".
// Un annuncio nuovo si salva da solo come bozza su questo dispositivo:
// chi esce a metà lo ritrova. Le foto no (sono file), e lo diciamo.
// ============================================================

interface StanzaForm {
  /** chiave locale, per React e per ritrovare il campo sbagliato: non va nel database */
  k: string;
  /** id della riga in rooms, se esiste già */
  id: string | null;
  stato: StatoStanza;
  tipo: "singola" | "doppia";
  posti: number;
  prezzo: string;
  speseIncl: boolean;
  spese: string;
  speseComprendono: string[];
  dal: string;
  fino: string;
  min: number;
  nota: string;
}

interface CoinqForm {
  /** chiave locale, come per le stanze */
  k: string;
  genere: string;
  eta: string;
  corso: string;
  abitudini: string[];
}

const chiaveLocale = () => Math.random().toString(36).slice(2, 10);

const nuovaStanza = (): StanzaForm => ({
  k: chiaveLocale(),
  id: null,
  stato: "libera",
  tipo: "singola",
  posti: 1,
  prezzo: "",
  speseIncl: false,
  spese: "",
  speseComprendono: [],
  dal: oggiISO(),
  fino: "",
  min: 6,
  nota: "",
});

const nuovoCoinquilino = (): CoinqForm => ({ k: chiaveLocale(), genere: "ragazza", eta: "", corso: "", abitudini: [] });

const PASSI = ["Inizia", "La casa", "Le stanze", "Chi ci abita", "Condizioni", "Contatti", "Controlla"] as const;
const ULTIMO = PASSI.length - 1;

/**
 * "Incolla da WhatsApp" (passo 0): rimandato. Con false la pubblicazione parte
 * dai campi. Per riaccenderlo: true, e ANTHROPIC_API_KEY su Vercel.
 */
export const INCOLLA_ATTIVO = false;

const GENERI_CASA_SCELTA = [
  { value: "misto", label: "Mista" },
  { value: "ragazze", label: "Solo ragazze" },
  { value: "ragazzi", label: "Solo ragazzi" },
] as const;

const FOTO_MAX = 12;
const MESI_MINIMI = [1, 3, 6, 9, 12, 18, 24];

const chiaveFile = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

/** Un bottone disattivato deve sembrarlo. */
const spento = (si: boolean) => (si ? ";opacity:.5;cursor:default" : "");

/** Il campo standard, con il bordo rosso di quando c'è un errore. */
const CAMPO_ERRORE = CAMPO.replace(C.bordo, C.rosso);

interface Errore {
  /** nome del campo: lo stesso del suo data-campo */
  campo: string;
  testo: string;
}

// ---------- bozza ----------
// Un annuncio nuovo si salva da solo, su questo dispositivo, mentre lo si
// scrive. Le foto scelte sono file: non si possono salvare.

const CHIAVE_BOZZA = "slepbolo-bozza-";

interface DatiBozza {
  zona: string;
  via: string;
  piano: string;
  bagni: string;
  tot: string;
  genere: "misto" | "ragazze" | "ragazzi";
  servizi: string[];
  stanze: StanzaForm[];
  coinq: CoinqForm[];
  inviti: string[];
  titolo: string;
  titoloToccato: boolean;
  contratto: string;
  agenzia: boolean;
  senzaContratto: boolean;
  caparra: string;
  preferenze: string[];
  vicinoA: string;
  descrizione: string;
  linkFoto: string;
  fotoEsistenti: string[];
  cNome: string;
  cTel: string;
  cWa: string;
  cEmail: string;
  cNote: string;
}

interface Bozza {
  v: 1;
  /** quando è stata salvata l'ultima volta */
  salvata: string;
  passo: number;
  /** quante foto erano state scelte: non si salvano, ma si può dirlo */
  foto: number;
  dati: DatiBozza;
}

function leggiBozza(userId: string): Bozza | null {
  try {
    const grezza = localStorage.getItem(CHIAVE_BOZZA + userId);
    if (!grezza) return null;
    const b = JSON.parse(grezza) as Partial<Bozza> | null;
    // una bozza rovinata o di un'altra versione si ignora: non deve bloccare il modulo
    if (!b || b.v !== 1 || !b.dati || typeof b.dati !== "object") return null;
    return b as Bozza;
  } catch {
    return null;
  }
}

/** Restituisce false se il dispositivo non lascia salvare (memoria piena, navigazione privata). */
function scriviBozza(userId: string, bozza: Omit<Bozza, "v" | "salvata">): boolean {
  try {
    localStorage.setItem(CHIAVE_BOZZA + userId, JSON.stringify({ v: 1, salvata: new Date().toISOString(), ...bozza }));
    return true;
  } catch {
    return false;
  }
}

function cancellaBozza(userId: string) {
  try {
    localStorage.removeItem(CHIAVE_BOZZA + userId);
  } catch {
    // niente da cancellare
  }
}

// quello che torna dalla memoria si ricontrolla campo per campo
const testo = (v: unknown): string => (typeof v === "string" ? v : "");
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const oggetti = <T,>(v: unknown): Partial<T>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

function stanzaDaBozza(s: Partial<StanzaForm>): StanzaForm {
  const base = nuovaStanza();
  return {
    ...base,
    tipo: s.tipo === "doppia" ? "doppia" : "singola",
    posti: typeof s.posti === "number" && s.posti >= 1 ? s.posti : 1,
    prezzo: testo(s.prezzo),
    speseIncl: !!s.speseIncl,
    spese: testo(s.spese),
    speseComprendono: lista(s.speseComprendono),
    // una data ormai passata non si può più scegliere: riparte da oggi
    dal: typeof s.dal === "string" && s.dal >= base.dal ? s.dal : base.dal,
    fino: testo(s.fino),
    min: typeof s.min === "number" && s.min >= 1 ? s.min : base.min,
    nota: testo(s.nota),
  };
}

function coinqDaBozza(c: Partial<CoinqForm>): CoinqForm {
  return { ...nuovoCoinquilino(), genere: testo(c.genere) || "ragazza", eta: testo(c.eta), corso: testo(c.corso), abitudini: lista(c.abitudini) };
}

/** "oggi alle 14:32" · "ieri alle 9:05" · "il 3 ottobre". */
function quandoSalvata(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mezzanotte = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const giorni = Math.round((mezzanotte(new Date()) - mezzanotte(d)) / 86_400_000);
  const ora = new Intl.DateTimeFormat("it-IT", { hour: "numeric", minute: "2-digit" }).format(d);
  if (giorni <= 0) return `oggi alle ${ora}`;
  if (giorni === 1) return `ieri alle ${ora}`;
  return `il ${dataBreve(iso)}`;
}

/** Due parole per riconoscere la bozza: "Bolognina · 2 stanze · 335 €". */
function riassuntoBozza(b: Bozza): string {
  const stanze = oggetti<StanzaForm>(b.dati.stanze);
  const prezzo = Number(testo(stanze[0]?.prezzo)) || 0;
  return [
    testo(b.dati.zona),
    stanze.length ? `${stanze.length} ${stanze.length === 1 ? "stanza" : "stanze"}` : "",
    prezzo ? euro(prezzo) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------- uscire a metà ----------

type Uscita = "bozza" | "persa" | "modifiche" | "incompleto";

const USCITA: Record<Uscita, { titolo: string; testo: string; esci: string; resta: string; perde: boolean }> = {
  bozza: {
    titolo: "Esci e finisci dopo?",
    testo: "Quello che hai scritto resta salvato come bozza su questo dispositivo: lo ritrovi quando torni a pubblicare.",
    esci: "Esci, tengo la bozza",
    resta: "Continua a compilare",
    perde: false,
  },
  persa: {
    titolo: "Uscire senza salvare?",
    testo: "Su questo dispositivo non riesco a salvare la bozza: se esci, quello che hai scritto si perde.",
    esci: "Esci senza salvare",
    resta: "Continua a compilare",
    perde: true,
  },
  modifiche: {
    titolo: "Uscire senza salvare?",
    testo: "Le modifiche che hai fatto non sono ancora salvate: se esci, si perdono.",
    esci: "Esci senza salvare",
    resta: "Continua a modificare",
    perde: true,
  },
  incompleto: {
    titolo: "Uscire adesso?",
    testo: "L'annuncio è già online, ma incompleto. Lo ritrovi in «Le mie case»: toccando «Modifica» puoi finirlo.",
    esci: "Esci, lo finisco dopo",
    resta: "Continua a compilare",
    perde: false,
  },
};

export function Pubblica({
  userId,
  modificaId,
  onChiudi,
  onVedi,
}: {
  userId: string;
  modificaId: string | null;
  /** pubblicato = true se qualcosa è andato online o è cambiato */
  onChiudi: (pubblicato: boolean) => void;
  /** Se c'è, a cose fatte compare «Vedi l'annuncio»: chi lo riceve chiude il modulo e apre la casa. */
  onVedi?: (apartmentId: string) => void;
}) {
  const modifica = !!modificaId;
  const primoPasso = modifica || !INCOLLA_ATTIVO ? 1 : 0;
  const [passo, setPasso] = useState(primoPasso);
  const [carico, setCarico] = useState(modifica);
  const [erroreCarico, setErroreCarico] = useState(false);
  const [tentativo, setTentativo] = useState(0);
  // Gli errori dei campi si ricalcolano a ogni tasto dopo un «Avanti» andato
  // male: così spariscono appena il campo è a posto.
  const [tentato, setTentato] = useState(false);
  /** errore che non è di un campo: un salvataggio non riuscito */
  const [generale, setGenerale] = useState<string | null>(null);
  /** il campo da portare a schermo e mettere a fuoco */
  const [mira, setMira] = useState<{ campo: string } | null>(null);
  /** si è arrivati a questo passo dal riepilogo: si offre di tornarci */
  const [daRiepilogo, setDaRiepilogo] = useState(false);
  const [avvisoEstrazione, setAvvisoEstrazione] = useState<string | null>(null);

  // casa
  const [zona, setZona] = useState<string>("");
  const [via, setVia] = useState("");
  const [piano, setPiano] = useState("");
  const [bagni, setBagni] = useState("");
  const [tot, setTot] = useState("3");
  const [genere, setGenere] = useState<"misto" | "ragazze" | "ragazzi">("misto");
  const [servizi, setServizi] = useState<string[]>([]);
  // stanze
  const [stanze, setStanze] = useState<StanzaForm[]>(() => [nuovaStanza()]);
  const [stanzeEliminate, setStanzeEliminate] = useState<string[]>([]);
  // coinquilini
  const [coinq, setCoinq] = useState<CoinqForm[]>([]);
  const [inviti, setInviti] = useState<string[]>([]);
  const [mailInvito, setMailInvito] = useState("");
  const [erroreInvito, setErroreInvito] = useState<string | null>(null);
  const [abitPer, setAbitPer] = useState<number | null>(null);
  // condizioni
  const [titolo, setTitolo] = useState("");
  const [titoloToccato, setTitoloToccato] = useState(false);
  const [contratto, setContratto] = useState<string>("");
  const [agenzia, setAgenzia] = useState(false);
  const [senzaContratto, setSenzaContratto] = useState(false);
  const [caparra, setCaparra] = useState<string>("");
  const [preferenze, setPreferenze] = useState<string[]>([]);
  const [vicinoA, setVicinoA] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [linkFoto, setLinkFoto] = useState("");
  const [fotoEsistenti, setFotoEsistenti] = useState<string[]>([]);
  const [nuoveFoto, setNuoveFoto] = useState<File[]>([]);
  const [notaFoto, setNotaFoto] = useState<string | null>(null);
  // contatti
  const [cNome, setCNome] = useState("");
  const [cTel, setCTel] = useState("");
  const [cWa, setCWa] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNote, setCNote] = useState("");
  const [coordEsatte, setCoordEsatte] = useState<{ lat: number; lng: number } | null>(null);
  const viaIniziale = useRef("");
  // In modifica può entrare anche un coinquilino confermato: gestisce stanze e
  // descrizione, ma contatti e via restano quelli di chi ha pubblicato.
  const [hostId, setHostId] = useState<string | null>(null);
  const sonoHost = !modifica || hostId === null || hostId === userId;
  /** l'annuncio che si sta modificando è nascosto: salvarlo non lo rimette in ricerca */
  const [nascosto, setNascosto] = useState(false);

  // incolla
  const [incollato, setIncollato] = useState("");
  const [estraggo, setEstraggo] = useState(false);
  // invio
  const [invio, setInvio] = useState(false);
  /** l'annuncio nuovo è già stato creato da un tentativo riuscito a metà: si aggiorna, non si ricrea */
  const [creatoId, setCreatoId] = useState<string | null>(null);
  const [fatto, setFatto] = useState<null | { id: string; nonIscritti: string[]; fotoFallite: number; avvisi: string[] }>(null);
  const [condiviso, setCondiviso] = useState<null | "copiato" | "a-mano">(null);

  // bozza e uscita
  const [bozzaLetta, setBozzaTrovata] = useState<Bozza | null>(() => (modificaId ? null : leggiBozza(userId)));
  // una bozza è di un annuncio nuovo: in modifica non si propone mai
  const bozzaTrovata = modifica ? null : bozzaLetta;
  const [bozzaStato, setBozzaStato] = useState<"no" | "salvata" | "errore">("no");
  const bozzaScritta = useRef(false);
  const [uscita, setUscita] = useState<Uscita | null>(null);

  const scorri = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scorri.current?.scrollTo({ top: 0 });
  }, [passo]);

  // porta a schermo il campo da sistemare (o la scheda appena aggiunta) e ci mette il focus
  useEffect(() => {
    if (!mira) return;
    const box = scorri.current;
    const el = box?.querySelector<HTMLElement>(`[data-campo="${mira.campo}"]`);
    if (!box || !el) return;
    // sopra il campo c'è la sua etichetta: lascio lo spazio per leggerla
    box.scrollTo({ top: box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 72 });
    el.focus({ preventScroll: true });
  }, [mira]);

  const titoloFatto = useRef<HTMLHeadingElement>(null);
  const finito = !!fatto;
  useEffect(() => {
    if (finito) titoloFatto.current?.focus();
  }, [finito]);

  // ---------- modifica: carico l'annuncio ----------
  useEffect(() => {
    if (!modificaId) return;
    let vivo = true;
    const nonCaricato = () => {
      if (!vivo) return;
      setErroreCarico(true);
      setCarico(false);
    };
    if (!supabaseConfigurato()) {
      nonCaricato();
      return;
    }
    const supabase = createClient();
    Promise.all([
      supabase.from("apartments").select("*, rooms(*), housemates(*)").eq("id", modificaId).single(),
      supabase.from("annunci_privati").select("*").eq("apartment_id", modificaId).maybeSingle(),
    ]).then(([a, p]) => {
      if (!vivo) return;
      // senza i contatti non si apre: salvando li si cancellerebbe
      if (a.error || !a.data || p.error) return nonCaricato();
      const d = a.data as Record<string, unknown> & { rooms: Room[]; housemates: Housemate[] };
      setHostId((d.host_id as string) ?? null);
      setNascosto(d.attivo === false);
      setZona((d.zona as string) ?? "");
      setPiano((d.piano as string) ?? "");
      setBagni(d.bagni ? String(d.bagni) : "");
      setTot(String(d.camere_totali ?? 3));
      setGenere(d.genere === "ragazze" || d.genere === "ragazzi" ? d.genere : "misto");
      setServizi((d.servizi as string[]) ?? []);
      setTitolo((d.titolo as string) ?? "");
      setTitoloToccato(true);
      setContratto((d.contratto_tipo as string) ?? "");
      setAgenzia(!!d.tramite_agenzia);
      setCaparra((d.cauzione as string) ?? "");
      setPreferenze((d.preferenze as string[]) ?? []);
      setVicinoA((d.vicino_a as string) ?? "");
      setDescrizione((d.descrizione as string) ?? "");
      setLinkFoto((d.link_foto as string) ?? "");
      setFotoEsistenti((d.foto_urls as string[]) ?? []);
      setStanze(
        d.rooms.length
          ? d.rooms.map((r) => ({
              k: chiaveLocale(),
              id: r.id,
              stato: r.stato,
              tipo: r.tipo,
              posti: r.posti_liberi ?? 1,
              prezzo: String(r.prezzo_mensile),
              speseIncl: r.spese_incluse,
              spese: r.spese_stimate ? String(r.spese_stimate) : "",
              speseComprendono: r.spese_comprendono ?? [],
              dal: r.disponibile_dal ?? oggiISO(),
              fino: r.disponibile_fino ?? "",
              min: r.permanenza_minima_mesi,
              nota: r.nota ?? "",
            }))
          : [nuovaStanza()],
      );
      setCoinq(
        d.housemates
          .filter((h) => !h.profile_id)
          .map((h) => ({ k: chiaveLocale(), genere: h.genere ?? "ragazza", eta: h.eta ? String(h.eta) : "", corso: h.corso ?? "", abitudini: h.abitudini ?? [] })),
      );
      const priv = p.data as AnnuncioPrivato | null;
      if (priv) {
        setVia(priv.via ?? "");
        viaIniziale.current = priv.via ?? "";
        setCNome(priv.contatto_nome ?? "");
        setCTel(priv.contatto_telefono ?? "");
        setCWa(priv.contatto_whatsapp ?? "");
        setCEmail(priv.contatto_email ?? "");
        setCNote(priv.contatto_note ?? "");
        if (priv.lat && priv.lng) setCoordEsatte({ lat: priv.lat, lng: priv.lng });
      }
      setCarico(false);
    }, nonCaricato);
    return () => {
      vivo = false;
    };
  }, [modificaId, tentativo]);

  function ricarica() {
    setErroreCarico(false);
    setCarico(true);
    setTentativo((n) => n + 1);
  }

  // titolo suggerito finché la persona non lo scrive lei
  const titoloSuggerito = useMemo(() => {
    const s = stanze.filter((x) => x.stato !== "occupata");
    if (!zona || !s.length) return "";
    const prima = s[0];
    const cosa =
      s.length > 1
        ? s.every((x) => x.tipo === "singola")
          ? `${s.length} singole`
          : `${s.length} stanze`
        : prima.tipo === "doppia"
          ? prima.posti >= 2
            ? `${prima.posti} posti in doppia`
            : "Posto letto in doppia"
          : "Singola";
    return `${cosa} in ${zona}`.slice(0, 60);
  }, [stanze, zona]);
  const titoloFinale = titoloToccato ? titolo : titoloSuggerito;

  // ---------- cosa è cambiato, e la bozza ----------
  const forma: DatiBozza = {
    zona,
    via,
    piano,
    bagni,
    tot,
    genere,
    servizi,
    stanze,
    coinq,
    inviti,
    titolo,
    titoloToccato,
    contratto,
    agenzia,
    senzaContratto,
    caparra,
    preferenze,
    vicinoA,
    descrizione,
    linkFoto,
    fotoEsistenti,
    cNome,
    cTel,
    cWa,
    cEmail,
    cNote,
  };
  const istantanea = JSON.stringify(forma);
  // Il punto di partenza: il modulo vuoto, la bozza ripresa o l'annuncio caricato.
  const [partenza, setPartenza] = useState<string | null>(null);
  if (partenza === null && !carico && !erroreCarico && !bozzaTrovata) setPartenza(istantanea);
  const modificato = partenza !== null && (istantanea !== partenza || nuoveFoto.length > 0);
  const numeroFoto = nuoveFoto.length;

  // La bozza si salva da sola, poco dopo l'ultima modifica. Mai in modifica, mai
  // mentre si sceglie se riprenderla, mai dopo che l'annuncio è stato creato.
  useEffect(() => {
    if (modifica || partenza === null || creatoId || finito || invio) return;
    if (istantanea === partenza && !bozzaScritta.current) return;
    const salva = () => {
      const ok = scriviBozza(userId, { passo, foto: numeroFoto, dati: JSON.parse(istantanea) as DatiBozza });
      if (ok) bozzaScritta.current = true;
      setBozzaStato(ok ? "salvata" : "errore");
    };
    const t = window.setTimeout(salva, 600);
    // se l'app va in secondo piano prima del salvataggio, salvo subito
    const nascosta = () => {
      if (document.visibilityState === "hidden") salva();
    };
    document.addEventListener("visibilitychange", nascosta);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", nascosta);
    };
  }, [modifica, partenza, creatoId, finito, invio, istantanea, passo, numeroFoto, userId]);

  function riprendiBozza(b: Bozza) {
    const d = b.dati;
    setZona(testo(d.zona));
    setVia(testo(d.via));
    setPiano(testo(d.piano));
    setBagni(testo(d.bagni));
    setTot(testo(d.tot) || "3");
    setGenere(d.genere === "ragazze" || d.genere === "ragazzi" ? d.genere : "misto");
    setServizi(lista(d.servizi));
    const s = oggetti<StanzaForm>(d.stanze).map(stanzaDaBozza);
    setStanze(s.length ? s : [nuovaStanza()]);
    setCoinq(oggetti<CoinqForm>(d.coinq).map(coinqDaBozza));
    setInviti(lista(d.inviti));
    setTitolo(testo(d.titolo));
    setTitoloToccato(!!d.titoloToccato);
    setContratto(testo(d.contratto));
    setAgenzia(!!d.agenzia);
    setSenzaContratto(!!d.senzaContratto);
    setCaparra(testo(d.caparra));
    setPreferenze(lista(d.preferenze));
    setVicinoA(testo(d.vicinoA));
    setDescrizione(testo(d.descrizione));
    setLinkFoto(testo(d.linkFoto));
    setCNome(testo(d.cNome));
    setCTel(testo(d.cTel));
    setCWa(testo(d.cWa));
    setCEmail(testo(d.cEmail));
    setCNote(testo(d.cNote));
    setPasso(Math.min(ULTIMO, Math.max(primoPasso, Number(b.passo) || primoPasso)));
    bozzaScritta.current = true;
    setBozzaStato("salvata");
    setBozzaTrovata(null);
    scorri.current?.focus({ preventScroll: true });
  }

  // La vecchia bozza non si cancella qui: la sostituisce il primo salvataggio
  // del modulo nuovo. Chi tocca per sbaglio ed esce subito la ritrova.
  function ricomincia() {
    setBozzaTrovata(null);
    scorri.current?.focus({ preventScroll: true });
  }

  // ---------- incolla da WhatsApp ----------
  async function compilaDaTesto() {
    setGenerale(null);
    setAvvisoEstrazione(null);
    setEstraggo(true);
    let r: RispostaEstrazione;
    try {
      const res = await fetch("/api/estrai-annuncio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testo: incollato }),
      });
      r = (await res.json()) as RispostaEstrazione;
    } catch {
      r = { ok: false, errore: "Connessione assente. Controlla la rete e riprova." };
    }
    setEstraggo(false);
    if (!r.ok) {
      setGenerale(r.errore);
      return;
    }
    applica(r.dati);
    vaiAlPasso(1);
  }

  function applica(d: AnnuncioEstratto) {
    if (d.zona) setZona(d.zona);
    if (d.via) setVia(d.via);
    if (d.piano) setPiano(d.piano);
    if (d.bagni) setBagni(String(d.bagni));
    if (d.genere_casa === "ragazze" || d.genere_casa === "ragazzi" || d.genere_casa === "misto") setGenere(d.genere_casa);
    if (d.servizi.length) setServizi(d.servizi);
    if (d.stanze.length) {
      setStanze(
        d.stanze.map((s) => ({
          ...nuovaStanza(),
          tipo: s.tipo,
          posti: s.posti_liberi,
          prezzo: s.prezzo_mensile ? String(s.prezzo_mensile) : "",
          speseIncl: !!s.spese_incluse,
          spese: s.spese_mensili ? String(s.spese_mensili) : "",
          speseComprendono: s.spese_comprendono,
          dal: s.disponibile_dal && s.disponibile_dal >= oggiISO() ? s.disponibile_dal : oggiISO(),
          fino: s.disponibile_fino ?? "",
          min: s.permanenza_minima_mesi ?? 6,
          nota: s.nota ?? "",
        })),
      );
    }
    const residenti = d.coinquilini.length;
    if (d.camere_totali) setTot(String(d.camere_totali));
    else if (d.stanze.length) setTot(String(Math.max(d.stanze.length + residenti, d.stanze.length + 1)));
    if (residenti) {
      setCoinq(d.coinquilini.map((c) => ({ ...nuovoCoinquilino(), genere: c.genere ?? "altro", eta: c.eta ? String(c.eta) : "", corso: c.corso ?? "" })));
    }
    if (d.contratto) setContratto(d.contratto);
    setAgenzia(!!d.tramite_agenzia);
    setSenzaContratto(d.senza_contratto);
    if (d.caparra) setCaparra(d.caparra);
    if (d.preferenze.length) setPreferenze(d.preferenze);
    if (d.vicino_a) setVicinoA(d.vicino_a);
    if (d.link_foto) setLinkFoto(d.link_foto);
    if (d.descrizione) setDescrizione(d.descrizione);
    if (d.titolo) {
      setTitolo(d.titolo);
      setTitoloToccato(true);
    }
    if (d.contatto_nome) setCNome(d.contatto_nome);
    if (d.contatto_telefono) setCTel(d.contatto_telefono);

    const mancano = [
      !d.zona && "la zona",
      !d.via && "la via",
      !d.stanze.some((s) => s.prezzo_mensile) && "il prezzo",
      !residenti && "chi ci abita",
      "le foto",
    ].filter(Boolean) as string[];
    setAvvisoEstrazione(
      `Ho compilato quello che c'era nel messaggio. Controlla ogni passo: mancano ${mancano.join(", ")}.`,
    );
  }

  // ---------- controlli per passo ----------
  const totN = Number(tot) || 0;
  const aperte = stanze.filter((s) => s.stato !== "occupata");

  /** Gli errori di un passo, nell'ordine in cui i campi compaiono a schermo. */
  function controlla(p: number): Errore[] {
    const e: Errore[] = [];
    const no = (campo: string, messaggio: string) => e.push({ campo, testo: messaggio });
    if (p === 1) {
      if (!zona) no("zona", "Scegli la zona.");
      if (sonoHost && !via.trim()) no("via", "Scrivi via e civico: servono per mettere la casa sulla mappa.");
      if (!totN || totN < 1 || totN > 12) no("tot", "Scrivi quante camere ha la casa, da 1 a 12.");
    }
    if (p === 2) {
      if (!stanze.length) no("stanze", "Aggiungi almeno una stanza.");
      if (stanze.length > totN)
        no(
          "stanze",
          `Hai descritto ${stanze.length} stanze, ma la casa ha ${totN} ${totN === 1 ? "camera" : "camere"} in tutto. Togline una qui, oppure correggi le camere al passo «La casa».`,
        );
      stanze.forEach((s) => {
        const prezzo = Number(s.prezzo);
        if (!s.prezzo) no(`stanza-${s.k}-prezzo`, "Scrivi l'affitto al mese.");
        else if (prezzo < 50 || prezzo > 3000) no(`stanza-${s.k}-prezzo`, "L'affitto va da 50 a 3.000 € al mese.");
        if (!s.speseIncl && s.spese && (Number(s.spese) < 1 || Number(s.spese) > 1000))
          no(`stanza-${s.k}-spese`, "Le spese vanno da 1 a 1.000 € al mese. Se non le sai, lascia vuoto.");
        if (s.fino && s.fino < s.dal) no(`stanza-${s.k}-fino`, "La fine viene prima dell'inizio: correggi una delle due date.");
      });
    }
    if (p === 3) {
      coinq.forEach((c) => {
        if (c.eta && (Number(c.eta) < 16 || Number(c.eta) > 99)) no(`coinq-${c.k}-eta`, "L'età va da 16 a 99 anni.");
      });
      if (mailInvito.trim()) no("invito", "Hai scritto una mail ma non l'hai aggiunta: tocca «Invita», oppure cancellala.");
    }
    if (p === 4) {
      if (!titoloFinale.trim()) no("titolo", "Dai un titolo all'annuncio.");
      if (senzaContratto && (!contratto || contratto === "Da definire"))
        no("contratto", "Scegli il tipo di contratto: SLEPBOLO pubblica solo affitti con contratto registrato.");
      if (linkFoto && !/^https:\/\//i.test(linkFoto)) no("linkFoto", "Il link deve iniziare con https://");
    }
    if (p === 5 && sonoHost) {
      if (!cTel.trim() && !cWa.trim() && !cEmail.trim()) no("contatti", "Lascia almeno un contatto: telefono, WhatsApp o email.");
      if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail)) no("cEmail", "Controlla l'email: deve essere come nome@esempio.it.");
    }
    return e;
  }

  const errori = tentato ? controlla(passo) : [];
  const err = (campo: string) => errori.find((x) => x.campo === campo)?.testo;

  function vaiAlPasso(p: number) {
    setTentato(false);
    setGenerale(null);
    setPasso(p);
    if (p === ULTIMO) setDaRiepilogo(false);
  }

  /** Se nel passo qualcosa non va, mostra gli errori e porta al primo campo da sistemare. */
  function passoValido(): boolean {
    const e = controlla(passo);
    if (!e.length) return true;
    setTentato(true);
    setMira({ campo: e[0].campo });
    return false;
  }

  function avanti() {
    if (passoValido()) vaiAlPasso(Math.min(passo + 1, ULTIMO));
  }

  function alRiepilogo() {
    if (passoValido()) vaiAlPasso(ULTIMO);
  }

  function indietro() {
    if (passo > primoPasso) vaiAlPasso(passo - 1);
  }

  // ---------- uscire ----------
  // La X, Esc e il tasto Indietro del telefono passano tutti da qui.
  function chiedeChiusura() {
    if (invio || uscita) return;
    if (creatoId) return setUscita("incompleto");
    if (!modificato) return onChiudi(false);
    if (modifica) return setUscita("modifiche");
    // annuncio nuovo: salvo subito la bozza, così so se posso prometterla
    const ok = scriviBozza(userId, { passo, foto: nuoveFoto.length, dati: forma });
    if (ok) bozzaScritta.current = true;
    setBozzaStato(ok ? "salvata" : "errore");
    setUscita(ok ? "bozza" : "persa");
  }

  function esci() {
    setUscita(null);
    onChiudi(!!creatoId);
  }

  // ---------- coinquilini invitati ----------
  function invita() {
    const v = mailInvito.trim().toLowerCase();
    if (!/^[^\s@]+@studio\.unibo\.it$/.test(v)) return setErroreInvito("Serve la mail UniBo del coinquilino: finisce con @studio.unibo.it.");
    if (inviti.includes(v)) return setErroreInvito("Questa mail è già tra gli inviti.");
    setInviti([...inviti, v]);
    setMailInvito("");
    setErroreInvito(null);
  }

  // ---------- foto ----------
  const postoFoto = Math.max(0, FOTO_MAX - fotoEsistenti.length - nuoveFoto.length);

  function aggiungiFoto(scelti: File[]) {
    // un tipo vuoto può essere una foto che il telefono non sa descrivere: la tengo
    const immagini = scelti.filter((f) => !f.type || f.type.startsWith("image/"));
    const nuove = immagini.filter((f) => !nuoveFoto.some((g) => chiaveFile(g) === chiaveFile(f)));
    const prese = nuove.slice(0, postoFoto);
    if (prese.length) setNuoveFoto([...nuoveFoto, ...prese]);
    const note = [
      scelti.length > immagini.length ? "Alcuni file non sono immagini: non li ho aggiunti." : "",
      nuove.length > prese.length ? `Il massimo è ${FOTO_MAX} foto: le altre non le ho aggiunte.` : "",
    ].filter(Boolean);
    setNotaFoto(note.length ? note.join(" ") : null);
  }

  // ---------- pubblica ----------
  function fallito(m: string) {
    setInvio(false);
    setGenerale(m);
  }

  async function pubblica() {
    if (invio) return;
    for (let p = 1; p <= 5; p++) {
      const e = controlla(p);
      if (e.length) {
        setGenerale(null);
        setTentato(true);
        setDaRiepilogo(true);
        setPasso(p);
        setMira({ campo: e[0].campo });
        return;
      }
    }
    if (!supabaseConfigurato()) return setGenerale("In questo momento non si può pubblicare. Riprova più tardi.");
    setInvio(true);
    setGenerale(null);
    try {
      await salva();
    } catch {
      fallito("Qualcosa non ha funzionato. Controlla la connessione e riprova.");
    }
  }

  async function salva() {
    const supabase = createClient();
    const ora = new Date().toISOString();
    const riprova = `Controlla la connessione e tocca di nuovo «${modifica ? "Salva le modifiche" : "Pubblica"}».`;

    // coordinate: le ricalcolo solo se la via è cambiata (e solo chi ha pubblicato può cambiarla)
    let coord = coordEsatte;
    if (sonoHost && (!coord || via.trim() !== viaIniziale.current)) coord = await geocodaVia(via.trim(), zona);

    const occupate = Math.max(0, totN - aperte.length);
    const casa = {
      titolo: titoloFinale.trim(),
      descrizione: descrizione.trim() || null,
      zona,
      // il database le arrotonda da solo: in apartments non finiscono mai esatte
      ...(sonoHost ? { lat: coord?.lat ?? null, lng: coord?.lng ?? null } : {}),
      piano: piano.trim() || null,
      bagni: bagni ? Number(bagni) : null,
      genere,
      camere_totali: totN,
      camere_occupate: Math.min(occupate, totN - 1),
      servizi,
      preferenze,
      vicino_a: vicinoA.trim() || null,
      contratto_tipo: contratto || "Da definire",
      tramite_agenzia: agenzia,
      cauzione: caparra || null,
      link_foto: linkFoto.trim() || null,
      confermato_il: ora,
    };

    // se un tentativo precedente ha già creato l'annuncio lo aggiorno: mai due volte
    const esistente = modificaId ?? creatoId;
    let aptId: string;
    if (esistente) {
      const { error } = await supabase.from("apartments").update(casa).eq("id", esistente);
      if (error) return fallito(`Non sono riuscito a salvare ${modifica ? "le modifiche" : "l'annuncio"}. ${riprova}`);
      aptId = esistente;
    } else {
      const { data, error } = await supabase
        .from("apartments")
        .insert({ ...casa, host_id: userId, attivo: true })
        .select("id")
        .single();
      if (error || !data) return fallito(`Non sono riuscito a pubblicare. ${riprova}`);
      aptId = data.id as string;
      // da qui l'annuncio esiste: la bozza non serve più, e riprenderla ne farebbe un doppione
      setCreatoId(aptId);
      cancellaBozza(userId);
    }

    // contatti, via e coordinate esatte: nella tabella protetta (solo chi ha pubblicato)
    if (sonoHost) {
      const { error: erroreContatti } = await supabase.from("annunci_privati").upsert(
        {
          apartment_id: aptId,
          contatto_nome: cNome.trim() || null,
          contatto_telefono: cTel.trim() || null,
          contatto_whatsapp: cWa.trim() || null,
          contatto_email: cEmail.trim() || null,
          contatto_note: cNote.trim() || null,
          via: via.trim(),
          lat: coord?.lat ?? null,
          lng: coord?.lng ?? null,
        },
        { onConflict: "apartment_id" },
      );
      if (erroreContatti) return fallito(`L'annuncio è salvato, ma non i contatti. ${riprova}`);
    }

    const avvisi: string[] = [];
    const daModifica = "da «Le mie case», toccando «Modifica»";

    // foto: quelle che non salgono restano scelte (un altro tentativo le riprova) e si contano
    const urls = [...fotoEsistenti];
    const nonCaricate: File[] = [];
    for (const file of nuoveFoto) {
      const path = `${userId}/${aptId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("foto").upload(path, file, { upsert: true });
      if (error) nonCaricate.push(file);
      else urls.push(supabase.storage.from("foto").getPublicUrl(path).data.publicUrl);
    }
    setFotoEsistenti(urls);
    setNuoveFoto(nonCaricate);
    const { error: erroreFoto } = await supabase.from("apartments").update({ foto_urls: urls }).eq("id", aptId);
    if (erroreFoto) avvisi.push(`Non sono riuscito a salvare le foto. Aggiungile di nuovo ${daModifica}.`);

    // stanze: aggiorno quelle che esistono (lo stato resta), aggiungo le nuove, tolgo le eliminate
    const riga = (s: StanzaForm) => ({
      apartment_id: aptId,
      tipo: s.tipo,
      posti_liberi: s.tipo === "doppia" ? s.posti : 1,
      prezzo_mensile: Number(s.prezzo),
      spese_incluse: s.speseIncl,
      spese_stimate: s.speseIncl ? null : s.spese ? Number(s.spese) : null,
      spese_comprendono: s.speseComprendono,
      disponibile_dal: s.dal || null,
      disponibile_fino: s.fino || null,
      permanenza_minima_mesi: s.min,
      nota: s.nota.trim() || null,
    });
    const nonLeStanze = `L'annuncio è salvato, ma non tutte le stanze. ${riprova}`;
    if (stanzeEliminate.length) {
      const { error } = await supabase.from("rooms").delete().in("id", stanzeEliminate);
      if (error) return fallito(nonLeStanze);
    }
    for (const s of stanze.filter((x) => x.id)) {
      const { error } = await supabase.from("rooms").update(riga(s)).eq("id", s.id as string);
      if (error) return fallito(nonLeStanze);
    }
    const nuove = stanze.filter((x) => !x.id);
    if (nuove.length) {
      const { error } = await supabase.from("rooms").insert(nuove.map((s) => ({ ...riga(s), stato: "libera" })));
      if (error) return fallito(nonLeStanze);
    }

    // Da qui niente ferma più la pubblicazione (riprovare aggiungerebbe le stanze
    // due volte): quello che non riesce lo dico alla fine.

    // coinquilini descritti a mano (quelli invitati e confermati restano)
    let coinquiliniSalvati = true;
    try {
      if (modificaId) {
        const { error } = await supabase.from("housemates").delete().eq("apartment_id", aptId).is("profile_id", null);
        if (error) coinquiliniSalvati = false;
      }
      if (coinquiliniSalvati && coinq.length) {
        const { error } = await supabase.from("housemates").insert(
          coinq.map((c) => ({
            apartment_id: aptId,
            nome_visualizzato: null,
            genere: c.genere,
            eta: c.eta ? Number(c.eta) : null,
            corso: c.corso.trim() || null,
            abitudini: c.abitudini,
          })),
        );
        if (error) coinquiliniSalvati = false;
      }
    } catch {
      coinquiliniSalvati = false;
    }
    if (!coinquiliniSalvati) avvisi.push(`Non sono riuscito a salvare chi ci abita. Aggiungilo di nuovo ${daModifica}.`);

    // inviti
    const nonIscritti: string[] = [];
    const nonInvitati: string[] = [];
    for (const em of inviti) {
      try {
        const { data, error } = await supabase.rpc("invita_coinquilino", { p_apartment: aptId, p_email: em });
        if (error) nonInvitati.push(em);
        else if (data && data !== "ok" && data !== "gia_presente") nonIscritti.push(em);
      } catch {
        nonInvitati.push(em);
      }
    }
    if (nonInvitati.length) avvisi.push(`Non sono riuscito a mandare l'invito a ${nonInvitati.join(", ")}. Riprova ${daModifica}.`);

    if (!modifica) cancellaBozza(userId);
    setInvio(false);
    setFatto({ id: aptId, nonIscritti, fotoFallite: erroreFoto ? 0 : nonCaricate.length, avvisi });
  }

  // ---------- condividi ----------
  async function condividi() {
    if (!fatto) return;
    const url = `${window.location.origin}/app?casa=${fatto.id}&da=condivisione`;
    const prezzi = aperte.map((s) => Number(s.prezzo)).filter(Boolean);
    const prezzo = prezzi.length ? `${Math.min(...prezzi) === Math.max(...prezzi) ? "" : "da "}${euro(Math.min(...prezzi))} al mese` : "";
    const riga = `${[titoloFinale.trim(), prezzo].filter(Boolean).join(", ")} — su SLEPBOLO${coinq.length || inviti.length ? " vedi chi ci abita già" : ""}.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titoloFinale.trim(), text: riga, url });
        return;
      } catch (e) {
        // ha chiuso la condivisione senza scegliere: niente da fare
        if ((e as { name?: string } | null)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${riga} ${url}`);
      setCondiviso("copiato");
    } catch {
      setCondiviso("a-mano");
    }
  }

  // ---------- interfaccia ----------
  const totPassi = PASSI.length - primoPasso;
  const numPasso = passo - primoPasso + 1;
  const progresso = numPasso / totPassi;
  const idErroreTot = useId();

  if (fatto) {
    // in ricerca ci va solo un annuncio visibile con almeno una stanza non presa
    const inRicerca = !nascosto && aperte.length > 0;
    const riquadro = `border:2px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:12px 14px;font-size:14px;line-height:1.45`;
    const link = `${typeof window === "undefined" ? "" : window.location.origin}/app?casa=${fatto.id}&da=condivisione`;
    return (
      <Guscio titolo={modifica ? "Annuncio aggiornato" : "Annuncio pubblicato"} onChiudi={() => onChiudi(true)}>
        <div className="sb-noscroll" style={css("flex:1;overflow:auto;padding:28px 20px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px")}>
          <div style={css(`width:56px;height:56px;flex:none;background:${C.verde};color:${C.crema};display:grid;place-items:center`)}>
            <Icona nome="check" size={30} />
          </div>
          <h2 ref={titoloFatto} tabIndex={-1} style={css("margin:0;font-size:28px;font-weight:900;letter-spacing:-.04em;line-height:1.05;outline:none")}>
            {!inRicerca ? "Modifiche salvate." : modifica ? "Fatto: le modifiche sono online." : "È online."}
          </h2>
          {inRicerca ? (
            <p style={css(`margin:0;font-size:15.5px;line-height:1.5;color:${C.testo}`)}>
              Chi cerca casa lo vede da subito. <b>Ogni tanto conferma che è ancora libera</b> da &laquo;Le mie case&raquo;:
              un annuncio non confermato da 30 giorni sparisce dalla ricerca, così nessuno ti scrive per una stanza già presa.
            </p>
          ) : (
            <p style={css(`margin:0;font-size:15.5px;line-height:1.5;color:${C.testo}`)}>
              {nascosto
                ? "L'annuncio è nascosto, quindi chi cerca non lo vede. Per rimetterlo online apri «Le mie case»."
                : "Tutte le stanze risultano prese, quindi l'annuncio non compare nella ricerca. Quando se ne libera una, segnala «Libera» da «Le mie case»."}
            </p>
          )}
          {fatto.fotoFallite > 0 && (
            <div style={css(riquadro)}>
              <b>{fatto.fotoFallite === 1 ? "1 foto non è stata caricata." : `${fatto.fotoFallite} foto non sono state caricate.`}</b> Il resto
              dell&apos;annuncio è salvato. Puoi aggiungerle di nuovo da &laquo;Le mie case&raquo;, toccando &laquo;Modifica&raquo;.
            </div>
          )}
          {fatto.avvisi.map((a) => (
            <div key={a} style={css(riquadro)}>
              {a}
            </div>
          ))}
          {fatto.nonIscritti.length > 0 && (
            <div style={css(riquadro)}>
              Questi coinquilini non sono ancora iscritti a SLEPBOLO, quindi non li ho aggiunti: {fatto.nonIscritti.join(", ")}. Quando si iscrivono, invitali di nuovo.
            </div>
          )}
          {inRicerca && (
            <>
              <div style={css("flex:none;margin-top:6px")}>
                <button
                  type="button"
                  onClick={condividi}
                  style={css(`${BOTTONE.scuro};width:100%;display:flex;align-items:center;justify-content:center;gap:8px`)}
                >
                  <Icona nome="condividi" size={18} />
                  Condividi l&apos;annuncio
                </button>
                {/* dove non c'è la condivisione del telefono il link si copia: qui si dice com'è andata */}
                <div role="status" aria-live="polite">
                  {condiviso === "copiato" && (
                    <div style={css(`display:flex;align-items:center;gap:6px;margin-top:8px;font-size:14px;font-weight:700;color:${C.verde}`)}>
                      <Icona nome="check" size={16} />
                      Link copiato: incollalo dove vuoi.
                    </div>
                  )}
                  {condiviso === "a-mano" && (
                    <div style={css("margin-top:10px")}>
                      <Campo etichetta="Da qui non riesco a copiarlo: copialo tu">
                        {(id) => <input id={id} readOnly value={link} onFocus={(e) => e.target.select()} style={css(CAMPO)} />}
                      </Campo>
                    </div>
                  )}
                </div>
              </div>
              {onVedi && (
                <button
                  type="button"
                  onClick={() => onVedi(fatto.id)}
                  style={css(`${BOTTONE.contorno};width:100%;flex:none;display:flex;align-items:center;justify-content:center;gap:8px`)}
                >
                  <Icona nome="occhio" size={18} />
                  Vedi l&apos;annuncio
                </button>
              )}
            </>
          )}
          <button type="button" onClick={() => onChiudi(true)} style={css(`${inRicerca ? BOTTONE.contorno : BOTTONE.scuro};width:100%;flex:none`)}>
            Torna all&apos;app
          </button>
        </div>
      </Guscio>
    );
  }

  const inModulo = !carico && !erroreCarico && !bozzaTrovata;
  const messaggioBarra =
    generale ??
    (errori.length === 0
      ? null
      : errori.length === 1
        ? "C'è un campo da sistemare, segnato in rosso."
        : `Ci sono ${errori.length} campi da sistemare, segnati in rosso.`);
  const testiUscita = uscita ? USCITA[uscita] : null;
  const paragrafo = `margin:0;font-size:15px;line-height:1.5;color:${C.testo}`;

  return (
    <Guscio
      titolo={modifica ? "Modifica annuncio" : "Pubblica una stanza"}
      onChiudi={chiedeChiusura}
      onIndietro={inModulo && passo > primoPasso && !invio ? indietro : undefined}
      bloccato={invio}
      sotto={
        inModulo ? (
          <div>
            <div style={css(`height:4px;background:${C.linea}`)}>
              <div style={css(`height:100%;background:${C.rosso};transform-origin:left;transform:scaleX(${progresso});transition:transform .35s ${EASE}`)} />
            </div>
            <div style={css(`display:flex;align-items:baseline;gap:10px;padding:8px 20px 0;font-size:13px;font-weight:700;color:${C.grigio}`)}>
              <span aria-live="polite" style={css("flex:1")}>
                Passo {numPasso} di {totPassi} · {PASSI[passo]}
              </span>
              {!modifica && !creatoId && bozzaStato !== "no" && (
                <span style={css(bozzaStato === "errore" ? `color:${C.rosso}` : "")}>{bozzaStato === "errore" ? "Bozza non salvata" : "Bozza salvata"}</span>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <div ref={scorri} tabIndex={-1} className="sb-noscroll" style={css("flex:1;overflow:auto;padding:16px 20px 24px;outline:none")}>
        {carico ? (
          <div aria-busy="true" style={css(`font-size:14px;color:${C.grigio}`)}>Carico l&apos;annuncio…</div>
        ) : erroreCarico ? (
          <div style={css("display:flex;flex-direction:column;gap:14px")}>
            <div role="alert" style={css(`border:2px solid ${C.rosso};background:${C.carta};padding:12px 14px;font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>
              Non riesco a caricare l&apos;annuncio. Controlla la connessione e riprova.
            </div>
            <button type="button" onClick={ricarica} style={css(`${BOTTONE.scuro};width:100%`)}>
              Riprova
            </button>
            <button type="button" onClick={() => onChiudi(false)} style={css(`${BOTTONE.contorno};width:100%`)}>
              Chiudi
            </button>
          </div>
        ) : bozzaTrovata ? (
          <div style={css("display:flex;flex-direction:column;gap:14px")}>
            <h2 style={css("margin:0;font-size:24px;font-weight:900;letter-spacing:-.035em;line-height:1.1")}>Hai una bozza</h2>
            <p style={css(paragrafo)}>
              Avevi iniziato un annuncio e non l&apos;hai pubblicato.
              {quandoSalvata(bozzaTrovata.salvata) ? ` La bozza è stata salvata ${quandoSalvata(bozzaTrovata.salvata)}.` : ""}
            </p>
            {riassuntoBozza(bozzaTrovata) && (
              <div style={css(`border:2px solid ${C.ink};background:${C.carta};padding:12px 14px;font-size:15px;font-weight:800;line-height:1.35`)}>
                {riassuntoBozza(bozzaTrovata)}
              </div>
            )}
            {bozzaTrovata.foto > 0 && (
              <p style={css(paragrafo)}>
                {bozzaTrovata.foto === 1 ? "La foto che avevi scelto non è" : `Le ${bozzaTrovata.foto} foto che avevi scelto non sono`} nella bozza: le foto non si
                possono salvare, dovrai sceglierle di nuovo al passo &laquo;Condizioni&raquo;.
              </p>
            )}
            <button type="button" onClick={() => riprendiBozza(bozzaTrovata)} style={css(`${BOTTONE.scuro};width:100%;margin-top:4px`)}>
              Riprendi la bozza
            </button>
            <button type="button" onClick={ricomincia} style={css(`${BOTTONE.contorno};width:100%`)}>
              Ricomincia da capo
            </button>
            <p style={css(`margin:0;font-size:13px;line-height:1.4;color:${C.grigio}`)}>
              Se ricominci, la bozza viene sostituita appena scrivi qualcosa.
            </p>
          </div>
        ) : (
          <div style={css("display:flex;flex-direction:column;gap:16px")}>
            {avvisoEstrazione && passo > 0 && passo < 6 && (
              <div role="status" style={css(`background:${C.sabbia};padding:12px 14px;font-size:14px;line-height:1.45;color:${C.ink}`)}>
                {avvisoEstrazione}
              </div>
            )}

            {/* 0 · incolla o compila */}
            {passo === 0 && (
              <>
                <h2 style={css("margin:0;font-size:24px;font-weight:900;letter-spacing:-.035em;line-height:1.1")}>
                  Hai già scritto l&apos;annuncio per WhatsApp?
                </h2>
                <p style={css(paragrafo)}>
                  Incollalo qui: ricavo zona, prezzo, spese, stanze e chi ci abita, e riempio il modulo. Poi controlli tu ogni passo, niente va online senza la tua conferma.
                </p>
                <Campo etichetta="Il tuo messaggio" aiuto={`${incollato.length}/4000`}>
                  {(id, d) => (
                    <textarea
                      id={id}
                      aria-describedby={d}
                      value={incollato}
                      onChange={(e) => setIncollato(e.target.value.slice(0, 4000))}
                      rows={8}
                      placeholder="Es. Si libera una singola in zona Massarenti dal 1 novembre, 335 € + 50 di condominio. In casa siamo due ragazze di Medicina…"
                      style={css(`${CAMPO};height:auto;min-height:180px;padding:12px;resize:vertical;line-height:1.45`)}
                    />
                  )}
                </Campo>
                <div role="alert">
                  {generale && <div style={css(`font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>{generale}</div>}
                </div>
                <button
                  type="button"
                  disabled={estraggo || incollato.trim().length < 20}
                  onClick={compilaDaTesto}
                  style={css(
                    `${BOTTONE.pieno};width:100%;height:54px;display:flex;align-items:center;justify-content:center;gap:10px${spento(!estraggo && incollato.trim().length < 20)}`,
                  )}
                >
                  {estraggo ? (
                    <>
                      <span style={css(`width:16px;height:16px;border:2px solid rgba(250,243,231,.4);border-top-color:${C.crema};border-radius:99px;animation:sbSpin .8s linear infinite`)} />
                      Leggo il messaggio…
                    </>
                  ) : (
                    <>
                      <Icona nome="incolla" />
                      Compila per me
                    </>
                  )}
                </button>
                <button type="button" onClick={() => vaiAlPasso(1)} style={css(`${BOTTONE.contorno};width:100%`)}>
                  Preferisco compilare a mano
                </button>
              </>
            )}

            {/* 1 · la casa */}
            {passo === 1 && (
              <>
                <CampoVerificato etichetta="Zona" campo="zona" errore={err("zona")}>
                  {(attr, stile) => (
                    <select {...attr} aria-required value={zona} onChange={(e) => setZona(e.target.value)} style={css(stile)}>
                      <option value="">— scegli la zona —</option>
                      {ZONE_BOLOGNA.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  )}
                </CampoVerificato>
                <TestoVerificato
                  etichetta="Via e civico"
                  campo="via"
                  errore={err("via")}
                  aiuto={
                    sonoHost
                      ? "Non la vede nessuno nella ricerca: sulla mappa la casa compare in una zona approssimata. La via la vede solo chi ti contatta."
                      : "La via la gestisce chi ha pubblicato l'annuncio."
                  }
                  value={via}
                  onChange={setVia}
                  readOnly={!sonoHost}
                  aria-required={sonoHost}
                  autoComplete="street-address"
                  maxLength={120}
                />
                <div style={css("display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px")}>
                  <TestoVerificato
                    etichetta="Camere in tutto"
                    campo="tot"
                    erroreAltrove={err("tot") ? idErroreTot : undefined}
                    value={tot}
                    onChange={(v) => setTot(v.replace(/\D/g, "").slice(0, 2))}
                    inputMode="numeric"
                    aria-required
                  />
                  <CampoTesto etichetta="Bagni" value={bagni} onChange={(v) => setBagni(v.replace(/\D/g, "").slice(0, 1))} inputMode="numeric" />
                  <CampoTesto etichetta="Piano" value={piano} onChange={setPiano} maxLength={40} placeholder="3°, ascensore" />
                  {/* sotto il campo non c'è posto: il messaggio prende tutta la riga */}
                  {err("tot") && (
                    <MessaggioErrore id={idErroreTot} stile="grid-column:1/-1">
                      {err("tot")}
                    </MessaggioErrore>
                  )}
                </div>
                <Campo etichetta="La casa è">
                  {() => <Segmenti etichetta="Chi può abitare la casa" valore={genere} opzioni={GENERI_CASA_SCELTA} onChange={setGenere} />}
                </Campo>
                <Insieme etichetta="In casa c'è">
                  <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                    {SERVIZI_CASA.map((s) => (
                      <Chip key={s} on={servizi.includes(s)} onClick={() => setServizi(servizi.includes(s) ? servizi.filter((x) => x !== s) : [...servizi, s])}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </Insieme>
              </>
            )}

            {/* 2 · le stanze */}
            {passo === 2 && (
              <>
                <p style={css(paragrafo)}>
                  Una scheda per ogni stanza da affittare. Se le stanze sono diverse tra loro, descrivile una per una.
                </p>
                {err("stanze") && (
                  <div
                    data-campo="stanze"
                    tabIndex={-1}
                    style={css(`border:2px solid ${C.rosso};background:${C.carta};padding:12px 14px;display:flex;flex-direction:column;align-items:flex-start;gap:10px;outline:none`)}
                  >
                    <span style={css(`font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>{err("stanze")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        vaiAlPasso(1);
                        setMira({ campo: "tot" });
                      }}
                      style={css(BOTTONE.piccolo)}
                    >
                      Correggi le camere
                    </button>
                  </div>
                )}
                {stanze.map((s, i) => (
                  <SchedaStanza
                    key={s.k}
                    numero={stanze.length > 1 ? i + 1 : null}
                    s={s}
                    errori={{ prezzo: err(`stanza-${s.k}-prezzo`), spese: err(`stanza-${s.k}-spese`), fino: err(`stanza-${s.k}-fino`) }}
                    onCambia={(nuova) => setStanze(stanze.map((x) => (x.k === s.k ? nuova : x)))}
                    onDuplica={() => {
                      const copia: StanzaForm = { ...s, k: chiaveLocale(), id: null, stato: "libera" };
                      setStanze([...stanze.slice(0, i + 1), copia, ...stanze.slice(i + 1)]);
                      setMira({ campo: `stanza-${copia.k}` });
                    }}
                    onElimina={
                      stanze.length > 1
                        ? () => {
                            if (s.id) setStanzeEliminate([...stanzeEliminate, s.id]);
                            setStanze(stanze.filter((x) => x.k !== s.k));
                          }
                        : null
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const nuova = nuovaStanza();
                    setStanze([...stanze, nuova]);
                    setMira({ campo: `stanza-${nuova.k}` });
                  }}
                  style={css(`${BOTTONE.contorno};width:100%;display:flex;align-items:center;justify-content:center;gap:8px`)}
                >
                  <Icona nome="piu" size={18} />
                  Aggiungi un&apos;altra stanza
                </button>
              </>
            )}

            {/* 3 · chi ci abita */}
            {passo === 3 && (
              <>
                <p style={css(paragrafo)}>
                  È la cosa che chi cerca guarda per prima. Nessun nome: solo genere, età, corso e abitudini.
                </p>
                {coinq.map((c, i) => (
                  <div
                    key={c.k}
                    role="group"
                    aria-label={`Coinquilino ${i + 1}`}
                    data-campo={`coinq-${c.k}`}
                    tabIndex={-1}
                    style={css(`border:2px solid ${C.ink};background:${C.carta};padding:14px;display:flex;flex-direction:column;gap:12px;outline:none`)}
                  >
                    <div style={css("display:flex;align-items:center;gap:10px")}>
                      <h2 style={css("margin:0;font-size:15px;font-weight:900;flex:1")}>
                        {personaCoinquilino(c.genere).label}
                        {c.eta ? `, ${c.eta} anni` : ""}
                      </h2>
                      <button
                        type="button"
                        aria-label={`Togli il coinquilino ${i + 1}`}
                        onClick={() => setCoinq(coinq.filter((x) => x.k !== c.k))}
                        style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.rosso};display:grid;place-items:center;cursor:pointer`)}
                      >
                        <Icona nome="cestino" size={18} />
                      </button>
                    </div>
                    <Segmenti
                      etichetta={`Genere del coinquilino ${i + 1}`}
                      valore={c.genere as "ragazza" | "ragazzo" | "altro"}
                      opzioni={GENERI_COINQUILINO}
                      onChange={(v) => setCoinq(coinq.map((x) => (x.k === c.k ? { ...x, genere: v } : x)))}
                    />
                    <div style={css("display:grid;grid-template-columns:90px 1fr;gap:10px")}>
                      <TestoVerificato
                        etichetta="Età"
                        campo={`coinq-${c.k}-eta`}
                        errore={err(`coinq-${c.k}-eta`)}
                        value={c.eta}
                        onChange={(v) => setCoinq(coinq.map((x) => (x.k === c.k ? { ...x, eta: v.replace(/\D/g, "").slice(0, 2) } : x)))}
                        inputMode="numeric"
                      />
                      <CampoTesto
                        etichetta="Corso"
                        value={c.corso}
                        onChange={(v) => setCoinq(coinq.map((x) => (x.k === c.k ? { ...x, corso: v } : x)))}
                        maxLength={80}
                      />
                    </div>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setAbitPer(i)}
                      style={css(`${CAMPO};text-align:left;cursor:pointer;display:flex;align-items:center;gap:8px;height:auto;min-height:48px;padding:8px 12px`)}
                    >
                      <span style={css("flex:1;line-height:1.35")}>{c.abitudini.length ? c.abitudini.join(", ") : "Abitudini (facoltativo)"}</span>
                      <Icona nome="avanti" size={18} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const nuovo = nuovoCoinquilino();
                    setCoinq([...coinq, nuovo]);
                    setMira({ campo: `coinq-${nuovo.k}` });
                  }}
                  style={css(`${BOTTONE.contorno};width:100%;display:flex;align-items:center;justify-content:center;gap:8px`)}
                >
                  <Icona nome="piu" size={18} />
                  Aggiungi chi ci abita
                </button>

                <div style={css(`border-top:2px solid ${C.linea};padding-top:16px;display:flex;flex-direction:column;gap:10px`)}>
                  <h2 style={css("margin:0;font-size:15px;font-weight:900")}>Il coinquilino è già su SLEPBOLO?</h2>
                  <p style={css(`margin:0;font-size:14px;line-height:1.45;color:${C.testo}`)}>
                    Invitalo con la sua mail UniBo: compare con i dati del suo profilo e conferma entro 24 ore. È più credibile di una descrizione.
                  </p>
                  {inviti.map((em) => (
                    <div key={em} style={css(`display:flex;align-items:center;gap:8px;border:2px solid ${C.bordo};padding:0 0 0 12px;font-size:14px;font-weight:700`)}>
                      <span style={css("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis")}>{em}</span>
                      <button
                        type="button"
                        aria-label={`Togli l'invito a ${em}`}
                        onClick={() => setInviti(inviti.filter((x) => x !== em))}
                        style={css(`width:44px;height:44px;flex:none;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}
                      >
                        <Icona nome="chiudi" size={16} />
                      </button>
                    </div>
                  ))}
                  <CampoVerificato etichetta="Mail UniBo del coinquilino" campo="invito" errore={erroreInvito ?? err("invito")}>
                    {(attr, stile) => (
                      <div style={css("display:flex;gap:8px")}>
                        <input
                          {...attr}
                          type="email"
                          autoComplete="off"
                          placeholder="nome.cognome@studio.unibo.it"
                          value={mailInvito}
                          onChange={(e) => {
                            setMailInvito(e.target.value);
                            setErroreInvito(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            invita();
                          }}
                          style={css(`${stile};flex:1;min-width:0`)}
                        />
                        <button type="button" onClick={invita} style={css(`${BOTTONE.scuro};height:48px;flex:none`)}>
                          Invita
                        </button>
                      </div>
                    )}
                  </CampoVerificato>
                </div>
              </>
            )}

            {/* 4 · condizioni: prima l'annuncio (foto in testa), poi i patti, poi chi e dove */}
            {passo === 4 && (
              <div style={css("display:flex;flex-direction:column;gap:28px")}>
                <Gruppo titolo="L'annuncio">
                  <Insieme
                    etichetta="Foto"
                    aiuto={`Foto vere della casa, con luce naturale. Fino a ${FOTO_MAX}.${
                      modifica ? "" : " Non restano nella bozza: se esci prima di pubblicare, dovrai sceglierle di nuovo."
                    }`}
                  >
                    <div style={css("display:flex;flex-wrap:wrap;gap:10px;padding:8px 8px 0 0")}>
                      {fotoEsistenti.map((u, i) => (
                        <Miniatura key={u} src={u} numero={i + 1} onTogli={() => setFotoEsistenti(fotoEsistenti.filter((x) => x !== u))} />
                      ))}
                      {nuoveFoto.map((f, i) => (
                        <MiniaturaFile
                          key={chiaveFile(f)}
                          file={f}
                          numero={fotoEsistenti.length + i + 1}
                          onTogli={() => setNuoveFoto(nuoveFoto.filter((x) => x !== f))}
                        />
                      ))}
                      {postoFoto > 0 && <AggiungiFoto largo={fotoEsistenti.length + nuoveFoto.length === 0} onScegli={aggiungiFoto} />}
                    </div>
                    <div role="status" aria-live="polite">
                      {(notaFoto || postoFoto === 0) && (
                        <span style={css(`font-size:13px;font-weight:700;line-height:1.35;color:${C.ambraTesto}`)}>
                          {notaFoto ?? `Hai ${FOTO_MAX} foto, il massimo: per aggiungerne un'altra, togline una.`}
                        </span>
                      )}
                    </div>
                  </Insieme>
                  <TestoVerificato
                    etichetta="Titolo"
                    campo="titolo"
                    errore={err("titolo")}
                    aiuto="Breve: tipo di stanza e zona."
                    value={titoloFinale}
                    onChange={(v) => {
                      setTitolo(v);
                      setTitoloToccato(true);
                    }}
                    maxLength={80}
                    aria-required
                  />
                  <Campo etichetta="Descrizione" aiuto={`${descrizione.length}/2000`}>
                    {(id, d) => (
                      <textarea
                        id={id}
                        aria-describedby={d}
                        rows={5}
                        maxLength={2000}
                        value={descrizione}
                        onChange={(e) => setDescrizione(e.target.value)}
                        placeholder="Com'è la casa, com'è la vita in casa, cosa cercate in un coinquilino"
                        style={css(`${CAMPO};height:auto;min-height:120px;padding:12px;resize:vertical;line-height:1.45`)}
                      />
                    )}
                  </Campo>
                </Gruppo>

                <Gruppo titolo="Contratto e caparra">
                  {senzaContratto && (
                    <div role="note" style={css(`border:2px solid ${C.rosso};background:${C.carta};padding:12px 14px;font-size:14px;font-weight:700;line-height:1.45;color:${C.rosso}`)}>
                      Il messaggio parla di un affitto senza contratto. SLEPBOLO pubblica solo affitti con contratto registrato: è una tutela per chi entra e per te.
                    </div>
                  )}
                  <CampoVerificato
                    etichetta="Contratto"
                    campo="contratto"
                    errore={err("contratto")}
                    aiuto={
                      SPIEGA_CONTRATTO[contratto]
                        ? `Chi cerca casa lo trova spiegato così: «${SPIEGA_CONTRATTO[contratto]}»`
                        : "Se non lo sai ancora, scegli «Da definire»."
                    }
                  >
                    {(attr, stile) => (
                      <select {...attr} value={contratto} onChange={(e) => setContratto(e.target.value)} style={css(stile)}>
                        <option value="">— scegli —</option>
                        {CONTRATTI.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {contratto && !(CONTRATTI as readonly string[]).includes(contratto) && <option value={contratto}>{contratto}</option>}
                      </select>
                    )}
                  </CampoVerificato>
                  <label style={css(`display:flex;align-items:center;gap:12px;min-height:48px;border:2px solid ${agenzia ? C.rosso : C.bordo};padding:8px 14px;cursor:pointer;font-size:15px;font-weight:700`)}>
                    <input type="checkbox" checked={agenzia} onChange={(e) => setAgenzia(e.target.checked)} style={css(`width:20px;height:20px;flex:none;accent-color:${C.rosso}`)} />
                    <span>
                      Il contratto passa da un&apos;agenzia
                      <span style={css(`display:block;font-size:13px;font-weight:600;color:${C.grigio}`)}>Lo scriviamo nell&apos;annuncio, così nessuno ha sorprese.</span>
                    </span>
                  </label>
                  <Campo etichetta="Caparra">
                    {(id) => (
                      <select id={id} value={caparra} onChange={(e) => setCaparra(e.target.value)} style={css(CAMPO)}>
                        <option value="">— non dirlo ora —</option>
                        {CAPARRE.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {caparra && !(CAPARRE as readonly string[]).includes(caparra) && <option value={caparra}>{caparra}</option>}
                      </select>
                    )}
                  </Campo>
                </Gruppo>

                <Gruppo titolo="Chi cercate e dove">
                  <Insieme etichetta="Chi cercate">
                    <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                      {PREFERENZE_CASA.map((p) => (
                        <Chip
                          key={p.value}
                          on={preferenze.includes(p.value)}
                          onClick={() => setPreferenze(preferenze.includes(p.value) ? preferenze.filter((x) => x !== p.value) : [...preferenze, p.value])}
                        >
                          {p.label}
                        </Chip>
                      ))}
                    </div>
                  </Insieme>
                  <CampoTesto
                    etichetta="Cosa c'è vicino"
                    aiuto="Fermate e linee bus, dipartimenti, supermercati."
                    value={vicinoA}
                    onChange={setVicinoA}
                    maxLength={200}
                    placeholder="Bus 19 e 36 sotto casa, 10 minuti da Chimica"
                  />
                  <TestoVerificato
                    etichetta="Altre foto su un altro sito (facoltativo)"
                    campo="linkFoto"
                    errore={err("linkFoto")}
                    value={linkFoto}
                    onChange={setLinkFoto}
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                  />
                </Gruppo>
              </div>
            )}

            {/* 5 · contatti */}
            {passo === 5 && !sonoHost && (
              <div style={css(`background:${C.sabbia};padding:14px;font-size:15px;line-height:1.45`)}>
                I contatti sono quelli di chi ha pubblicato l&apos;annuncio, e li può cambiare solo lui o lei. Tu puoi aggiornare stanze, foto e descrizione.
              </div>
            )}
            {passo === 5 && sonoHost && (
              <>
                <div style={css(`display:flex;gap:10px;background:${C.sabbia};padding:12px 14px;font-size:14px;line-height:1.45`)}>
                  <Icona nome="lucchetto" size={18} />
                  <span>I contatti li vedono <b>solo gli studenti UniBo</b> entrati con la mail istituzionale. Niente agenzie, niente sconosciuti.</span>
                </div>
                <CampoTesto etichetta="Il tuo nome" value={cNome} onChange={setCNome} autoComplete="given-name" maxLength={40} />
                <TestoVerificato
                  etichetta="Telefono"
                  campo="contatti"
                  errore={err("contatti")}
                  value={cTel}
                  onChange={setCTel}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+39 …"
                />
                <CampoTesto etichetta="WhatsApp, se è un altro numero" value={cWa} onChange={setCWa} type="tel" inputMode="tel" />
                <TestoVerificato etichetta="Email" campo="cEmail" errore={err("cEmail")} value={cEmail} onChange={setCEmail} type="email" autoComplete="email" />
                <CampoTesto etichetta="Note per chi ti scrive" value={cNote} onChange={setCNote} maxLength={80} placeholder="Scrivetemi la sera" />
              </>
            )}

            {/* 6 · controlla */}
            {passo === 6 && (
              <Riepilogo
                titolo={titoloFinale}
                zona={zona}
                stanze={stanze}
                tot={totN}
                coinq={coinq}
                inviti={inviti.length}
                contratto={contratto || "Da definire"}
                agenzia={agenzia}
                caparra={caparra}
                foto={fotoEsistenti.length + nuoveFoto.length}
                contatti={[cTel, cWa, cEmail].filter((x) => x.trim()).length}
                bloccato={invio}
                vaiA={(p) => {
                  vaiAlPasso(p);
                  setDaRiepilogo(true);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* barra in basso: qui sta anche il messaggio, così si vede da qualsiasi punto del passo */}
      {inModulo && passo > 0 && (
        <div style={css(`padding:12px 20px calc(14px + env(safe-area-inset-bottom));border-top:2px solid ${C.ink};background:${C.crema}`)}>
          <div role="alert">
            {messaggioBarra && <div style={css(`margin-bottom:10px;font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>{messaggioBarra}</div>}
          </div>
          <div style={css("display:flex;gap:10px")}>
            {passo > primoPasso && (
              <button type="button" onClick={indietro} disabled={invio} style={css(`${BOTTONE.contorno};height:52px;flex:none${spento(invio)}`)}>
                Indietro
              </button>
            )}
            {passo === ULTIMO ? (
              <button type="button" onClick={pubblica} disabled={invio} aria-busy={invio} style={css(`${BOTTONE.pieno};flex:1${spento(invio)}`)}>
                {invio ? (modifica ? "Salvo…" : "Pubblico…") : modifica ? "Salva le modifiche" : "Pubblica"}
              </button>
            ) : daRiepilogo ? (
              <button type="button" onClick={alRiepilogo} style={css(`${BOTTONE.scuro};flex:1`)}>
                Torna al riepilogo
              </button>
            ) : (
              <button type="button" onClick={avanti} style={css(`${BOTTONE.scuro};flex:1;display:flex;align-items:center;justify-content:center;gap:8px`)}>
                Avanti
                <Icona nome="freccia" size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      <Foglio
        aperto={abitPer !== null}
        onChiudi={() => setAbitPer(null)}
        titolo="Abitudini del coinquilino"
        piede={
          <button type="button" onClick={() => setAbitPer(null)} style={css(`${BOTTONE.scuro};width:100%;height:48px`)}>
            Fatto
          </button>
        }
      >
        {abitPer !== null && coinq[abitPer] && (
          <div style={css("display:flex;flex-direction:column;gap:16px")}>
            {ABIT_CATEGORIE.map((cat) => (
              <fieldset key={cat.titolo} style={css("border:0;margin:0;padding:0")}>
                <legend style={css("font-size:13px;font-weight:800;margin-bottom:8px;padding:0")}>{cat.titolo}</legend>
                <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                  {cat.voci.map((v) => {
                    const sel = coinq[abitPer].abitudini;
                    return (
                      <Chip
                        key={v}
                        on={sel.includes(v)}
                        onClick={() =>
                          setCoinq(
                            coinq.map((x, j) =>
                              j === abitPer ? { ...x, abitudini: sel.includes(v) ? sel.filter((y) => y !== v) : [...sel, v] } : x,
                            ),
                          )
                        }
                      >
                        {v}
                      </Chip>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </Foglio>

      <Foglio
        aperto={testiUscita !== null}
        onChiudi={() => setUscita(null)}
        titolo={testiUscita?.titolo ?? ""}
        piede={
          testiUscita && (
            <>
              <button type="button" onClick={esci} style={css(`${testiUscita.perde ? BOTTONE.pieno : BOTTONE.scuro};width:100%`)}>
                {testiUscita.esci}
              </button>
              <button type="button" onClick={() => setUscita(null)} style={css(`${BOTTONE.contorno};width:100%;margin-top:8px`)}>
                {testiUscita.resta}
              </button>
            </>
          )
        }
      >
        {testiUscita && (
          <div style={css("display:flex;flex-direction:column;gap:10px")}>
            <p style={css(paragrafo)}>{testiUscita.testo}</p>
            {uscita === "bozza" && nuoveFoto.length > 0 && (
              <p style={css(paragrafo)}>
                {nuoveFoto.length === 1 ? "La foto che hai scelto non resta" : "Le foto che hai scelto non restano"} nella bozza: dovrai sceglierle di nuovo.
              </p>
            )}
          </div>
        )}
      </Foglio>
    </Guscio>
  );
}

// ---------- pezzi del modulo ----------

function Guscio({
  titolo,
  onChiudi,
  onIndietro,
  bloccato = false,
  sotto,
  children,
}: {
  titolo: string;
  onChiudi: () => void;
  onIndietro?: () => void;
  /** mentre si salva non si esce */
  bloccato?: boolean;
  sotto?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Esc e il tasto Indietro del telefono fanno quello che fa la X
  const ref = useSchermo(true, onChiudi);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={titolo}
      style={css(`position:absolute;inset:0;z-index:85;background:${C.crema};display:flex;flex-direction:column;outline:none;animation:sbSlide .32s ${EASE} both`)}
    >
      <div style={css(`padding:calc(10px + env(safe-area-inset-top)) 8px 10px;border-bottom:2px solid ${C.ink}`)}>
        <div style={css("display:flex;align-items:center;gap:4px")}>
          {onIndietro ? (
            <button type="button" onClick={onIndietro} aria-label="Passo precedente" style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}>
              <Icona nome="indietro" />
            </button>
          ) : (
            <span style={css("width:44px")} />
          )}
          <h1 style={css("margin:0;flex:1;font-size:18px;font-weight:900;letter-spacing:-.03em;text-align:center")}>{titolo}</h1>
          <button
            type="button"
            onClick={onChiudi}
            disabled={bloccato}
            aria-label="Chiudi"
            style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer${spento(bloccato)}`)}
          >
            <Icona nome="chiudi" />
          </button>
        </div>
      </div>
      {sotto}
      {children}
    </div>
  );
}

/** Un gruppo di campi con il suo titoletto: poche decisioni alla volta. `dentro` = dentro una scheda. */
function Gruppo({ titolo, dentro = false, children }: { titolo: string; dentro?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      style={css(`display:flex;flex-direction:column;gap:${dentro ? `12px;border-top:1px solid ${C.linea};padding-top:12px` : "16px"}`)}
    >
      {dentro ? (
        <h3 id={id} style={css(`margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.grigio}`)}>
          {titolo}
        </h3>
      ) : (
        <h2 id={id} style={css(`display:flex;align-items:center;gap:10px;margin:0;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${C.arancioTesto}`)}>
          <span>{titolo}</span>
          <span aria-hidden style={css(`height:2px;flex:1;background:${C.linea}`)} />
        </h2>
      )}
      {children}
    </div>
  );
}

/** Etichetta per un insieme di scelte (chip, foto): non c'è un input solo a cui legarla. */
function Insieme({ etichetta, aiuto, children }: { etichetta: string; aiuto?: string; children: React.ReactNode }) {
  const id = useId();
  const idAiuto = aiuto ? `${id}-aiuto` : undefined;
  return (
    <div role="group" aria-labelledby={id} aria-describedby={idAiuto} style={css("display:flex;flex-direction:column;gap:6px;min-width:0")}>
      <span id={id} style={css(`font-size:13px;font-weight:800;color:${C.ink}`)}>
        {etichetta}
      </span>
      {children}
      {aiuto ? (
        <span id={idAiuto} style={css(`font-size:12.5px;color:${C.grigio};line-height:1.35`)}>
          {aiuto}
        </span>
      ) : null}
    </div>
  );
}

function MessaggioErrore({ id, stile = "", children }: { id: string; stile?: string; children: React.ReactNode }) {
  return (
    <span id={id} style={css(`font-size:13px;font-weight:700;line-height:1.35;color:${C.rosso};${stile}`)}>
      {children}
    </span>
  );
}

interface AttributiCampo {
  id: string;
  "data-campo": string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

/**
 * Come Campo, ma con l'errore accanto al controllo: glielo lega (aria), gli
 * mette il bordo rosso e gli dà il nome (data-campo) con cui «Avanti» lo
 * ritrova per portarlo a schermo.
 */
function CampoVerificato({
  etichetta,
  aiuto,
  errore,
  erroreAltrove,
  campo,
  children,
}: {
  etichetta: string;
  aiuto?: string;
  /** il messaggio, mostrato sotto il controllo */
  errore?: string;
  /** id di un messaggio mostrato altrove, quando sotto il controllo non c'è posto */
  erroreAltrove?: string;
  campo: string;
  children: (attributi: AttributiCampo, stile: string) => React.ReactNode;
}) {
  return (
    <Campo etichetta={etichetta} aiuto={aiuto}>
      {(id, idAiuto) => {
        const sbagliato = !!errore || !!erroreAltrove;
        const idErrore = erroreAltrove ?? (errore ? `${id}-errore` : undefined);
        return (
          <>
            {children(
              {
                id,
                "data-campo": campo,
                "aria-invalid": sbagliato || undefined,
                "aria-describedby": [idErrore, idAiuto].filter(Boolean).join(" ") || undefined,
              },
              sbagliato ? CAMPO_ERRORE : CAMPO,
            )}
            {errore && !erroreAltrove ? <MessaggioErrore id={`${id}-errore`}>{errore}</MessaggioErrore> : null}
          </>
        );
      }}
    </Campo>
  );
}

/** Input testuale con etichetta ed errore accanto. */
function TestoVerificato({
  etichetta,
  aiuto,
  errore,
  erroreAltrove,
  campo,
  value,
  onChange,
  ...resto
}: {
  etichetta: string;
  aiuto?: string;
  errore?: string;
  erroreAltrove?: string;
  campo: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "style">) {
  return (
    <CampoVerificato etichetta={etichetta} aiuto={aiuto} errore={errore} erroreAltrove={erroreAltrove} campo={campo}>
      {(attributi, stile) => (
        <input
          {...attributi}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // un campo che non si può cambiare non deve sembrare da compilare
          style={css(resto.readOnly ? `${stile};background:${C.sabbia};color:${C.testo}` : stile)}
          {...resto}
        />
      )}
    </CampoVerificato>
  );
}

function SchedaStanza({
  numero,
  s,
  errori,
  onCambia,
  onDuplica,
  onElimina,
}: {
  numero: number | null;
  s: StanzaForm;
  errori: { prezzo?: string; spese?: string; fino?: string };
  onCambia: (s: StanzaForm) => void;
  onDuplica: () => void;
  onElimina: (() => void) | null;
}) {
  const set = <K extends keyof StanzaForm>(k: K, v: StanzaForm[K]) => onCambia({ ...s, [k]: v });
  const nome = numero ? `Stanza ${numero}` : "La stanza";
  return (
    <div
      role="group"
      aria-label={nome}
      data-campo={`stanza-${s.k}`}
      tabIndex={-1}
      style={css(`border:2px solid ${C.ink};background:${C.carta};padding:14px;display:flex;flex-direction:column;gap:14px;outline:none`)}
    >
      <div style={css("display:flex;align-items:center;gap:6px;min-height:44px")}>
        <h2 style={css("margin:0;flex:1;font-size:15px;font-weight:900")}>
          {nome}
          {s.stato !== "libera" && (
            <span style={css(`font-size:12px;font-weight:700;color:${C.grigio}`)}> · {s.stato === "occupata" ? "presa" : "in trattativa"}</span>
          )}
        </h2>
        {onElimina && (
          <button
            type="button"
            onClick={onElimina}
            aria-label={`Togli ${numero ? `la stanza ${numero}` : "la stanza"}`}
            style={css(`${BOTTONE.piccolo};width:44px;padding:0;display:grid;place-items:center;border-color:${C.rosso};color:${C.rosso}`)}
          >
            <Icona nome="cestino" size={16} />
          </button>
        )}
      </div>

      <Gruppo dentro titolo="Com'è">
        <Segmenti
          etichetta="Tipo di stanza"
          valore={s.tipo}
          opzioni={[
            { value: "singola", label: "Singola" },
            { value: "doppia", label: "Doppia" },
          ]}
          onChange={(v) => onCambia({ ...s, tipo: v, posti: v === "singola" ? 1 : s.posti })}
        />
        {s.tipo === "doppia" && (
          <Segmenti
            etichetta="Posti liberi nella doppia"
            valore={String(Math.min(2, s.posti)) as "1" | "2"}
            opzioni={[
              { value: "1", label: "1 posto libero" },
              { value: "2", label: "2 posti liberi" },
            ]}
            onChange={(v) => set("posti", Number(v))}
          />
        )}
        <CampoTesto
          etichetta="Una nota sulla stanza (facoltativo)"
          value={s.nota}
          onChange={(v) => set("nota", v)}
          maxLength={160}
          placeholder="Balcone, comunicante con un'altra stanza…"
        />
      </Gruppo>

      <Gruppo dentro titolo="Quanto costa">
        <TestoVerificato
          etichetta={s.tipo === "doppia" && s.posti >= 2 ? "Affitto al mese, a persona (€)" : "Affitto al mese (€)"}
          campo={`stanza-${s.k}-prezzo`}
          errore={errori.prezzo}
          value={s.prezzo}
          onChange={(v) => set("prezzo", v.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          aria-required
        />
        <Campo etichetta="Spese (luce, gas, condominio…)">
          {() => (
            <Segmenti
              etichetta="Spese"
              valore={s.speseIncl ? "incl" : "parte"}
              opzioni={[
                { value: "incl", label: "Incluse" },
                { value: "parte", label: "A parte" },
              ]}
              onChange={(v) => set("speseIncl", v === "incl")}
            />
          )}
        </Campo>
        {!s.speseIncl && (
          <TestoVerificato
            etichetta="Quanto, al mese circa (€)"
            campo={`stanza-${s.k}-spese`}
            errore={errori.spese}
            value={s.spese}
            onChange={(v) => set("spese", v.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="Es. 65"
          />
        )}
        <Insieme etichetta={s.speseIncl ? "Sono comprese" : "Le spese comprendono"}>
          <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
            {SPESE_VOCI.map((v) => (
              <Chip
                key={v}
                on={s.speseComprendono.includes(v)}
                onClick={() => set("speseComprendono", s.speseComprendono.includes(v) ? s.speseComprendono.filter((x) => x !== v) : [...s.speseComprendono, v])}
              >
                {v}
              </Chip>
            ))}
          </div>
        </Insieme>
        {s.prezzo && (
          <div style={css(`font-size:13px;color:${C.grigio};font-weight:600`)}>
            Chi la guarda legge: {euro(Number(s.prezzo))}
            {s.speseIncl ? " spese incluse" : s.spese ? ` + ${s.spese} € di spese` : " + spese"}
          </div>
        )}
      </Gruppo>

      <Gruppo dentro titolo="Quando">
        <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
          <Campo etichetta="Libera dal">
            {(id) => <input id={id} type="date" value={s.dal} min={oggiISO()} onChange={(e) => set("dal", e.target.value)} style={css(CAMPO)} />}
          </Campo>
          <CampoVerificato etichetta="Fino al (se c'è)" campo={`stanza-${s.k}-fino`} errore={errori.fino}>
            {(attributi, stile) => <input {...attributi} type="date" value={s.fino} min={s.dal} onChange={(e) => set("fino", e.target.value)} style={css(stile)} />}
          </CampoVerificato>
        </div>
        <Campo etichetta="Si resta almeno">
          {(id) => (
            <select id={id} value={s.min} onChange={(e) => set("min", Number(e.target.value))} style={css(CAMPO)}>
              {(MESI_MINIMI.includes(s.min) ? MESI_MINIMI : [...MESI_MINIMI, s.min].sort((a, b) => a - b)).map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "mese" : "mesi"}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </Gruppo>

      <div style={css(`display:flex;align-items:center;gap:10px;border-top:1px solid ${C.linea};padding-top:12px`)}>
        <button type="button" onClick={onDuplica} style={css(`${BOTTONE.piccolo};flex:none`)}>
          Duplica stanza
        </button>
        <span style={css(`font-size:12.5px;color:${C.grigio};line-height:1.35`)}>Se ne affitti un&apos;altra uguale o quasi.</span>
      </div>
    </div>
  );
}

function Miniatura({ src, numero, onTogli }: { src: string; numero: number; onTogli: () => void }) {
  return (
    <div style={css("position:relative;width:88px;height:88px")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Foto ${numero} della casa`} loading="lazy" width={88} height={88} style={css(`width:88px;height:88px;object-fit:cover;border:2px solid ${C.linea}`)} />
      {/* la zona da toccare è 44×44, il quadratino che si vede è più piccolo */}
      <button
        type="button"
        onClick={onTogli}
        aria-label={`Togli la foto ${numero}`}
        style={css("position:absolute;right:-8px;top:-8px;width:44px;height:44px;border:0;padding:0;background:transparent;display:grid;place-items:start end;cursor:pointer")}
      >
        <span style={css(`width:28px;height:28px;border:2px solid ${C.ink};background:${C.crema};color:${C.ink};display:grid;place-items:center`)}>
          <Icona nome="chiudi" size={14} />
        </span>
      </button>
    </div>
  );
}

function MiniaturaFile({ file, numero, onTogli }: { file: File; numero: number; onTogli: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <Miniatura src={url} numero={numero} onTogli={onTogli} /> : null;
}

/** Il riquadro per scegliere le foto: largo quando non ce n'è ancora nessuna. */
function AggiungiFoto({ largo, onScegli }: { largo: boolean; onScegli: (f: File[]) => void }) {
  // l'input è invisibile: l'anello del focus da tastiera lo disegna il riquadro
  const [fuoco, setFuoco] = useState(false);
  return (
    <label
      style={css(
        `position:relative;${largo ? "width:100%;height:96px;gap:10px;font-size:15px" : "width:88px;height:88px;flex-direction:column;gap:2px;font-size:12px"};border:2px dashed ${C.grigio};display:flex;align-items:center;justify-content:center;color:${C.testo};font-weight:800;cursor:pointer${fuoco ? `;outline:3px solid ${C.arancio};outline-offset:2px` : ""}`,
      )}
    >
      <Icona nome="piu" size={24} />
      {largo ? "Aggiungi le foto" : "Aggiungi"}
      <input
        type="file"
        accept="image/*"
        multiple
        aria-label={largo ? undefined : "Aggiungi altre foto"}
        onFocus={(e) => setFuoco(e.target.matches(":focus-visible"))}
        onBlur={() => setFuoco(false)}
        style={css("position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer")}
        onChange={(e) => {
          const scelti = Array.from(e.target.files ?? []);
          if (scelti.length) onScegli(scelti);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Riepilogo({
  titolo,
  zona,
  stanze,
  tot,
  coinq,
  inviti,
  contratto,
  agenzia,
  caparra,
  foto,
  contatti,
  bloccato,
  vaiA,
}: {
  titolo: string;
  zona: string;
  stanze: StanzaForm[];
  tot: number;
  coinq: CoinqForm[];
  inviti: number;
  contratto: string;
  agenzia: boolean;
  caparra: string;
  foto: number;
  contatti: number;
  /** mentre si salva non si torna ai passi */
  bloccato: boolean;
  vaiA: (p: number) => void;
}) {
  const aperte = stanze.filter((s) => s.stato !== "occupata");
  const prezzi = aperte.map((s) => Number(s.prezzo)).filter(Boolean);
  const consigli = [
    !foto && { testo: "Non ci sono foto: aggiungine almeno una, chi cerca vuole vedere la stanza.", passo: 4 },
    !coinq.length && !inviti && { testo: "Descrivi chi ci abita: è il motivo per cui si usa SLEPBOLO.", passo: 3 },
  ].filter(Boolean) as { testo: string; passo: number }[];

  const riga = (etichetta: string, valore: string, passo: number) => (
    <button
      type="button"
      disabled={bloccato}
      onClick={() => vaiA(passo)}
      style={css(`width:100%;display:flex;align-items:baseline;gap:12px;min-height:48px;padding:10px 0;border:0;border-bottom:1px solid ${C.linea};background:transparent;font-family:inherit;text-align:left;cursor:pointer;color:${C.ink}${spento(bloccato)}`)}
    >
      <span style={css(`flex:none;width:100px;font-size:13px;font-weight:700;color:${C.grigio}`)}>{etichetta}</span>
      <span style={css("flex:1;font-size:15px;font-weight:700;line-height:1.35")}>{valore}</span>
      <span style={css(`font-size:13px;font-weight:800;color:${C.grigio}`)}>Modifica</span>
    </button>
  );

  return (
    <div style={css("display:flex;flex-direction:column;gap:14px")}>
      <h2 style={css("margin:0;font-size:24px;font-weight:900;letter-spacing:-.035em;line-height:1.1")}>{titolo}</h2>
      {consigli.map((c) => (
        <button
          key={c.testo}
          type="button"
          disabled={bloccato}
          onClick={() => vaiA(c.passo)}
          style={css(`border:2px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:12px 14px;font-family:inherit;font-size:14px;font-weight:700;line-height:1.4;text-align:left;cursor:pointer${spento(bloccato)}`)}
        >
          {c.testo}
        </button>
      ))}
      <div>
        {riga("Zona", zona || "—", 1)}
        {riga(
          "Stanze",
          `${aperte.length} ${aperte.length === 1 ? "libera" : "libere"} su ${tot} camere · ${
            prezzi.length ? (Math.min(...prezzi) === Math.max(...prezzi) ? euro(prezzi[0]) : `da ${euro(Math.min(...prezzi))}`) : "prezzo mancante"
          }`,
          2,
        )}
        {riga(
          "Chi ci abita",
          coinq.length || inviti
            ? [coinq.length ? `${coinq.length} descritti` : null, inviti ? `${inviti} invitati` : null].filter(Boolean).join(" · ")
            : "nessuno",
          3,
        )}
        {riga("Contratto", `${contratto}${agenzia ? " · tramite agenzia" : ""}${caparra ? ` · caparra ${caparra.toLowerCase()}` : ""}`, 4)}
        {riga("Foto", foto ? `${foto}` : "nessuna", 4)}
        {riga("Contatti", contatti ? `${contatti} ${contatti === 1 ? "recapito" : "recapiti"}, visibili solo agli studenti UniBo` : "mancano", 5)}
      </div>
      <p style={css(`margin:0;font-size:14px;line-height:1.45;color:${C.grigio}`)}>
        Pubblicando confermi che la stanza esiste, che le foto sono della casa vera e che il prezzo è quello reale.
      </p>
    </div>
  );
}
