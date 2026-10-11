"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { SEDI_UNIBO, ZONE_BOLOGNA, haversineKm, personaCoinquilino, tempiVersoSede } from "@/lib/constants";
import { leggiProvenienza } from "@/lib/provenienza";
import { giorniDa, quandoAggiornato } from "@/lib/types";
import type { MobileAnnuncio } from "@/lib/annuncio-mobile";
import { MappaBologna } from "./mappa-bologna";
import { BOTTONE, C, EASE, TOKENS_CSS, css, dataBreve, euro } from "./stile";
import { Avviso, Chip, Foglio, Freschezza, Icona, Segmenti, useSchermo } from "./ui";
import { Quadratini, etichettaCamere, etichettaGenereCasa, riepilogoCoinq } from "./pezzi";
import { Dettaglio, sfondoCasa } from "./dettaglio";
import { Glossario } from "./glossario";
import { ProfiloTab, type Preferenze, type Utente } from "./profilo";
import { BachecaCerco, IlMioCerco } from "./cerco";
import { Pubblica } from "./pubblica";

export type { MobileAnnuncio } from "@/lib/annuncio-mobile";

// ============================================================
// SLEPBOLO Mobile — l'app.
// Stessa palette UniBo, impaginazione a vista: griglia, filetti 2px,
// angoli vivi, titoli grandi. Dati reali passati dal server.
//
// Le case si guardano senza account. L'account (mail UniBo) serve per
// contattare chi affitta, pubblicare e vedere chi cerca stanza.
// ============================================================

type Tab = "scopri" | "cerca" | "mappa" | "salvati" | "profilo";

/** Una casa salvata: teniamo i dati essenziali per riconoscerla anche quando sparisce. */
interface Salvata {
  id: string;
  titolo: string;
  zona: string;
  prezzo: number;
}

const FILTRI_RAPIDI = ["Sotto 400 €", "Spese incluse", "Singola", "Libera subito"] as const;
type FiltroRapido = (typeof FILTRI_RAPIDI)[number];

type Ordine = "recenti" | "prezzo" | "vicine";

interface FiltriAvanzati {
  prezzoMax: number | null;
  zone: string[];
  casa: "tutte" | "ragazze" | "ragazzi";
  registrato: boolean;
  breve: boolean;
}
const FILTRI_VUOTI: FiltriAvanzati = { prezzoMax: null, zone: [], casa: "tutte", registrato: false, breve: false };

const ZAMBONI = { lat: 44.4967, lng: 11.3518 };
const AGGIORNA_DOPO_MS = 5 * 60_000;

/** Perché si apre la schermata di accesso: cambia la frase che la spiega. */
type MotivoAccesso = "contatti" | "pubblica" | null;

/** Quello che deve sopravvivere a una ricarica della pagina, finché la scheda resta aperta. */
interface Vista {
  tab: Tab;
  sezioneCerca: "case" | "persone";
  filtri: FiltroRapido[];
  avanzati: FiltriAvanzati;
  ordine: Ordine;
  testo: string;
  casa: string | null;
}

const coverBg = (a: MobileAnnuncio, n = 0) =>
  a.foto[n] ? `${C.ink} url('${a.foto[n]}') center/cover no-repeat` : sfondoCasa(a.id);
const glifo = (a: MobileAnnuncio) => a.zona.slice(0, 3).toUpperCase();

function leggiJSON<T>(chiave: string, area: "local" | "session", base: T): T {
  try {
    const raw = (area === "local" ? localStorage : sessionStorage).getItem(chiave);
    return raw ? (JSON.parse(raw) as T) : base;
  } catch {
    return base;
  }
}
function scriviJSON(chiave: string, area: "local" | "session", v: unknown) {
  try {
    (area === "local" ? localStorage : sessionStorage).setItem(chiave, JSON.stringify(v));
  } catch {
    // memoria piena o finestra privata: pazienza
  }
}

export function MobileApp({
  annunci,
  casaIniziale = null,
  pubblicaIniziale = null,
}: {
  annunci: MobileAnnuncio[];
  casaIniziale?: string | null;
  pubblicaIniziale?: { modificaId: string | null } | null;
}) {
  const router = useRouter();
  const [aggiornando, avviaAggiornamento] = useTransition();
  const ultimoCarico = useRef(Date.now());

  // undefined = sto controllando la sessione; null = non entrato
  const [user, setUser] = useState<Utente | null | undefined>(undefined);
  const [accesso, setAccesso] = useState(false);
  const [motivoAccesso, setMotivoAccesso] = useState<MotivoAccesso>(null);
  const [tab, setTab] = useState<Tab>("scopri");
  const [detail, setDetail] = useState<string | null>(null);
  const [pubblica, setPubblica] = useState<{ modificaId: string | null } | null>(null);
  const [cercoAperto, setCercoAperto] = useState(false);
  const [pref, setPref] = useState<Preferenze>({ budget: null, zone: [], sede: null });
  const [avviso, setAvviso] = useState<{ testo: string; azione?: string; onAzione?: () => void } | null>(null);
  const timerAvviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiuto, setAiuto] = useState(false);
  const [casaSparita, setCasaSparita] = useState(false);

  // Scopri
  const [passate, setPassate] = useState<string[]>([]);
  const [scopriFoto, setScopriFoto] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [guida, setGuida] = useState(false);
  const sx = useRef(0);
  const sy = useRef(0);
  const mosso = useRef(false);

  // Salvati e contatti già presi: restano sul dispositivo
  const [salvate, setSalvate] = useState<Salvata[]>([]);
  const [contattate, setContattate] = useState<Record<string, string>>({});

  // Filtri: gli stessi per Scopri, Cerca e Mappa
  const [sezioneCerca, setSezioneCerca] = useState<"case" | "persone">("case");
  const [filtri, setFiltri] = useState<FiltroRapido[]>([]);
  const [avanzati, setAvanzati] = useState<FiltriAvanzati>(FILTRI_VUOTI);
  const [ordine, setOrdine] = useState<Ordine>("recenti");
  const [testo, setTesto] = useState("");
  const [pannelloFiltri, setPannelloFiltri] = useState(false);
  const [tutteLeZone, setTutteLeZone] = useState(false);
  const vistaLetta = useRef(false);

  // Mappa
  const [selPin, setSelPin] = useState(0);

  const mostraAvviso = useCallback((testo: string, azione?: string, onAzione?: () => void) => {
    if (timerAvviso.current) clearTimeout(timerAvviso.current);
    setAvviso({ testo, azione, onAzione });
    // con un'azione resta più a lungo: c'è il tempo di leggere e decidere
    timerAvviso.current = setTimeout(() => setAvviso(null), azione ? 7000 : 2800);
  }, []);

  const chiediAccesso = useCallback((motivo: MotivoAccesso = "contatti") => {
    setMotivoAccesso(motivo);
    setAccesso(true);
  }, []);

  // ---- sessione + profilo ----
  useEffect(() => {
    // Da dove arriva chi apre l'app (?da=tiktok nel link): lo mettiamo da parte
    // subito, perché l'indirizzo può cambiare prima che la persona si registri.
    leggiProvenienza();

    if (!supabaseConfigurato()) {
      setUser(null);
      return;
    }
    const supabase = createClient();

    type SbUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
    async function carica(u: SbUser) {
      if (!u.email) return setUser(null);
      const meta = u.user_metadata ?? {};
      const { data } = await supabase
        .from("profiles")
        .select("nome, cognome, budget_max, zona_preferita, zone_preferite, sede_principale")
        .eq("id", u.id)
        .single();
      const zone = (data?.zone_preferite as string[] | null | undefined) ?? [];
      setPref({
        budget: data?.budget_max ?? null,
        zone: zone.length ? zone : data?.zona_preferita ? [data.zona_preferita] : [],
        sede: data?.sede_principale ?? null,
      });
      let nome = data?.nome ?? "";
      let cognome = data?.cognome ?? "";
      // Sincronizza nome/cognome dai dati di registrazione se il profilo è vuoto
      if ((!nome || !cognome) && (meta.nome || meta.cognome)) {
        nome = (meta.nome as string) ?? nome;
        cognome = (meta.cognome as string) ?? cognome;
        await supabase.from("profiles").update({ nome, cognome, eta: meta.eta ?? null }).eq("id", u.id);
      }
      setUser({ id: u.id, email: u.email, nome, cognome });
      setAccesso(false);

      // Il canale da cui è arrivata questa persona, una volta sola: se c'è già
      // la riga, il database la lascia stare. È una statistica, se salta pazienza.
      const da = leggiProvenienza();
      if (da) {
        void supabase
          .from("provenienze")
          .upsert({ user_id: u.id, canale: da }, { onConflict: "user_id", ignoreDuplicates: true });
      }
    }
    supabase.auth.getUser().then(({ data: { user: u } }) => (u ? carica(u) : setUser(null)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      session?.user ? carica(session.user) : setUser(null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const loggato = !!user;

  // ---- salvati: sul dispositivo, per utente (o per l'ospite) ----
  const chiaveSalvati = user ? `slepbolo-salvati-${user.id}` : user === null ? "slepbolo-salvati-ospite" : null;
  useEffect(() => {
    if (!chiaveSalvati) return;
    const grezzi = leggiJSON<(string | Salvata)[]>(chiaveSalvati, "local", []);
    // il formato vecchio era solo l'elenco degli id
    setSalvate(
      grezzi
        .map((s) => {
          if (typeof s !== "string") return s;
          const a = annunci.find((x) => x.id === s);
          return a ? { id: a.id, titolo: a.titolo, zona: a.zona, prezzo: a.prezzo } : null;
        })
        .filter((s): s is Salvata => !!s),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiaveSalvati]);
  useEffect(() => {
    if (chiaveSalvati) scriviJSON(chiaveSalvati, "local", salvate);
  }, [salvate, chiaveSalvati]);

  const isSalvata = (id: string) => salvate.some((s) => s.id === id);
  const toggleSalva = (a: MobileAnnuncio) =>
    setSalvate((p) => (p.some((s) => s.id === a.id) ? p.filter((s) => s.id !== a.id) : [...p, { id: a.id, titolo: a.titolo, zona: a.zona, prezzo: a.prezzo }]));

  // ---- a chi hai già scritto: così non devi ricordartelo tu (sul dispositivo, per utente) ----
  const chiaveContattate = user ? `slepbolo-contattate-${user.id}` : null;
  useEffect(() => {
    setContattate(chiaveContattate ? leggiJSON<Record<string, string>>(chiaveContattate, "local", {}) : {});
  }, [chiaveContattate]);
  const segnaContattata = useCallback(
    (id: string) => {
      if (!chiaveContattate) return;
      setContattate((p) => {
        const n = { ...p, [id]: new Date().toISOString() };
        scriviJSON(chiaveContattate, "local", n);
        return n;
      });
    },
    [chiaveContattate],
  );

  // ---- Scopri: le case già viste restano viste per tutta la sessione ----
  useEffect(() => {
    setPassate(leggiJSON<string[]>("slepbolo-passate", "session", []));
    setGuida(!leggiJSON<boolean>("slepbolo-guida-vista", "local", false));
  }, []);
  useEffect(() => {
    scriviJSON("slepbolo-passate", "session", passate);
  }, [passate]);

  // ---- scheda, filtri e casa aperta sopravvivono a una ricarica ----
  useEffect(() => {
    const v = leggiJSON<Partial<Vista> | null>("slepbolo-vista", "session", null);
    vistaLetta.current = true;
    if (!v) return;
    if (v.tab && !pubblicaIniziale) setTab(v.tab);
    if (v.sezioneCerca) setSezioneCerca(v.sezioneCerca);
    if (Array.isArray(v.filtri)) setFiltri(v.filtri.filter((f) => FILTRI_RAPIDI.includes(f)));
    if (v.avanzati) setAvanzati({ ...FILTRI_VUOTI, ...v.avanzati });
    if (v.ordine) setOrdine(v.ordine);
    if (typeof v.testo === "string") setTesto(v.testo);
    if (v.casa && !casaIniziale && annunci.some((a) => a.id === v.casa)) setDetail(v.casa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!vistaLetta.current) return;
    const v: Vista = { tab, sezioneCerca, filtri, avanzati, ordine, testo, casa: detail };
    scriviJSON("slepbolo-vista", "session", v);
  }, [tab, sezioneCerca, filtri, avanzati, ordine, testo, detail]);

  // ---- aggiornamento vero dei dati ----
  const aggiorna = useCallback(() => {
    avviaAggiornamento(() => router.refresh());
    ultimoCarico.current = Date.now();
  }, [router]);

  // tornando sull'app dopo un po', ricarica le case (invece di ripartire da capo)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimoCarico.current > AGGIORNA_DOPO_MS) aggiorna();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [aggiorna]);

  // ---- link condiviso: /app?casa=<id> ----
  const casaGestita = useRef(false);
  useEffect(() => {
    if (!casaIniziale || casaGestita.current) return;
    casaGestita.current = true;
    if (annunci.some((a) => a.id === casaIniziale)) setDetail(casaIniziale);
    // un link a una stanza che non c'è più merita una risposta chiara, non un avviso di due secondi
    else setCasaSparita(true);
  }, [casaIniziale, annunci]);

  // ---- link /app?pubblica=1 o ?modifica=<id>: serve l'accesso, poi si apre il modulo ----
  const pubblicaInSospeso = useRef(pubblicaIniziale);
  useEffect(() => {
    if (!pubblicaInSospeso.current || user === undefined) return;
    if (user === null) {
      chiediAccesso("pubblica");
      return;
    }
    setPubblica(pubblicaInSospeso.current);
    pubblicaInSospeso.current = null;
  }, [user, chiediAccesso]);

  // ---- chi si registra da una casa la ritrova aperta quando torna dopo la mail di conferma ----
  const casaAperta = useRef<string | null>(null);
  useEffect(() => {
    casaAperta.current = detail;
  }, [detail]);
  useEffect(() => {
    if (accesso && casaAperta.current) scriviJSON("slepbolo-riprendi", "local", { casa: casaAperta.current, quando: Date.now() });
  }, [accesso]);
  useEffect(() => {
    if (!user) return;
    const r = leggiJSON<{ casa: string; quando: number } | null>("slepbolo-riprendi", "local", null);
    if (!r) return;
    try {
      localStorage.removeItem("slepbolo-riprendi");
    } catch {
      // niente da fare
    }
    const recente = Date.now() - r.quando < 48 * 3600_000;
    if (recente && !casaAperta.current && !pubblicaInSospeso.current && annunci.some((a) => a.id === r.casa)) setDetail(r.casa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function logout() {
    // la bozza di un annuncio contiene via e telefono: uscendo non resta sul dispositivo
    if (user) {
      try {
        localStorage.removeItem(`slepbolo-bozza-${user.id}`);
      } catch {
        // niente da fare
      }
    }
    if (supabaseConfigurato()) await createClient().auth.signOut();
    setUser(null);
    setTab("scopri");
  }

  // ---- filtri: una sola regola per Scopri, Cerca e Mappa ----
  const origineDistanza = useMemo(() => {
    const s = pref.sede ? SEDI_UNIBO.find((x) => x.nome === pref.sede || x.key === pref.sede) : undefined;
    return s
      ? { punto: { lat: s.lat, lng: s.lng }, nome: s.nome, mia: true }
      : { punto: ZAMBONI, nome: "Zamboni / Centro", mia: false };
  }, [pref.sede]);

  const oggi = new Date().toISOString().slice(0, 10);
  const filtrate = useMemo(() => {
    const parole = testo.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return annunci.filter((a) => {
      if (filtri.includes("Sotto 400 €") && a.prezzo >= 400) return false;
      if (filtri.includes("Spese incluse") && !a.speseIncl) return false;
      if (filtri.includes("Singola") && !a.stanze.some((s) => s.stato !== "occupata" && s.tipo === "Singola")) return false;
      if (filtri.includes("Libera subito") && !(a.dal && a.dal <= oggi)) return false;
      if (avanzati.prezzoMax && a.prezzo > avanzati.prezzoMax) return false;
      if (avanzati.zone.length && !avanzati.zone.includes(a.zona)) return false;
      if (avanzati.casa !== "tutte" && a.genere !== avanzati.casa) return false;
      if (avanzati.registrato && !a.registrato) return false;
      if (avanzati.breve && a.min > 3) return false;
      if (parole.length) {
        const dove = `${a.titolo} ${a.zona} ${a.vicinoA ?? ""} ${a.descrizione}`.toLowerCase();
        if (!parole.every((p) => dove.includes(p))) return false;
      }
      return true;
    });
  }, [annunci, filtri, avanzati, testo, oggi]);

  const poolCerca = useMemo(() => {
    const per = [...filtrate];
    if (ordine === "prezzo") per.sort((x, y) => x.prezzo - y.prezzo);
    else if (ordine === "vicine") per.sort((x, y) => haversineKm(x, origineDistanza.punto) - haversineKm(y, origineDistanza.punto));
    else per.sort((x, y) => giorniDa(x.aggiornato) - giorniDa(y.aggiornato) || x.prezzo - y.prezzo);
    return per;
  }, [filtrate, ordine, origineDistanza]);

  // Scopri: le preferenze del profilo non nascondono niente, mettono solo
  // in cima le zone e i prezzi giusti per te.
  const preferenzeAttive = !!pref.budget || pref.zone.length > 0;
  const poolScopri = useMemo(() => {
    const voto = (a: MobileAnnuncio) =>
      (pref.zone.length && !pref.zone.includes(a.zona) ? 2 : 0) + (pref.budget && a.prezzo > pref.budget ? 1 : 0);
    return filtrate
      .filter((a) => !passate.includes(a.id))
      .sort((x, y) => voto(x) - voto(y) || giorniDa(x.aggiornato) - giorniDa(y.aggiornato));
  }, [filtrate, passate, pref]);

  const nAvanzati =
    (avanzati.prezzoMax ? 1 : 0) + (avanzati.zone.length ? 1 : 0) + (avanzati.casa !== "tutte" ? 1 : 0) + (avanzati.registrato ? 1 : 0) + (avanzati.breve ? 1 : 0);
  const filtriAttivi = filtri.length + nAvanzati + (testo.trim() ? 1 : 0);
  const togliFiltri = () => {
    setFiltri([]);
    setAvanzati(FILTRI_VUOTI);
    setTesto("");
  };
  const cambiaRapido = (f: FiltroRapido) => setFiltri((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  // quante case ci sono adesso in ogni zona: nel foglio dei filtri vengono prima quelle
  const caseInZona = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of annunci) m.set(a.zona, (m.get(a.zona) ?? 0) + 1);
    return m;
  }, [annunci]);

  const det = detail ? annunci.find((a) => a.id === detail) ?? null : null;

  // ---- swipe: trascinare sceglie, toccare apre la casa ----
  const onDown = (e: React.PointerEvent) => {
    if (!poolScopri.length || (e.pointerType === "mouse" && e.button !== 0)) return;
    sx.current = e.clientX;
    sy.current = e.clientY;
    mosso.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - sx.current;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - sy.current) > 8) mosso.current = true;
    setDragX(dx);
  };
  const finisciDrag = () => {
    setDragX(0);
    setDragging(false);
  };
  const avanza = (salva: boolean) => {
    const a = poolScopri[0];
    finisciDrag();
    if (!a) return;
    const giaSalvata = isSalvata(a.id);
    if (salva && !giaSalvata) toggleSalva(a);
    setPassate((p) => [...p, a.id]);
    setScopriFoto(0);
    if (guida) chiudiGuida();
    mostraAvviso(salva ? `Salvata: ${a.zona}` : `Passata: ${a.zona}`, "Annulla", () => {
      setPassate((p) => p.filter((x) => x !== a.id));
      if (salva && !giaSalvata) setSalvate((p) => p.filter((s) => s.id !== a.id));
      setAvviso(null);
    });
  };
  const onUp = () => {
    if (!dragging) return;
    if (dragX > 95) avanza(true);
    else if (dragX < -95) avanza(false);
    else {
      const tocco = !mosso.current;
      finisciDrag();
      if (tocco && poolScopri[0]) setDetail(poolScopri[0].id);
    }
  };

  function chiudiGuida() {
    setGuida(false);
    scriviJSON("slepbolo-guida-vista", "local", true);
  }

  const selA = poolCerca[Math.min(selPin, Math.max(0, poolCerca.length - 1))];
  const scegliPin = useCallback((i: number) => setSelPin(i), []);
  const idSalvate = useMemo(() => salvate.map((s) => s.id), [salvate]);

  const apriPubblica = (modificaId: string | null = null) => {
    if (!user) {
      // dopo l'accesso il modulo si apre da solo
      pubblicaInSospeso.current = { modificaId };
      return chiediAccesso("pubblica");
    }
    setDetail(null);
    setPubblica({ modificaId });
  };

  // ---------- pezzi ----------
  const etichette = (a: MobileAnnuncio) =>
    [
      a.inTrattativa && !a.stanze.some((s) => s.stato === "libera") ? { testo: "In trattativa", tono: "ambra" } : null,
      a.liberi === 1 && a.stanze.some((s) => s.stato === "libera") ? { testo: "Ultimo posto", tono: "caldo" } : null,
      etichettaGenereCasa(a.genere) ? { testo: etichettaGenereCasa(a.genere) as string } : null,
      a.speseIncl ? { testo: "Spese incluse" } : null,
      a.registrato ? { testo: "Contratto registrato" } : null,
      a.min <= 3 ? { testo: "Breve periodo" } : null,
    ]
      .filter(Boolean)
      .slice(0, 3) as { testo: string; tono?: "ambra" | "caldo" }[];

  const stileEtichetta = (t: { tono?: "ambra" | "caldo" }) =>
    t.tono === "ambra"
      ? `border:1px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:5px 9px;font-size:12px;font-weight:800`
      : t.tono === "caldo"
        ? `border:1px solid rgba(228,87,46,.4);background:rgba(228,87,46,.12);color:${C.arancioTesto};padding:5px 9px;font-size:12px;font-weight:800`
        : `border:1px solid ${C.linea};background:${C.crema};color:${C.grigio};padding:5px 9px;font-size:12px;font-weight:700`;

  /** Salva o toglie dai salvati; togliere si può annullare. */
  const cambiaSalvata = (a: MobileAnnuncio) => {
    const era = isSalvata(a.id);
    toggleSalva(a);
    if (era) mostraAvviso("Tolta dai salvati", "Annulla", () => {
      setSalvate((p) => (p.some((s) => s.id === a.id) ? p : [...p, { id: a.id, titolo: a.titolo, zona: a.zona, prezzo: a.prezzo }]));
      setAvviso(null);
    });
  };

  /** "Scritto il 3 ottobre": chi hai già contattato si riconosce a colpo d'occhio. */
  const segnoScritto = (id: string) =>
    contattate[id] ? (
      <span style={css(`display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:${C.verde}`)}>
        <Icona nome="check" size={14} />
        Scritto il {dataBreve(contattate[id])}
      </span>
    ) : null;

  const riga = (a: MobileAnnuncio) => {
    const salvata = isSalvata(a.id);
    return (
      <div key={a.id} style={css(`display:flex;align-items:stretch;border-top:1px solid ${C.linea}`)}>
        <button
          type="button"
          onClick={() => setDetail(a.id)}
          style={css(`flex:1;min-width:0;display:flex;gap:13px;padding:14px 4px 14px 20px;border:0;cursor:pointer;background:transparent;font-family:inherit;text-align:left;color:${C.ink}`)}
        >
          <div
            aria-hidden
            style={css(
              `width:64px;height:64px;flex:none;display:grid;place-items:center;background:${coverBg(a)};color:rgba(255,255,255,.35);font-size:19px;font-weight:900;letter-spacing:-.05em`,
            )}
          >
            {a.foto.length ? "" : glifo(a)}
          </div>
          <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:5px")}>
            <div style={css("display:flex;align-items:baseline;gap:8px")}>
              <span style={css(`font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.arancioTesto}`)}>{a.zona}</span>
              <span style={css("margin-left:auto;font-size:18px;font-weight:900;letter-spacing:-.03em;white-space:nowrap")}>{euro(a.prezzo)}</span>
            </div>
            <div style={css("font-size:15px;font-weight:700;letter-spacing:-.02em;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere")}>
              {a.titolo}
            </div>
            <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
              <Quadratini a={a} size={10} />
              <span style={css(`font-size:12.5px;font-weight:600;color:${C.grigio}`)}>{etichettaCamere(a)}</span>
            </div>
            <div style={css("display:flex;align-items:center;gap:4px 12px;flex-wrap:wrap")}>
              <Freschezza testo={quandoAggiornato(a.aggiornato)} giorni={giorniDa(a.aggiornato)} />
              {segnoScritto(a.id)}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => cambiaSalvata(a)}
          aria-pressed={salvata}
          aria-label={salvata ? `Togli dai salvati: ${a.titolo}` : `Salva: ${a.titolo}`}
          style={css(`width:52px;flex:none;border:0;background:transparent;color:${salvata ? C.rosso : C.bordo};display:grid;place-items:center;cursor:pointer`)}
        >
          <Icona nome="segnalibro" pieno={salvata} />
        </button>
      </div>
    );
  };

  const tabDefs: [Tab, string][] = [
    ["scopri", "Scopri"],
    ["cerca", "Cerca"],
    ["mappa", "Mappa"],
    ["salvati", "Salvati"],
    ["profilo", user ? "Profilo" : "Entra"],
  ];

  const stack = poolScopri.slice(0, 3);
  const titoloGrande = "font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1";
  const testata = "calc(28px + env(safe-area-inset-top))";
  const bottoneFiltri = (
    <button
      type="button"
      onClick={() => setPannelloFiltri(true)}
      style={css(
        `flex:none;min-height:44px;border:2px solid ${C.ink};background:${filtriAttivi ? C.ink : "transparent"};color:${filtriAttivi ? C.crema : C.ink};padding:0 14px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap;pointer-events:auto`,
      )}
    >
      Filtri{filtriAttivi ? ` · ${filtriAttivi}` : ""}
    </button>
  );
  // la sede di riferimento, in breve: "Navile — Chimica e Astronomia" → "Navile"
  const sedeBreve = origineDistanza.nome.split(" —")[0];
  const sopraApp = !!det || !!pubblica || cercoAperto || accesso || pannelloFiltri || aiuto || casaSparita;

  return (
    <div style={css(`${TOKENS_CSS};min-height:100dvh;background:${C.fondo};display:flex;justify-content:center`)}>
      <style>{`
        @keyframes sbIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes sbSlide{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
        @keyframes sbFade{from{opacity:0}to{opacity:1}}
        @keyframes sbPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
        @keyframes sbSpin{to{transform:rotate(360deg)}}
        @keyframes sbSheet{from{transform:translateY(100%)}to{transform:none}}
        .sb-noscroll::-webkit-scrollbar{display:none}
        .sb-app ::selection{background:${C.rosso};color:${C.crema}}
        .sb-app :focus-visible{outline:3px solid ${C.arancio};outline-offset:2px}
        .sb-app input,.sb-app textarea,.sb-app select{caret-color:${C.rosso}}
        .sb-app input::placeholder,.sb-app textarea::placeholder{color:${C.grigio};opacity:1}
        .sb-app .sb-accesso input::placeholder{color:rgba(250,243,231,.84)}
        .sb-app .sb-accesso :focus-visible{outline-color:${C.crema}}
        .sb-app button:disabled{opacity:.42;cursor:default}
        .sb-app ol.sb-numeri{list-style:decimal}
        .sb-carta{container-type:size}
        .sb-solo-alta,.sb-solo-altissima{display:none}
        @container (min-height:400px){.sb-solo-alta{display:flex}}
        @container (min-height:480px){.sb-solo-altissima{display:block}}
        /* schermi molto bassi: copertina minima e una sola etichetta, così non si taglia niente */
        @container (max-height:330px){.sb-copertina{min-height:60px!important;flex-basis:60px!important}.sb-etichetta:nth-child(n+2){display:none}}
        .sb-app .maplibregl-map{font-family:inherit}
        .sb-app .maplibregl-ctrl-top-right{top:calc(108px + env(safe-area-inset-top))}
        .sb-app .maplibregl-ctrl-group{border-radius:0;box-shadow:none;border:2px solid ${C.ink};background:${C.carta}}
        .sb-app .maplibregl-ctrl-group button{width:44px;height:44px}
        .sb-app .maplibregl-ctrl-group button+button{border-top:2px solid ${C.ink}}
        .sb-app .maplibregl-popup-content{border-radius:0;border:2px solid ${C.ink};background:${C.carta};color:${C.ink};font-size:13px;font-weight:800;line-height:1.25;padding:8px 11px;box-shadow:0 6px 18px rgba(27,24,21,.2)}
        .sb-app .maplibregl-popup-tip{display:none}
        @media (prefers-reduced-motion: reduce){
          @keyframes sbIn{from{opacity:0}to{opacity:1}}
          @keyframes sbSlide{from{opacity:0}to{opacity:1}}
          @keyframes sbSheet{from{opacity:0}to{opacity:1}}
          @keyframes sbPop{from{opacity:0}to{opacity:1}}
        }
      `}</style>

      <div
        className="sb-app sb-noscroll"
        style={css(`position:relative;width:100%;max-width:440px;min-height:100dvh;height:100dvh;background:${C.crema};overflow:hidden;color:${C.ink}`)}
      >
        {/* ---------- CARICAMENTO ---------- */}
        {user === undefined && (
          <div style={css(`position:absolute;inset:0;z-index:200;background:${C.rosso};display:grid;place-items:center;animation:sbFade .3s ease both`)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-chiaro.png" alt="SLEPBOLO" width={200} height={125} style={css("width:170px;height:auto;display:block")} />
          </div>
        )}

        {/* ---------- APP ---------- */}
        <div inert={sopraApp} style={css("position:absolute;inset:0;display:flex;flex-direction:column")}>
          <main key={tab} style={css(`flex:1;overflow:hidden;position:relative;animation:sbFade .25s ${EASE} both`)}>
            {/* SCOPRI */}
            {tab === "scopri" && (
              <div style={css(`height:100%;display:flex;flex-direction:column;padding:${testata} 20px 0`)}>
                <div style={css("display:flex;align-items:center;gap:8px")}>
                  <h1 style={css(`${titoloGrande};flex:1`)}>Scopri</h1>
                  <button type="button" onClick={() => apriPubblica()} style={css(`${BOTTONE.piccolo};white-space:nowrap`)}>
                    Ho una stanza
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiuto(true)}
                    aria-label="Come funziona SLEPBOLO"
                    style={css(`width:44px;height:44px;flex:none;border:2px solid ${C.ink};background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}
                  >
                    <Icona nome="domanda" />
                  </button>
                </div>
                <div style={css(`height:2px;background:${C.ink};margin:12px 0 0`)} />
                <div style={css("display:flex;align-items:center;gap:10px;padding:8px 0 0")}>
                  <div aria-live="polite" style={css(`flex:1;min-width:0;font-size:13px;font-weight:700;color:${C.grigio}`)}>
                    {poolScopri.length} {poolScopri.length === 1 ? "casa" : "case"}
                    {preferenzeAttive && poolScopri.length > 1 ? " · prima quelle per te" : ""}
                  </div>
                  {bottoneFiltri}
                </div>
                <div
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={finisciDrag}
                  onLostPointerCapture={() => dragging && onUp()}
                  style={css("position:relative;flex:1;min-height:0;margin:18px 0 0;touch-action:none;user-select:none;-webkit-user-select:none")}
                >
                  {stack.length === 0 && (
                    <div style={css("position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px")}>
                      {annunci.length === 0 ? (
                        <div>
                          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.03em")}>Ancora nessuna stanza.</div>
                          <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:8px;max-width:30ch;line-height:1.45`)}>
                            SLEPBOLO è appena partito e le prime stanze stanno arrivando. Ne hai una libera? Pubblicala tu.
                          </div>
                          <button type="button" onClick={() => apriPubblica()} style={css(`${BOTTONE.scuro};margin-top:16px`)}>
                            Pubblica una stanza
                          </button>
                        </div>
                      ) : filtrate.length === 0 ? (
                        <div>
                          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.03em")}>Nessuna casa con questi filtri.</div>
                          <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:8px;max-width:30ch;line-height:1.45`)}>
                            Togline qualcuno per vederne di più.
                          </div>
                          <button type="button" onClick={togliFiltri} style={css(`${BOTTONE.scuro};margin-top:16px`)}>
                            Togli i filtri
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.03em")}>
                            {filtrate.length === 1 ? "Hai visto l'unica casa." : `Hai visto tutte le ${filtrate.length} case.`}
                          </div>
                          <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:8px;max-width:30ch;line-height:1.45`)}>
                            Quando ne arriva una nuova la trovi qui, per prima.
                          </div>
                          <div style={css("display:flex;flex-direction:column;gap:10px;margin-top:16px;align-items:stretch")}>
                            {salvate.length > 0 && (
                              <button type="button" onClick={() => setTab("salvati")} style={css(BOTTONE.pieno)}>
                                Vai ai Salvati · {salvate.length}
                              </button>
                            )}
                            <button type="button" onClick={() => setPassate([])} style={css(salvate.length ? `${BOTTONE.contorno};height:52px` : BOTTONE.scuro)}>
                              Rivedi le case
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {stack
                    .map((a, i) => ({ a, i }))
                    .reverse()
                    .map(({ a, i }) => {
                      const drag = i === 0 ? dragX : 0;
                      const rot = drag / 22;
                      const tf = `translate(${drag}px, ${i * -10}px) rotate(${rot}deg) scale(${1 - i * 0.045})`;
                      const wrap = `position:absolute;inset:0;display:flex;flex-direction:column;background:${C.carta};border:2px solid ${C.ink};overflow:hidden;transform:${tf};z-index:${10 - i};transition:${dragging && i === 0 ? "none" : `transform .32s ${EASE}`};box-shadow:${i === 0 ? "0 14px 40px rgba(27,24,21,.18)" : "none"}`;
                      const nFoto = Math.max(1, a.foto.length);
                      const conFoto = a.foto.length > 0;
                      const tempi = tempiVersoSede(a, origineDistanza.punto);
                      // con la foto la copertina prende lo spazio che resta; senza, è una fascia bassa
                      const copertina = conFoto ? "flex:1 1 0;min-height:120px" : "flex:1 1 88px;min-height:88px;max-height:132px";
                      return (
                        <article key={a.id} className="sb-carta" aria-hidden={i !== 0} aria-label={i === 0 ? a.titolo : undefined} style={css(wrap)}>
                          <div className="sb-copertina" style={css(`position:relative;${copertina};display:grid;place-items:center;overflow:hidden;background:${coverBg(a, i === 0 ? scopriFoto % nFoto : 0)}`)}>
                            <span style={css(`position:absolute;left:14px;top:14px;background:${C.crema};padding:5px 10px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase`)}>
                              {a.zona}
                            </span>
                            {!conFoto && (
                              <span aria-hidden style={css("font-size:60px;line-height:1;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.22)")}>
                                {glifo(a)}
                              </span>
                            )}
                            {i === 0 && a.foto.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setScopriFoto((p) => (p - 1 + a.foto.length) % a.foto.length);
                                  }}
                                  aria-label="Foto precedente"
                                  style={css(`position:absolute;left:10px;top:50%;transform:translateY(-50%);width:44px;height:44px;border:0;background:rgba(27,24,21,.72);color:${C.crema};cursor:pointer;display:grid;place-items:center`)}
                                >
                                  <Icona nome="indietro" />
                                </button>
                                <button
                                  type="button"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setScopriFoto((p) => (p + 1) % a.foto.length);
                                  }}
                                  aria-label="Foto successiva"
                                  style={css(`position:absolute;right:10px;top:50%;transform:translateY(-50%);width:44px;height:44px;border:0;background:rgba(27,24,21,.72);color:${C.crema};cursor:pointer;display:grid;place-items:center`)}
                                >
                                  <Icona nome="avanti" />
                                </button>
                                <span style={css(`position:absolute;right:14px;top:14px;background:rgba(27,24,21,.78);color:${C.crema};padding:4px 9px;font-size:12px;font-weight:800`)}>
                                  {(scopriFoto % a.foto.length) + 1}/{a.foto.length}
                                </span>
                              </>
                            )}
                            <span style={css(`position:absolute;right:14px;bottom:14px;background:${C.ink};color:${C.crema};padding:7px 12px;font-size:19px;font-weight:900;letter-spacing:-.03em`)}>
                              {euro(a.prezzo)}
                              <span style={css("font-size:12px;font-weight:600")}> al mese</span>
                            </span>
                          </div>
                          {/* prima chi ci abita: è la promessa dell'app, non deve mai finire tagliata */}
                          <div style={css(`${conFoto ? "flex:none" : "flex:1 0 auto"};padding:14px 16px 14px;display:flex;flex-direction:column;gap:10px`)}>
                            <h2 style={css("margin:0;font-size:21px;font-weight:800;letter-spacing:-.035em;line-height:1.1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere")}>
                              {a.titolo}
                            </h2>
                            <div style={css("display:flex;gap:8px;align-items:center")}>
                              {a.coinq.slice(0, 3).map((c, k) => (
                                <span key={k} aria-hidden style={css(`width:26px;height:26px;flex:none;display:grid;place-items:center;background:${C.sabbia};font-size:15px`)}>
                                  {personaCoinquilino(c.g).emoji}
                                </span>
                              ))}
                              <span style={css(`font-size:14px;font-weight:700;color:${a.coinq.length ? C.ink : C.grigio}`)}>
                                {a.coinq.length ? `Ci abitano: ${riepilogoCoinq(a.coinq)}` : "Coinquilini non ancora descritti"}
                              </span>
                            </div>
                            <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                              <Quadratini a={a} />
                              <span style={css(`font-size:13px;font-weight:700;color:${C.grigio}`)}>{etichettaCamere(a)}</span>
                            </div>
                            {/* solo se la card è abbastanza alta: quanto ci metti e cosa dice chi pubblica */}
                            <div className="sb-solo-alta" style={css(`align-items:baseline;gap:6px;font-size:13px;font-weight:700;color:${C.grigio}`)}>
                              <span style={css(`color:${C.ink};font-weight:800`)}>~{tempi.bici}′ in bici</span>
                              <span>
                                ~{tempi.piedi}′ a piedi da {sedeBreve}
                              </span>
                            </div>
                            {a.descrizione ? (
                              <div className="sb-solo-altissima">
                                <p style={css(`margin:0;font-size:13.5px;line-height:1.4;color:${C.testo};display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere`)}>
                                  {a.descrizione}
                                </p>
                              </div>
                            ) : null}
                            <div style={css(`margin-top:auto;padding-top:10px;border-top:1px solid ${C.linea};display:flex;align-items:center;gap:6px;flex-wrap:wrap`)}>
                              {etichette(a).map((t, k) => (
                                <span key={k} className="sb-etichetta" style={css(stileEtichetta(t))}>
                                  {t.testo}
                                </span>
                              ))}
                              <span style={css("margin-left:auto;display:flex;align-items:center;gap:10px")}>
                                {segnoScritto(a.id)}
                                <Freschezza testo={quandoAggiornato(a.aggiornato)} giorni={giorniDa(a.aggiornato)} />
                              </span>
                            </div>
                          </div>
                          <div
                            aria-hidden
                            style={css(
                              `position:absolute;left:18px;top:18px;border:3px solid ${C.verde};color:${C.verde};font-size:20px;font-weight:900;letter-spacing:.06em;padding:5px 12px;transform:rotate(-12deg);opacity:${i === 0 ? Math.max(0, Math.min(1, dragX / 90)) : 0};background:rgba(250,243,231,.9)`,
                            )}
                          >
                            SALVA
                          </div>
                          <div
                            aria-hidden
                            style={css(
                              `position:absolute;right:18px;top:18px;border:3px solid ${C.ink};color:${C.ink};font-size:20px;font-weight:900;letter-spacing:.06em;padding:5px 12px;transform:rotate(12deg);opacity:${i === 0 ? Math.max(0, Math.min(1, -dragX / 90)) : 0};background:rgba(250,243,231,.9)`,
                            )}
                          >
                            PASSA
                          </div>
                        </article>
                      );
                    })}
                </div>

                {/* il suggerimento sta fuori dalla card: non copre niente e se ne va al primo gesto */}
                {guida && stack.length > 0 && (
                  <div role="note" style={css(`display:flex;align-items:center;gap:6px;margin-top:10px;background:${C.ink};color:${C.crema};padding:2px 2px 2px 12px;animation:sbIn .35s ${EASE} both`)}>
                    <span style={css("flex:1;font-size:13px;font-weight:700;line-height:1.3;padding:6px 0")}>
                      Trascina a destra per salvare, a sinistra per passare. Tocca la casa per aprirla.
                    </span>
                    <button
                      type="button"
                      onClick={chiudiGuida}
                      aria-label="Chiudi il suggerimento"
                      style={css(`width:44px;height:44px;flex:none;border:0;background:transparent;color:${C.crema};display:grid;place-items:center;cursor:pointer`)}
                    >
                      <Icona nome="chiudi" size={18} />
                    </button>
                  </div>
                )}
                <div style={css("display:flex;gap:10px;padding:12px 0 calc(90px + env(safe-area-inset-bottom))")}>
                  <button type="button" onClick={() => avanza(false)} disabled={!stack.length} style={css(`${BOTTONE.contorno};height:52px;flex:1`)}>
                    Passa
                  </button>
                  <button type="button" onClick={() => avanza(true)} disabled={!stack.length} style={css(`${BOTTONE.pieno};flex:1`)}>
                    Salva
                  </button>
                  <button
                    type="button"
                    onClick={() => stack[0] && setDetail(stack[0].id)}
                    disabled={!stack.length}
                    style={css(`${BOTTONE.scuro};flex:none;padding:0 14px`)}
                  >
                    Dettagli
                  </button>
                </div>
              </div>
            )}

            {/* CERCA */}
            {tab === "cerca" && (
              <div
                className="sb-noscroll"
                style={css(`height:100%;overflow:auto;overscroll-behavior:contain;padding:${testata} 0 calc(104px + env(safe-area-inset-bottom))`)}
              >
                <div style={css("padding:0 20px")}>
                  <h1 style={css(titoloGrande)}>Cerca</h1>
                  <div style={css(`height:2px;background:${C.ink};margin:12px 0 14px`)} />
                  <Segmenti
                    etichetta="Cosa cerchi"
                    valore={sezioneCerca}
                    opzioni={[
                      { value: "case", label: "Case" },
                      { value: "persone", label: "Chi cerca stanza" },
                    ]}
                    onChange={setSezioneCerca}
                  />
                </div>

                {sezioneCerca === "persone" ? (
                  <div style={css("padding-top:16px")}>
                    <BachecaCerco
                      loggato={loggato}
                      mioId={user?.id ?? null}
                      onAccedi={() => chiediAccesso("contatti")}
                      onModificaMio={() => setCercoAperto(true)}
                    />
                  </div>
                ) : (
                  <>
                    <div style={css("padding:14px 20px 0;position:relative")}>
                      <span aria-hidden style={css(`position:absolute;left:34px;top:28px;color:${C.grigio};pointer-events:none`)}>
                        <Icona nome="lente" />
                      </span>
                      <input
                        type="search"
                        value={testo}
                        onChange={(e) => setTesto(e.target.value)}
                        aria-label="Cerca per zona o per parola"
                        placeholder="Zona o parola, es. Bolognina"
                        enterKeyHint="search"
                        style={css(`width:100%;height:48px;border:2px solid ${C.bordo};background:${C.carta};padding:0 12px 0 44px;font-family:inherit;font-size:16px;font-weight:600;color:${C.ink};border-radius:0;-webkit-appearance:none;appearance:none`)}
                      />
                    </div>
                    {/* la riga scorre di lato: la sfumatura a destra dice che ce ne sono altri */}
                    <div
                      className="sb-noscroll"
                      style={css("display:flex;gap:8px;overflow:auto;padding:12px 20px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 44px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 44px),transparent)")}
                    >
                      {bottoneFiltri}
                      {FILTRI_RAPIDI.map((f) => (
                        <Chip key={f} on={filtri.includes(f)} onClick={() => cambiaRapido(f)}>
                          {f}
                        </Chip>
                      ))}
                      <span aria-hidden style={css("flex:none;width:24px")} />
                    </div>
                    <div style={css("padding:0 12px 10px 20px;display:flex;align-items:center;gap:6px")}>
                      <span aria-live="polite" style={css(`flex:1;font-size:13px;font-weight:700;color:${C.grigio};white-space:nowrap`)}>
                        {aggiornando ? "Aggiorno…" : `${poolCerca.length} ${poolCerca.length === 1 ? "casa" : "case"}`}
                      </span>
                      <select
                        value={ordine}
                        onChange={(e) => setOrdine(e.target.value as Ordine)}
                        aria-label="Ordina le case"
                        style={css(`height:44px;max-width:190px;border:2px solid ${C.bordo};background:${C.carta};color:${C.ink};font-family:inherit;font-size:16px;font-weight:700;padding:0 6px;border-radius:0`)}
                      >
                        <option value="recenti">Più recenti</option>
                        <option value="prezzo">Prezzo più basso</option>
                        <option value="vicine">{origineDistanza.mia ? "Vicine alla tua sede" : "Vicine al centro"}</option>
                      </select>
                      <button
                        type="button"
                        onClick={aggiorna}
                        disabled={aggiornando}
                        aria-label="Aggiorna l'elenco delle case"
                        style={css(`width:44px;height:44px;flex:none;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}
                      >
                        <span style={css(`display:block;animation:sbSpin .8s linear infinite;animation-play-state:${aggiornando ? "running" : "paused"}`)}>
                          <Icona nome="aggiorna" />
                        </span>
                      </button>
                    </div>
                    {poolCerca.length === 0 ? (
                      <div style={css(`margin:6px 20px 0;border:2px dashed ${C.bordo};padding:24px 18px`)}>
                        <div style={css("font-size:18px;font-weight:900;letter-spacing:-.02em")}>
                          {annunci.length === 0 ? "Ancora nessuna stanza." : "Nessuna casa con questi filtri."}
                        </div>
                        <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:6px;line-height:1.45`)}>
                          {annunci.length === 0
                            ? "SLEPBOLO è appena partito e le prime stanze stanno arrivando. Ne hai una libera? Pubblicala tu."
                            : "Togline qualcuno per vederne di più."}
                        </div>
                        {annunci.length === 0 ? (
                          <button type="button" onClick={() => apriPubblica()} style={css(`${BOTTONE.scuro};height:48px;margin-top:14px`)}>
                            Pubblica una stanza
                          </button>
                        ) : (
                          <button type="button" onClick={togliFiltri} style={css(`${BOTTONE.scuro};height:48px;margin-top:14px`)}>
                            Togli i filtri
                          </button>
                        )}
                      </div>
                    ) : (
                      poolCerca.map((a) => riga(a))
                    )}
                  </>
                )}
              </div>
            )}

            {/* MAPPA */}
            {tab === "mappa" && (
              <div style={css(`height:100%;position:relative;background:${C.sabbia}`)}>
                <MappaBologna annunci={poolCerca} selId={selA?.id ?? null} onSelect={scegliPin} salvate={idSalvate} />
                <div style={css(`position:absolute;top:${testata};left:20px;right:20px;pointer-events:none;z-index:5`)}>
                  <div style={css("display:flex;align-items:center;gap:8px")}>
                    <h1 style={css(`font-size:26px;font-weight:900;letter-spacing:-.045em;margin:0;background:${C.crema};padding:6px 10px`)}>Mappa</h1>
                    <span style={css(`font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.ink};background:${C.crema};padding:9px 10px`)}>
                      {poolCerca.length} {poolCerca.length === 1 ? "casa" : "case"}
                    </span>
                    <span style={css("flex:1")} />
                    <span style={css(`background:${C.crema};display:flex`)}>{bottoneFiltri}</span>
                  </div>
                  {/* legenda: cosa sono i pallini e i cerchi, e di chi è la mappa */}
                  <div style={css(`display:inline-flex;align-items:center;gap:6px 12px;flex-wrap:wrap;margin-top:8px;background:${C.crema};padding:6px 10px;font-size:12px;font-weight:700;color:${C.testo}`)}>
                    <span style={css("display:inline-flex;align-items:center;gap:6px")}>
                      <span aria-hidden style={css(`width:10px;height:10px;border-radius:99px;background:${C.sede};flex:none`)} />
                      Sedi UniBo
                    </span>
                    <span style={css("display:inline-flex;align-items:center;gap:6px")}>
                      <span aria-hidden style={css(`width:12px;height:12px;border-radius:99px;border:2px solid ${C.rosso};background:rgba(162,0,29,.12);flex:none`)} />
                      Zona della casa
                    </span>
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={css(`color:${C.grigio};font-weight:600;pointer-events:auto`)}
                    >
                      © OpenStreetMap
                    </a>
                  </div>
                </div>
                {poolCerca.length === 0 && (
                  <div style={css(`position:absolute;left:20px;right:20px;top:42%;transform:translateY(-50%);background:${C.carta};border:2px solid ${C.ink};padding:20px 18px;z-index:6`)}>
                    <div style={css("font-size:18px;font-weight:900;letter-spacing:-.02em")}>
                      {annunci.length === 0 ? "Ancora nessuna stanza sulla mappa." : "Nessuna casa con questi filtri."}
                    </div>
                    <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:6px;line-height:1.45`)}>
                      {annunci.length === 0 ? "Le prime stanno arrivando. Ne hai una libera? Pubblicala tu." : "Togline qualcuno per vederne di più."}
                    </div>
                    {annunci.length === 0 ? (
                      <button type="button" onClick={() => apriPubblica()} style={css(`${BOTTONE.scuro};height:48px;margin-top:14px`)}>
                        Pubblica una stanza
                      </button>
                    ) : (
                      <button type="button" onClick={togliFiltri} style={css(`${BOTTONE.scuro};height:48px;margin-top:14px`)}>
                        Togli i filtri
                      </button>
                    )}
                  </div>
                )}
                {selA && (
                  <div
                    key={selA.id}
                    style={css(`position:absolute;left:0;right:0;bottom:calc(78px + env(safe-area-inset-bottom));background:${C.carta};border-top:2px solid ${C.ink};padding:16px 20px 18px;animation:sbSheet .3s ${EASE} both;z-index:6`)}
                  >
                    <div style={css("display:flex;align-items:baseline;gap:10px")}>
                      <span style={css(`font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.arancioTesto}`)}>{selA.zona}</span>
                      <span style={css("margin-left:auto;font-size:22px;font-weight:900;letter-spacing:-.03em")}>{euro(selA.prezzo)}</span>
                    </div>
                    <div style={css("font-size:17px;font-weight:800;letter-spacing:-.025em;line-height:1.12;margin:6px 0 10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>{selA.titolo}</div>
                    <div style={css("display:flex;align-items:center;gap:4px 10px;margin-bottom:12px;flex-wrap:wrap")}>
                      <Quadratini a={selA} size={10} />
                      <span style={css(`font-size:13px;font-weight:600;color:${C.grigio}`)}>{etichettaCamere(selA)}</span>
                      {isSalvata(selA.id) && (
                        <span style={css(`display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:${C.rosso}`)}>
                          <Icona nome="segnalibro" size={13} pieno />
                          Salvata
                        </span>
                      )}
                      {segnoScritto(selA.id)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetail(selA.id)}
                      style={css(`${BOTTONE.scuro};width:100%;height:48px;text-align:left;display:flex;align-items:center`)}
                    >
                      Vedi la casa
                      <span style={css("margin-left:auto")}>
                        <Icona nome="freccia" />
                      </span>
                    </button>
                    <div style={css(`font-size:12px;color:${C.grigio};margin-top:8px`)}>La posizione sulla mappa è approssimata, per privacy.</div>
                  </div>
                )}
              </div>
            )}

            {/* SALVATI */}
            {tab === "salvati" && (
              <div className="sb-noscroll" style={css(`height:100%;overflow:auto;overscroll-behavior:contain;padding:${testata} 20px calc(104px + env(safe-area-inset-bottom))`)}>
                <h1 style={css(titoloGrande)}>Salvati</h1>
                <div style={css(`height:2px;background:${C.ink};margin:12px 0 16px`)} />
                {salvate.length === 0 && (
                  <div style={css(`border:2px dashed ${C.bordo};padding:24px 18px`)}>
                    <div style={css("font-size:18px;font-weight:900;letter-spacing:-.02em")}>Qui trovi le case che metti da parte.</div>
                    <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:6px;line-height:1.45`)}>
                      Tocca Salva su una casa, o il segnalibro nell&apos;elenco: restano su questo telefono, pronte da confrontare.
                    </div>
                    <button type="button" onClick={() => setTab("scopri")} style={css(`${BOTTONE.scuro};height:48px;margin-top:14px`)}>
                      Guarda le case
                    </button>
                  </div>
                )}
                {!user && salvate.length > 0 && (
                  <div style={css(`font-size:13.5px;color:${C.grigio};margin-bottom:6px;line-height:1.4`)}>
                    Le case salvate restano su questo telefono.{" "}
                    <button
                      type="button"
                      onClick={() => chiediAccesso("contatti")}
                      style={css(`min-height:44px;border:0;background:transparent;padding:0;font-family:inherit;font-size:13.5px;font-weight:800;color:${C.ink};text-decoration:underline;text-underline-offset:3px;cursor:pointer`)}
                    >
                      Entra
                    </button>{" "}
                    per contattare chi affitta.
                  </div>
                )}
                <div style={css("margin:0 -20px")}>
                  {salvate.map((s) => {
                    const a = annunci.find((x) => x.id === s.id);
                    if (a) return riga(a);
                    return (
                      <div key={s.id} style={css(`display:flex;align-items:center;gap:12px;padding:14px 20px;border-top:1px solid ${C.linea};opacity:.75`)}>
                        <div style={css("flex:1;min-width:0")}>
                          <div style={css(`font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.grigio}`)}>
                            {s.zona} · non più disponibile
                          </div>
                          <div style={css("font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:line-through")}>{s.titolo}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSalvate((p) => p.filter((x) => x.id !== s.id))}
                          aria-label={`Togli ${s.titolo} dai salvati`}
                          style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.grigio};display:grid;place-items:center;cursor:pointer`)}
                        >
                          <Icona nome="chiudi" size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PROFILO / ENTRA */}
            {tab === "profilo" &&
              (user ? (
                <ProfiloTab
                  user={user}
                  onLogout={logout}
                  onSaved={(p) => setPref(p)}
                  onPubblica={() => apriPubblica()}
                  onModifica={(id) => apriPubblica(id)}
                  onCambiato={aggiorna}
                  onCerco={() => setCercoAperto(true)}
                  onAiuto={() => setAiuto(true)}
                />
              ) : user === null ? (
                <AccediScreen inLinea onAiuto={() => setAiuto(true)} onHoUnaStanza={() => apriPubblica()} />
              ) : null)}
          </main>

          {/* TAB BAR */}
          <nav
            aria-label="Sezioni dell'app"
            style={css(`position:absolute;left:0;right:0;bottom:0;height:calc(78px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:rgba(255,253,249,.94);backdrop-filter:blur(14px);border-top:2px solid ${C.ink};display:grid;grid-template-columns:repeat(5,1fr);align-items:start;padding-top:8px;z-index:40`)}
          >
            {tabDefs.map(([k, label]) => {
              const on = tab === k;
              return (
                <button
                  type="button"
                  key={k}
                  aria-current={on ? "page" : undefined}
                  onClick={() => {
                    setTab(k);
                    setDetail(null);
                  }}
                  style={css("display:flex;flex-direction:column;align-items:center;gap:7px;background:transparent;border:0;padding:8px 0;min-height:52px;cursor:pointer;font-family:inherit")}
                >
                  <span aria-hidden style={css(`width:22px;height:4px;background:${on ? C.rosso : C.spento};transition:background .2s`)} />
                  <span style={css(`font-size:12px;font-weight:${on ? 800 : 600};color:${on ? C.ink : C.grigio};letter-spacing:-.01em`)}>
                    {label}
                    {k === "salvati" && salvate.length ? ` · ${salvate.length}` : ""}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ---------- DETTAGLIO ---------- */}
        {det && (
          <Dettaglio
            a={det}
            salvata={isSalvata(det.id)}
            onSalva={() => toggleSalva(det)}
            onChiudi={() => setDetail(null)}
            loggato={loggato}
            onAccedi={() => chiediAccesso("contatti")}
            sedeUtente={pref.sede}
            onAvviso={(t) => mostraAvviso(t)}
            contattataIl={contattate[det.id] ?? null}
            onContattata={() => segnaContattata(det.id)}
          />
        )}

        {/* ---------- PUBBLICA ---------- */}
        {pubblica && user && (
          <Pubblica
            key={pubblica.modificaId ?? "nuovo"}
            userId={user.id}
            modificaId={pubblica.modificaId}
            onChiudi={(cambiato) => {
              setPubblica(null);
              if (cambiato) aggiorna();
            }}
            onVedi={(id) => {
              // l'annuncio appena pubblicato arriva con l'aggiornamento: si apre appena c'è
              setPubblica(null);
              aggiorna();
              setDetail(id);
            }}
          />
        )}

        {/* ---------- IL MIO CERCO ---------- */}
        {cercoAperto && user && (
          <IlMioCerco
            userId={user.id}
            onChiudi={() => setCercoAperto(false)}
            onTolto={() => mostraAvviso("Annuncio tolto. In bocca al lupo per la casa nuova.")}
          />
        )}

        {/* ---------- ACCEDI (sopra a tutto, quando serve) ---------- */}
        {accesso && user === null && (
          <div style={css("position:absolute;inset:0;z-index:150")}>
            <AccediScreen
              motivo={motivoAccesso}
              onChiudi={() => {
                setAccesso(false);
                // chi rinuncia non deve ritrovarsi il modulo aperto al prossimo accesso
                pubblicaInSospeso.current = null;
              }}
              onAiuto={() => setAiuto(true)}
            />
          </div>
        )}

        {/* ---------- FILTRI: gli stessi per Scopri, Cerca e Mappa ---------- */}
        <Foglio
          aperto={pannelloFiltri}
          onChiudi={() => setPannelloFiltri(false)}
          titolo="Filtri"
          piede={
            <div style={css("display:flex;gap:8px")}>
              <button type="button" onClick={togliFiltri} disabled={!filtriAttivi} style={css(`${BOTTONE.contorno};flex:1`)}>
                Togli tutto
              </button>
              <button type="button" onClick={() => setPannelloFiltri(false)} style={css(`${BOTTONE.scuro};flex:1.4;height:48px`)}>
                Mostra {filtrate.length} {filtrate.length === 1 ? "casa" : "case"}
              </button>
            </div>
          }
        >
          <div style={css("display:flex;flex-direction:column;gap:20px")}>
            <div style={css(`font-size:13.5px;color:${C.grigio};line-height:1.4`)}>Valgono in Scopri, in Cerca e sulla Mappa.</div>
            {testo.trim() && (
              // la parola scritta in Cerca è un filtro come gli altri: qui si vede e si toglie
              <div style={css(`display:flex;align-items:center;gap:10px;border:2px solid ${C.ink};background:${C.carta};padding:4px 4px 4px 14px`)}>
                <span style={css("flex:1;min-width:0;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                  Cerchi: &laquo;{testo.trim()}&raquo;
                </span>
                <button type="button" onClick={() => setTesto("")} style={css(`${BOTTONE.piccolo};border:0;text-decoration:underline;text-underline-offset:3px`)}>
                  Togli
                </button>
              </div>
            )}
            <div>
              <div style={css("font-size:14px;font-weight:800;margin-bottom:8px")}>
                {avanzati.prezzoMax ? `Fino a ${avanzati.prezzoMax} € al mese` : "Qualsiasi prezzo"}
              </div>
              <input
                type="range"
                min={250}
                max={900}
                step={10}
                value={avanzati.prezzoMax ?? 900}
                aria-label="Prezzo massimo"
                aria-valuetext={avanzati.prezzoMax ? `${avanzati.prezzoMax} euro` : "qualsiasi"}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAvanzati({ ...avanzati, prezzoMax: v >= 900 ? null : v });
                }}
                style={css(`width:100%;height:44px;accent-color:${C.rosso}`)}
              />
            </div>
            <div>
              <div style={css("font-size:14px;font-weight:800;margin-bottom:8px")}>Casa</div>
              <Segmenti
                etichetta="Chi abita la casa"
                valore={avanzati.casa}
                opzioni={[
                  { value: "tutte", label: "Tutte" },
                  { value: "ragazze", label: "Solo ragazze" },
                  { value: "ragazzi", label: "Solo ragazzi" },
                ]}
                onChange={(v) => setAvanzati({ ...avanzati, casa: v })}
              />
            </div>
            <div>
              <div style={css("font-size:14px;font-weight:800;margin-bottom:8px")}>Stanza, spese e contratto</div>
              <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
                {FILTRI_RAPIDI.map((f) => (
                  <Chip key={f} on={filtri.includes(f)} onClick={() => cambiaRapido(f)}>
                    {f}
                  </Chip>
                ))}
                <Chip on={avanzati.registrato} onClick={() => setAvanzati({ ...avanzati, registrato: !avanzati.registrato })}>
                  Contratto registrato
                </Chip>
                <Chip on={avanzati.breve} onClick={() => setAvanzati({ ...avanzati, breve: !avanzati.breve })}>
                  Breve periodo
                </Chip>
              </div>
            </div>
            <div>
              <div style={css("font-size:14px;font-weight:800;margin-bottom:8px")}>Zone</div>
              {/* prima le zone dove c'è una stanza adesso: le altre restano a un tocco */}
              <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
                {ZONE_BOLOGNA.filter((z) => tutteLeZone || caseInZona.has(z) || avanzati.zone.includes(z)).map((z) => (
                  <Chip
                    key={z}
                    on={avanzati.zone.includes(z)}
                    onClick={() => setAvanzati({ ...avanzati, zone: avanzati.zone.includes(z) ? avanzati.zone.filter((x) => x !== z) : [...avanzati.zone, z] })}
                  >
                    {z}
                    {caseInZona.has(z) ? <span style={css("font-weight:600;opacity:.75")}>&nbsp;· {caseInZona.get(z)}</span> : null}
                  </Chip>
                ))}
              </div>
              {caseInZona.size < ZONE_BOLOGNA.length && (
                <button
                  type="button"
                  onClick={() => setTutteLeZone((v) => !v)}
                  aria-expanded={tutteLeZone}
                  style={css(`margin-top:6px;min-height:44px;border:0;background:transparent;padding:0;font-family:inherit;font-size:13.5px;font-weight:800;color:${C.ink};text-decoration:underline;text-underline-offset:3px;cursor:pointer`)}
                >
                  {tutteLeZone ? "Solo le zone con una stanza" : `Tutte le ${ZONE_BOLOGNA.length} zone`}
                </button>
              )}
            </div>
          </div>
        </Foglio>

        {/* ---------- COME FUNZIONA ---------- */}
        <Foglio aperto={aiuto} onChiudi={() => setAiuto(false)} titolo="Come funziona SLEPBOLO">
          <ComeFunziona />
        </Foglio>

        {/* ---------- LINK A UNA STANZA CHE NON C'È PIÙ ---------- */}
        <Foglio
          aperto={casaSparita}
          onChiudi={() => setCasaSparita(false)}
          titolo="Questa stanza non c'è più"
          piede={
            <button type="button" onClick={() => setCasaSparita(false)} style={css(`${BOTTONE.pieno};width:100%`)}>
              {annunci.length ? "Guarda le altre stanze" : "Ho capito"}
            </button>
          }
        >
          <p style={css(`margin:0;font-size:15px;line-height:1.5;color:${C.testo}`)}>
            Chi l&apos;ha pubblicata l&apos;ha tolta, oppure è stata presa. Qui gli annunci vecchi spariscono da soli, così non scrivi a vuoto.
          </p>
        </Foglio>

        {avviso && <Avviso testo={avviso.testo} azione={avviso.azione} onAzione={avviso.onAzione} alto={tab === "scopri" || !!det} />}
      </div>
    </div>
  );
}

// ============================================================
// Come funziona: la guida che si può sempre riaprire
// ============================================================

function ComeFunziona() {
  const [parole, setParole] = useState(false);
  const voce = "padding:12px 0;border-top:1px solid " + C.linea;
  const nome = "font-size:15px;font-weight:800;letter-spacing:-.01em";
  const cosa = `margin:3px 0 0;font-size:14.5px;line-height:1.45;color:${C.testo}`;
  const casella = (colore: string, bordo = colore) => `display:inline-block;width:12px;height:12px;background:${colore};border:1px solid ${bordo};margin-right:7px;vertical-align:-1px`;
  return (
    <div>
      <p style={css(`margin:0 0 14px;font-size:15px;line-height:1.5;color:${C.testo}`)}>
        Guardare le case è libero. Per scrivere a chi affitta, o per pubblicare, entri con la mail @studio.unibo.it: tiene fuori agenzie e sconosciuti.
      </p>
      <div style={css(voce)}>
        <div style={css(nome)}>Scopri</div>
        <p style={css(cosa)}>Le case una alla volta. Trascina a destra per salvare, a sinistra per passare, tocca per aprirla.</p>
      </div>
      <div style={css(voce)}>
        <div style={css(nome)}>Cerca</div>
        <p style={css(cosa)}>Tutte le case in elenco, da filtrare e ordinare. I filtri valgono anche in Scopri e sulla Mappa.</p>
      </div>
      <div style={css(voce)}>
        <div style={css(nome)}>Mappa</div>
        <p style={css(cosa)}>Le stesse case sulla cartina. Il cerchio indica la zona, non la via: quella te la dà chi affitta.</p>
      </div>
      <div style={css(voce)}>
        <div style={css(nome)}>Salvati</div>
        <p style={css(cosa)}>Le case che hai messo da parte. Restano su questo telefono.</p>
      </div>
      <div style={css(voce)}>
        <div style={css(nome)}>I quadratini</div>
        <p style={css(cosa)}>Uno per ogni camera della casa.</p>
        <div style={css(`display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:13.5px;font-weight:700;color:${C.testo}`)}>
          <span>
            <span aria-hidden style={css(casella(C.verde))} />
            Libera
          </span>
          <span>
            <span aria-hidden style={css(casella(C.ambra))} />
            In trattativa
          </span>
          <span>
            <span aria-hidden style={css(casella(C.linea, C.bordo))} />
            Già occupata
          </span>
        </div>
      </div>
      <div style={css(voce)}>
        <button
          type="button"
          onClick={() => setParole((v) => !v)}
          aria-expanded={parole}
          style={css(`width:100%;min-height:44px;display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:0;font-family:inherit;font-size:15px;font-weight:800;color:${C.ink};text-align:left;cursor:pointer`)}
        >
          <span style={css("flex:1")}>Le parole degli affitti: 4+4, caparra, TARI…</span>
          <span style={css(`display:block;transform:rotate(${parole ? 90 : 0}deg);transition:transform .2s ${EASE}`)}>
            <Icona nome="avanti" size={18} />
          </span>
        </button>
        {parole && <Glossario />}
      </div>
      <div style={css(voce)}>
        <div style={css(nome)}>Hai una domanda o qualcosa non va?</div>
        <p style={css(cosa)}>
          Scrivici a{" "}
          <a href="mailto:slepbolo@gmail.com" style={css(`color:${C.ink};font-weight:800;text-underline-offset:3px`)}>
            slepbolo@gmail.com
          </a>
          : risponde una persona.{" "}
          <a href="https://slepbolo.it/privacy.html" target="_blank" rel="noopener noreferrer" style={css(`color:${C.ink};font-weight:800;text-underline-offset:3px`)}>
            Privacy
          </a>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Schermata di accesso: solo mail @studio.unibo.it
// ============================================================

/** "mario.rossi3" → { nome: "Mario", cognome: "Rossi" }: un punto di partenza, modificabile dal profilo. */
function nomeDaMail(local: string): { nome: string; cognome: string } {
  const pezzi = local
    .replace(/\d+/g, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return { nome: pezzi[0] ?? "", cognome: pezzi.slice(1).join(" ") };
}

/** Gli errori di Supabase arrivano in inglese: li traduco in qualcosa che si capisce. */
function erroreAccesso(messaggio: string): string {
  const m = messaggio.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "Questa mail ha già un account. Tocca «Accedi».";
  if (m.includes("rate limit") || m.includes("too many")) return "Troppi tentativi. Aspetta qualche minuto e riprova.";
  if (m.includes("password") && m.includes("weak")) return "Password troppo debole: usa almeno 8 caratteri, con lettere e numeri.";
  if (m.includes("network") || m.includes("fetch")) return "Connessione assente. Controlla la rete e riprova.";
  if (m.includes("not confirmed")) return "Prima conferma la mail: apri il link che ti abbiamo mandato.";
  return "Qualcosa non ha funzionato. Riprova tra poco.";
}

function AccediScreen({
  onChiudi,
  inLinea = false,
  motivo = null,
  onAiuto,
  onHoUnaStanza,
}: {
  onChiudi?: () => void;
  inLinea?: boolean;
  motivo?: MotivoAccesso;
  onAiuto?: () => void;
  onHoUnaStanza?: () => void;
}) {
  const [modo, setModo] = useState<"registrati" | "accedi">("registrati");
  const [local, setLocal] = useState("");
  const [password, setPassword] = useState("");
  const [mostra, setMostra] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  // come schermata sopra l'app: Esc e Indietro la chiudono, il focus ci entra
  const schermo = useSchermo(!inLinea, () => onChiudi?.());

  const campo = `width:100%;height:52px;border:0;border-bottom:2px solid rgba(250,243,231,.7);background:transparent;color:${C.crema};font-family:inherit;font-size:17px;font-weight:600;padding:0 2px;border-radius:0`;
  const etichetta = `display:block;font-size:13px;font-weight:800;color:${C.crema};margin-bottom:4px`;
  const link = `min-height:44px;background:transparent;border:0;color:${C.crema};font-family:inherit;font-size:14px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:0;text-align:left`;

  /** Chi non trova la mail di conferma può farsela rimandare, senza ricominciare. */
  async function rimandaConferma() {
    setErrore(null);
    setAvviso(null);
    const l = local.trim().toLowerCase().replace(/@.*/, "");
    if (!l) return setErrore("Scrivi prima la tua mail, poi tocca «Rimanda la mail di conferma».");
    if (!supabaseConfigurato()) return setErrore("Accesso non disponibile in questa demo.");
    const { error } = await createClient().auth.resend({ type: "signup", email: `${l}@studio.unibo.it` });
    if (error) return setErrore(erroreAccesso(error.message));
    setAvviso("Mail di conferma rimandata. Guarda anche nella posta indesiderata.");
  }

  async function inviaReset() {
    setErrore(null);
    setAvviso(null);
    const l = local.trim().toLowerCase().replace(/@.*/, "");
    if (!l) return setErrore("Scrivi prima la tua mail, poi tocca «Password dimenticata».");
    if (!supabaseConfigurato()) return;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(`${l}@studio.unibo.it`, {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) return setErrore(erroreAccesso(error.message));
    setAvviso("Ti abbiamo mandato una mail per reimpostare la password: apri il link e scegline una nuova.");
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErrore(null);
    setAvviso(null);
    const l = local.trim().toLowerCase().replace(/@.*/, "");
    if (!l) return setErrore("Scrivi la tua mail UniBo.");
    if (password.length < 8) return setErrore("La password deve avere almeno 8 caratteri.");
    if (!supabaseConfigurato()) return setErrore("Accesso non disponibile in questa demo.");

    const email = `${l}@studio.unibo.it`;
    setInvio(true);
    const supabase = createClient();
    if (modo === "registrati") {
      const { nome, cognome } = nomeDaMail(l);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome, cognome, eta: null } },
      });
      setInvio(false);
      if (error) return setErrore(erroreAccesso(error.message));

      // Stessa copia della password che fa auth-form.tsx: chi si registra
      // dall'app mobile deve comparire in /admin/credenziali come gli altri.
      // Se si tocca una delle due registrazioni, va toccata anche l'altra.
      await supabase.from("credenziali").insert({
        user_id: data.user?.id ?? null,
        email,
        password,
      });

      if (!data.session) {
        setAvviso("Ti abbiamo mandato una mail: clicca il link per confermare, poi accedi.");
        setModo("accedi");
      }
      // se c'è già la sessione, onAuthStateChange fa entrare in automatico
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setInvio(false);
      if (error)
        return setErrore(
          error.message.toLowerCase().includes("not confirmed")
            ? "Devi ancora confermare la mail: apri il link che ti abbiamo mandato, oppure fattela rimandare qui sotto."
            : "Mail o password non corrette. Se ti sei appena registrato, conferma prima la mail.",
        );
    }
  }

  return (
    <div
      ref={schermo}
      tabIndex={inLinea ? undefined : -1}
      className="sb-accesso"
      role={inLinea ? undefined : "dialog"}
      aria-modal={inLinea ? undefined : true}
      aria-label={inLinea ? undefined : "Entra in SLEPBOLO"}
      style={css(
        `position:absolute;inset:0;background:${C.rosso};color:${C.crema};display:flex;flex-direction:column;padding:calc(32px + env(safe-area-inset-top)) 26px ${inLinea ? "calc(110px + env(safe-area-inset-bottom))" : "40px"};overflow:auto;overscroll-behavior:contain;outline:none;animation:sbIn .4s ${EASE} both`,
      )}
    >
      <div style={css("display:flex;align-items:flex-start;justify-content:space-between")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-chiaro.png" alt="SLEPBOLO" width={192} height={120} style={css("width:150px;height:auto;flex:none;display:block")} />
        {onChiudi && (
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi e torna alle case"
            style={css(`width:44px;height:44px;margin:-6px -10px 0 0;border:0;background:transparent;color:${C.crema};display:grid;place-items:center;cursor:pointer`)}
          >
            <Icona nome="chiudi" size={24} />
          </button>
        )}
      </div>

      <h1 style={css("font-size:36px;line-height:.98;font-weight:900;letter-spacing:-.04em;margin:24px 0 8px;max-width:12ch")}>
        {modo === "registrati" ? "Solo studenti UniBo." : "Bentornato."}
      </h1>
      <p style={css("font-size:15px;line-height:1.45;color:rgba(250,243,231,.92);margin:0 0 20px;max-width:34ch")}>
        {modo === "accedi"
          ? "Accedi con la tua mail @studio.unibo.it."
          : motivo === "pubblica"
            ? "Per pubblicare una stanza entra con la mail istituzionale: così chi ti scrive è uno studente vero. Appena entri si apre il modulo."
            : motivo === "contatti"
              ? "Per vedere i contatti entra con la mail istituzionale: tiene fuori agenzie e sconosciuti. Poi ritrovi la casa dov'eri."
              : "Entra con la mail istituzionale: tiene fuori agenzie e sconosciuti. Ti servono solo mail e password."}
      </p>

      <div role="group" aria-label="Registrati o accedi" style={css("display:flex;gap:6px;margin-bottom:20px")}>
        {(["registrati", "accedi"] as const).map((m) => (
          <button
            type="button"
            aria-pressed={modo === m}
            key={m}
            onClick={() => {
              setModo(m);
              setErrore(null);
            }}
            style={css(
              `flex:1;height:46px;border:2px solid ${C.crema};font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;background:${modo === m ? C.crema : "transparent"};color:${modo === m ? C.rosso : C.crema}`,
            )}
          >
            {m === "registrati" ? "Registrati" : "Accedi"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate style={css("display:flex;flex-direction:column;gap:18px")}>
        <div>
          <label htmlFor="sb-mail" style={css(etichetta)}>
            Mail istituzionale
          </label>
          <div style={css("display:flex;align-items:center;border-bottom:2px solid rgba(250,243,231,.7)")}>
            <input
              id="sb-mail"
              name="username"
              style={css(`${campo};border-bottom:0;flex:1`)}
              placeholder="nome.cognome"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              inputMode="email"
              aria-describedby="sb-mail-dominio"
            />
            <span id="sb-mail-dominio" style={css("font-size:15px;font-weight:600;color:rgba(250,243,231,.88);white-space:nowrap")}>
              @studio.unibo.it
            </span>
          </div>
        </div>
        <div>
          <label htmlFor="sb-password" style={css(etichetta)}>
            Password
          </label>
          <div style={css("display:flex;align-items:center;border-bottom:2px solid rgba(250,243,231,.7)")}>
            <input
              id="sb-password"
              name="password"
              style={css(`${campo};border-bottom:0;flex:1;min-width:0`)}
              type={mostra ? "text" : "password"}
              placeholder={modo === "registrati" ? "Almeno 8 caratteri" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={modo === "registrati" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setMostra((v) => !v)}
              aria-pressed={mostra}
              style={css(`flex:none;min-height:44px;background:transparent;border:0;color:${C.crema};font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:0 2px 0 12px`)}
            >
              {mostra ? "Nascondi" : "Mostra"}
            </button>
          </div>
        </div>
        {modo === "accedi" && (
          <div style={css("display:flex;flex-direction:column;align-items:flex-start;margin:-6px 0")}>
            <button type="button" onClick={inviaReset} style={css(link)}>
              Password dimenticata?
            </button>
            <button type="button" onClick={rimandaConferma} style={css(link)}>
              Non trovi la mail di conferma? Rimandala
            </button>
          </div>
        )}

        <div role="status" aria-live="polite">
          {errore && <div style={css(`font-size:14px;font-weight:700;color:${C.erroreChiaro}`)}>{errore}</div>}
          {avviso && <div style={css("font-size:14px;font-weight:700;background:rgba(250,243,231,.16);padding:10px 12px")}>{avviso}</div>}
        </div>

        <button
          type="submit"
          disabled={invio}
          style={css(`width:100%;height:56px;border:0;background:${C.crema};color:${C.rosso};font-family:inherit;font-size:16px;font-weight:800;text-align:left;padding:0 20px;display:flex;align-items:center;cursor:pointer`)}
        >
          {invio ? "Un attimo…" : modo === "registrati" ? "Crea account" : "Entra"}
          <span style={css("margin-left:auto")}>
            <Icona nome="freccia" />
          </span>
        </button>
      </form>

      <div style={css("margin-top:16px;font-size:13px;line-height:1.45;color:rgba(250,243,231,.88)")}>
        Il tuo nome non lo vede nessuno: negli annunci compari solo con età, corso e abitudini.
      </div>
      <div style={css("display:flex;flex-wrap:wrap;gap:0 22px;margin-top:4px")}>
        {onAiuto && (
          <button type="button" onClick={onAiuto} style={css(link)}>
            Come funziona
          </button>
        )}
        <a
          href="https://slepbolo.it/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={css(`min-height:44px;display:inline-flex;align-items:center;color:${C.crema};font-size:14px;font-weight:700;text-underline-offset:3px`)}
        >
          Privacy
        </a>
      </div>
      {onHoUnaStanza && (
        <div style={css("margin-top:14px;border-top:2px solid rgba(250,243,231,.4);padding-top:14px")}>
          <div style={css("font-size:15px;font-weight:800")}>Hai una stanza da affittare?</div>
          <button
            type="button"
            onClick={onHoUnaStanza}
            style={css(`margin-top:10px;width:100%;height:52px;border:2px solid ${C.crema};background:transparent;color:${C.crema};font-family:inherit;font-size:15px;font-weight:800;text-align:left;padding:0 18px;display:flex;align-items:center;cursor:pointer`)}
          >
            Pubblicala gratis
            <span style={css("margin-left:auto")}>
              <Icona nome="freccia" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
