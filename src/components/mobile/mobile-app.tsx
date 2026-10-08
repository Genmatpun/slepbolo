"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { SEDI_UNIBO, ZONE_BOLOGNA, haversineKm, personaCoinquilino } from "@/lib/constants";
import { leggiProvenienza } from "@/lib/provenienza";
import { giorniDa, quandoAggiornato } from "@/lib/types";
import type { MobileAnnuncio } from "@/lib/annuncio-mobile";
import { MappaBologna } from "./mappa-bologna";
import { BOTTONE, C, EASE, TOKENS_CSS, css, euro } from "./stile";
import { Avviso, Chip, Foglio, Freschezza, Icona, Segmenti } from "./ui";
import { Quadratini, etichettaCamere, etichettaGenereCasa, riepilogoCoinq } from "./pezzi";
import { Dettaglio, sfondoCasa } from "./dettaglio";
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
  const [tab, setTab] = useState<Tab>("scopri");
  const [detail, setDetail] = useState<string | null>(null);
  const [pubblica, setPubblica] = useState<{ modificaId: string | null } | null>(null);
  const [cercoAperto, setCercoAperto] = useState(false);
  const [pref, setPref] = useState<Preferenze>({ budget: null, zone: [], sede: null });
  const [avviso, setAvviso] = useState<{ testo: string; azione?: string; onAzione?: () => void } | null>(null);
  const timerAvviso = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scopri
  const [passate, setPassate] = useState<string[]>([]);
  const [scopriFoto, setScopriFoto] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [guida, setGuida] = useState(false);
  const sx = useRef(0);

  // Salvati
  const [salvate, setSalvate] = useState<Salvata[]>([]);

  // Cerca
  const [sezioneCerca, setSezioneCerca] = useState<"case" | "persone">("case");
  const [filtri, setFiltri] = useState<FiltroRapido[]>([]);
  const [avanzati, setAvanzati] = useState<FiltriAvanzati>(FILTRI_VUOTI);
  const [ordine, setOrdine] = useState<Ordine>("recenti");
  const [pannelloFiltri, setPannelloFiltri] = useState(false);
  const [pull, setPull] = useState(0);
  const py = useRef<number | null>(null);
  const ps = useRef(0);

  // Mappa
  const [selPin, setSelPin] = useState(0);

  const mostraAvviso = useCallback((testo: string, azione?: string, onAzione?: () => void) => {
    if (timerAvviso.current) clearTimeout(timerAvviso.current);
    setAvviso({ testo, azione, onAzione });
    timerAvviso.current = setTimeout(() => setAvviso(null), azione ? 5000 : 2800);
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

  // ---- Scopri: le case già viste restano viste per tutta la sessione ----
  useEffect(() => {
    setPassate(leggiJSON<string[]>("slepbolo-passate", "session", []));
    setGuida(!leggiJSON<boolean>("slepbolo-guida-vista", "local", false));
  }, []);
  useEffect(() => {
    scriviJSON("slepbolo-passate", "session", passate);
  }, [passate]);

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
    else mostraAvviso("Questa casa non è più disponibile. Guarda le altre.");
  }, [casaIniziale, annunci, mostraAvviso]);

  // ---- link /app?pubblica=1 o ?modifica=<id>: serve l'accesso, poi si apre il modulo ----
  const pubblicaInSospeso = useRef(pubblicaIniziale);
  useEffect(() => {
    if (!pubblicaInSospeso.current || user === undefined) return;
    if (user === null) {
      setAccesso(true);
      return;
    }
    setPubblica(pubblicaInSospeso.current);
    pubblicaInSospeso.current = null;
  }, [user]);

  async function logout() {
    if (supabaseConfigurato()) await createClient().auth.signOut();
    setUser(null);
    setTab("scopri");
  }

  // ---- pool di case ----
  const poolScopri = useMemo(
    () =>
      annunci.filter(
        (a) =>
          !passate.includes(a.id) &&
          (!pref.budget || a.prezzo <= pref.budget) &&
          (!pref.zone.length || pref.zone.includes(a.zona)),
      ),
    [annunci, passate, pref],
  );
  const preferenzeAttive = !!pref.budget || pref.zone.length > 0;

  const origineDistanza = useMemo(() => {
    const s = pref.sede ? SEDI_UNIBO.find((x) => x.nome === pref.sede || x.key === pref.sede) : undefined;
    return s ? { punto: { lat: s.lat, lng: s.lng }, nome: s.nome } : { punto: ZAMBONI, nome: "Zamboni" };
  }, [pref.sede]);

  const oggi = new Date().toISOString().slice(0, 10);
  const poolCerca = useMemo(() => {
    const filtrate = annunci.filter((a) => {
      if (filtri.includes("Sotto 400 €") && a.prezzo >= 400) return false;
      if (filtri.includes("Spese incluse") && !a.speseIncl) return false;
      if (filtri.includes("Singola") && !a.stanze.some((s) => s.stato !== "occupata" && s.tipo === "Singola")) return false;
      if (filtri.includes("Libera subito") && !(a.dal && a.dal <= oggi)) return false;
      if (avanzati.prezzoMax && a.prezzo > avanzati.prezzoMax) return false;
      if (avanzati.zone.length && !avanzati.zone.includes(a.zona)) return false;
      if (avanzati.casa !== "tutte" && a.genere !== avanzati.casa) return false;
      if (avanzati.registrato && !a.registrato) return false;
      if (avanzati.breve && a.min > 3) return false;
      return true;
    });
    const per = [...filtrate];
    if (ordine === "prezzo") per.sort((x, y) => x.prezzo - y.prezzo);
    else if (ordine === "vicine") per.sort((x, y) => haversineKm(x, origineDistanza.punto) - haversineKm(y, origineDistanza.punto));
    else per.sort((x, y) => giorniDa(x.aggiornato) - giorniDa(y.aggiornato) || x.prezzo - y.prezzo);
    return per;
  }, [annunci, filtri, avanzati, ordine, origineDistanza, oggi]);

  const nAvanzati =
    (avanzati.prezzoMax ? 1 : 0) + (avanzati.zone.length ? 1 : 0) + (avanzati.casa !== "tutte" ? 1 : 0) + (avanzati.registrato ? 1 : 0) + (avanzati.breve ? 1 : 0);
  const filtriAttivi = filtri.length + nAvanzati;
  const togliFiltri = () => {
    setFiltri([]);
    setAvanzati(FILTRI_VUOTI);
  };

  const det = detail ? annunci.find((a) => a.id === detail) ?? null : null;

  // ---- swipe ----
  const onDown = (e: React.PointerEvent) => {
    sx.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging) setDragX(e.clientX - sx.current);
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
    mostraAvviso(salva ? "Salvata" : "Passata", "Annulla", () => {
      setPassate((p) => p.filter((x) => x !== a.id));
      if (salva && !giaSalvata) setSalvate((p) => p.filter((s) => s.id !== a.id));
      setAvviso(null);
    });
  };
  const onUp = () => {
    if (dragX > 95) avanza(true);
    else if (dragX < -95) avanza(false);
    else finisciDrag();
  };

  function chiudiGuida() {
    setGuida(false);
    scriviJSON("slepbolo-guida-vista", "local", true);
  }

  // ---- tira per aggiornare (Cerca) ----
  const pullDown = (e: React.PointerEvent) => {
    py.current = e.clientY;
    ps.current = (e.currentTarget as HTMLElement).scrollTop;
  };
  const pullMove = (e: React.PointerEvent) => {
    if (py.current == null || ps.current > 0 || aggiornando) return;
    const d = e.clientY - py.current;
    if (d > 0) setPull(Math.min(d * 0.55, 78));
  };
  const pullUp = () => {
    py.current = null;
    if (pull > 46) aggiorna();
    setPull(0);
  };

  const selA = poolCerca[Math.min(selPin, Math.max(0, poolCerca.length - 1))];
  const scegliPin = useCallback((i: number) => setSelPin(i), []);

  const apriPubblica = (modificaId: string | null = null) => {
    if (!user) return setAccesso(true);
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

  const riga = (a: MobileAnnuncio) => (
    <button
      type="button"
      key={a.id}
      onClick={() => setDetail(a.id)}
      style={css(`width:100%;display:flex;gap:13px;padding:14px 20px;border:0;border-top:1px solid ${C.linea};cursor:pointer;background:transparent;font-family:inherit;text-align:left;color:${C.ink}`)}
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
          <span style={css("margin-left:auto;font-size:18px;font-weight:900;letter-spacing:-.03em")}>{euro(a.prezzo)}</span>
        </div>
        <div style={css("font-size:15px;font-weight:700;letter-spacing:-.02em;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
          {a.titolo}
        </div>
        <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
          <Quadratini a={a} size={10} />
          <span style={css(`font-size:12.5px;font-weight:600;color:${C.grigio}`)}>{etichettaCamere(a)}</span>
        </div>
        <Freschezza testo={quandoAggiornato(a.aggiornato)} giorni={giorniDa(a.aggiornato)} />
      </div>
    </button>
  );

  const tabDefs: [Tab, string][] = [
    ["scopri", "Scopri"],
    ["cerca", "Cerca"],
    ["mappa", "Mappa"],
    ["salvati", "Salvati"],
    ["profilo", user ? "Profilo" : "Entra"],
  ];

  const stack = poolScopri.slice(0, 3);
  const titoloGrande = "font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1";
  const testata = "calc(56px + env(safe-area-inset-top))";

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
        <div style={css("position:absolute;inset:0;display:flex;flex-direction:column")}>
          <main key={tab} style={css(`flex:1;overflow:hidden;position:relative;animation:sbFade .25s ${EASE} both`)}>
            {/* SCOPRI */}
            {tab === "scopri" && (
              <div style={css(`height:100%;display:flex;flex-direction:column;padding:${testata} 20px 0`)}>
                <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:12px")}>
                  <h1 style={css(titoloGrande)}>Scopri</h1>
                  <div style={css(`font-size:13px;font-weight:700;color:${C.grigio};padding-bottom:4px;text-align:right`)}>
                    {poolScopri.length} {poolScopri.length === 1 ? "casa" : "case"}
                    {preferenzeAttive ? " · sulle tue preferenze" : ""}
                  </div>
                </div>
                <div style={css(`height:2px;background:${C.ink};margin:12px 0 0`)} />
                <div
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={finisciDrag}
                  onLostPointerCapture={() => dragging && onUp()}
                  style={css("position:relative;flex:1;margin:18px 0 0;touch-action:none")}
                >
                  {stack.length === 0 && (
                    <div style={css("position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px")}>
                      {annunci.length === 0 ? (
                        <div>
                          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.03em")}>Nessuna casa, per ora.</div>
                          <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:8px;max-width:28ch;line-height:1.45`)}>
                            Le stanze arrivano ogni giorno. Hai una stanza libera? Sii il primo a pubblicarla.
                          </div>
                          <button type="button" onClick={() => apriPubblica()} style={css(`${BOTTONE.scuro};margin-top:16px`)}>
                            Pubblica una stanza
                          </button>
                        </div>
                      ) : passate.length === 0 && preferenzeAttive ? (
                        <div>
                          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.03em")}>Nessuna casa con le tue preferenze.</div>
                          <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:8px;max-width:28ch;line-height:1.45`)}>
                            Allarga budget o zone nel Profilo, oppure guardale tutte in Cerca.
                          </div>
                          <button type="button" onClick={() => setTab("cerca")} style={css(`${BOTTONE.scuro};margin-top:16px`)}>
                            Vai a Cerca
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.03em")}>Hai visto tutto.</div>
                          <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:8px`)}>Le case salvate sono in Salvati.</div>
                          <button type="button" onClick={() => setPassate([])} style={css(`${BOTTONE.scuro};margin-top:16px`)}>
                            Rivedi le case
                          </button>
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
                      return (
                        <article key={a.id} aria-hidden={i !== 0} aria-label={i === 0 ? a.titolo : undefined} style={css(wrap)}>
                          <div style={css(`position:relative;height:210px;flex:none;display:grid;place-items:center;background:${coverBg(a, i === 0 ? scopriFoto % nFoto : 0)}`)}>
                            <span style={css(`position:absolute;left:14px;top:14px;background:${C.crema};padding:5px 10px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase`)}>
                              {a.zona}
                            </span>
                            {!a.foto.length && (
                              <span aria-hidden style={css("font-size:74px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.22)")}>
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
                          <div style={css("padding:16px 16px 18px;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0")}>
                            <h2 style={css("margin:0;font-size:21px;font-weight:800;letter-spacing:-.035em;line-height:1.08")}>{a.titolo}</h2>
                            <div style={css("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                              <Quadratini a={a} />
                              <span style={css(`font-size:13px;font-weight:700;color:${C.grigio}`)}>{etichettaCamere(a)}</span>
                            </div>
                            <div style={css(`height:1px;background:${C.linea}`)} />
                            <div style={css("display:flex;gap:8px;align-items:center")}>
                              {a.coinq.slice(0, 3).map((c, k) => (
                                <span key={k} aria-hidden style={css(`width:26px;height:26px;flex:none;display:grid;place-items:center;background:${C.sabbia};font-size:15px`)}>
                                  {personaCoinquilino(c.g).emoji}
                                </span>
                              ))}
                              <span style={css(`font-size:13px;color:${C.grigio};font-weight:600`)}>
                                {a.coinq.length ? riepilogoCoinq(a.coinq) : "Coinquilini non ancora descritti"}
                              </span>
                            </div>
                            <div style={css("margin-top:auto;display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap")}>
                              {etichette(a).map((t, k) => (
                                <span key={k} style={css(stileEtichetta(t))}>
                                  {t.testo}
                                </span>
                              ))}
                              <span style={css("margin-left:auto")}>
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
                              `position:absolute;right:18px;top:18px;border:3px solid ${C.rosso};color:${C.rosso};font-size:20px;font-weight:900;letter-spacing:.06em;padding:5px 12px;transform:rotate(12deg);opacity:${i === 0 ? Math.max(0, Math.min(1, -dragX / 90)) : 0};background:rgba(250,243,231,.9)`,
                            )}
                          >
                            PASSA
                          </div>
                        </article>
                      );
                    })}

                  {guida && stack.length > 0 && (
                    <div
                      role="note"
                      onPointerDown={(e) => e.stopPropagation()}
                      style={css(`position:absolute;left:12px;right:12px;bottom:12px;z-index:30;background:${C.ink};color:${C.crema};padding:16px;animation:sbIn .35s ${EASE} both`)}
                    >
                      <div style={css("font-size:16px;font-weight:900;letter-spacing:-.02em")}>Come funziona</div>
                      <p style={css("margin:6px 0 12px;font-size:14px;line-height:1.45;color:rgba(250,243,231,.88)")}>
                        Trascina la casa a destra per salvarla, a sinistra per passare: puoi sempre annullare. Di ogni casa vedi chi ci abita già. Guardare è libero; per contattare chi affitta serve la mail UniBo.
                      </p>
                      <button type="button" onClick={chiudiGuida} style={css(`min-height:44px;border:2px solid ${C.crema};background:transparent;color:${C.crema};font-family:inherit;font-size:14px;font-weight:800;padding:0 16px;cursor:pointer`)}>
                        Ho capito
                      </button>
                    </div>
                  )}
                </div>
                <div style={css("display:flex;gap:10px;padding:14px 0 96px")}>
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
                    aria-label="Apri i dettagli della casa"
                    style={css(`${BOTTONE.scuro};width:52px;padding:0;display:grid;place-items:center`)}
                  >
                    <Icona nome="freccia" />
                  </button>
                </div>
              </div>
            )}

            {/* CERCA */}
            {tab === "cerca" && (
              <div
                onPointerDown={sezioneCerca === "case" ? pullDown : undefined}
                onPointerMove={sezioneCerca === "case" ? pullMove : undefined}
                onPointerUp={sezioneCerca === "case" ? pullUp : undefined}
                onPointerCancel={sezioneCerca === "case" ? pullUp : undefined}
                className="sb-noscroll"
                style={css(`height:100%;overflow:auto;padding:${testata} 0 104px;touch-action:pan-y`)}
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
                      onAccedi={() => setAccesso(true)}
                      onModificaMio={() => setCercoAperto(true)}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      aria-live="polite"
                      style={css(
                        // l'altezza segue il dito: niente animazione sull'altezza, solo la comparsa sfuma
                        `display:flex;align-items:center;justify-content:center;gap:9px;height:${aggiornando ? 44 : pull}px;overflow:hidden;opacity:${aggiornando || pull > 8 ? 1 : 0};transition:opacity .2s ${EASE}`,
                      )}
                    >
                      <span
                        style={css(
                          `width:14px;height:14px;border:2px solid ${C.linea};border-top-color:${C.rosso};border-radius:99px;display:block;animation:sbSpin .8s linear infinite;animation-play-state:${aggiornando ? "running" : "paused"}`,
                        )}
                      />
                      <span style={css(`font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${C.grigio}`)}>
                        {aggiornando ? "Aggiorno…" : pull > 46 ? "Lascia per aggiornare" : "Tira per aggiornare"}
                      </span>
                    </div>
                    <div className="sb-noscroll" style={css("display:flex;gap:8px;overflow:auto;padding:14px 20px 12px")}>
                      <button
                        type="button"
                        onClick={() => setPannelloFiltri(true)}
                        style={css(
                          `flex:none;min-height:40px;border:2px solid ${C.ink};background:${nAvanzati ? C.ink : "transparent"};color:${nAvanzati ? C.crema : C.ink};padding:0 12px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap`,
                        )}
                      >
                        Filtri{nAvanzati ? ` · ${nAvanzati}` : ""}
                      </button>
                      {FILTRI_RAPIDI.map((f) => (
                        <Chip key={f} on={filtri.includes(f)} onClick={() => setFiltri(filtri.includes(f) ? filtri.filter((x) => x !== f) : [...filtri, f])}>
                          {f}
                        </Chip>
                      ))}
                    </div>
                    <div style={css("padding:0 20px 10px;display:flex;align-items:center;gap:10px")}>
                      <span style={css(`flex:1;font-size:13px;font-weight:700;color:${C.grigio}`)}>
                        {poolCerca.length} {poolCerca.length === 1 ? "casa" : "case"}
                      </span>
                      <label style={css(`font-size:13px;font-weight:700;color:${C.grigio};display:flex;align-items:center;gap:6px`)}>
                        Ordina
                        <select
                          value={ordine}
                          onChange={(e) => setOrdine(e.target.value as Ordine)}
                          style={css(`height:40px;border:2px solid ${C.linea};background:${C.carta};color:${C.ink};font-family:inherit;font-size:14px;font-weight:700;padding:0 8px`)}
                        >
                          <option value="recenti">Più recenti</option>
                          <option value="prezzo">Prezzo più basso</option>
                          <option value="vicine">Vicine a {origineDistanza.nome.split(" —")[0]}</option>
                        </select>
                      </label>
                    </div>
                    {poolCerca.length === 0 ? (
                      <div style={css(`margin:6px 20px 0;border:2px dashed ${C.linea};padding:24px 18px`)}>
                        <div style={css("font-size:18px;font-weight:900;letter-spacing:-.02em")}>
                          {annunci.length === 0 ? "Nessuna casa, per ora." : "Nessuna casa con questi filtri."}
                        </div>
                        <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:6px;line-height:1.45`)}>
                          {annunci.length === 0 ? "Le stanze arrivano ogni giorno: ripassa presto." : "Prova a togliere qualche filtro."}
                        </div>
                        {filtriAttivi > 0 && (
                          <button type="button" onClick={togliFiltri} style={css(`${BOTTONE.scuro};height:46px;margin-top:14px`)}>
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
                <MappaBologna annunci={poolCerca} selId={selA?.id ?? null} onSelect={scegliPin} />
                <div style={css(`position:absolute;top:${testata};left:20px;right:20px;display:flex;align-items:center;gap:10px;pointer-events:none;z-index:5`)}>
                  <h1 style={css("font-size:26px;font-weight:900;letter-spacing:-.045em;margin:0;background:rgba(250,243,231,.9);padding:2px 8px")}>Mappa</h1>
                  <span style={css(`font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.ink};background:${C.crema};padding:5px 9px`)}>
                    {poolCerca.length} {poolCerca.length === 1 ? "casa" : "case"}
                    {filtriAttivi ? " · filtri di Cerca" : ""}
                  </span>
                </div>
                {selA && (
                  <div
                    key={selA.id}
                    style={css(`position:absolute;left:0;right:0;bottom:78px;background:${C.carta};border-top:2px solid ${C.ink};padding:16px 20px 18px;animation:sbSheet .3s ${EASE} both;z-index:6`)}
                  >
                    <div style={css("display:flex;align-items:baseline;gap:10px")}>
                      <span style={css(`font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${C.arancioTesto}`)}>{selA.zona}</span>
                      <span style={css("margin-left:auto;font-size:22px;font-weight:900;letter-spacing:-.03em")}>{euro(selA.prezzo)}</span>
                    </div>
                    <div style={css("font-size:17px;font-weight:800;letter-spacing:-.025em;line-height:1.12;margin:6px 0 10px")}>{selA.titolo}</div>
                    <div style={css("display:flex;align-items:center;gap:7px;margin-bottom:12px;flex-wrap:wrap")}>
                      <Quadratini a={selA} size={10} />
                      <span style={css(`font-size:13px;font-weight:600;color:${C.grigio}`)}>{etichettaCamere(selA)}</span>
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
              <div className="sb-noscroll" style={css(`height:100%;overflow:auto;padding:${testata} 20px 104px`)}>
                <h1 style={css(titoloGrande)}>Salvati</h1>
                <div style={css(`height:2px;background:${C.ink};margin:12px 0 16px`)} />
                {salvate.length === 0 && (
                  <div style={css(`border:2px dashed ${C.linea};padding:28px 20px`)}>
                    <div style={css("font-size:18px;font-weight:800;letter-spacing:-.02em")}>Ancora niente.</div>
                    <div style={css(`font-size:14.5px;color:${C.grigio};margin-top:6px`)}>Scorri le case in Scopri e salva quelle giuste.</div>
                  </div>
                )}
                {!user && salvate.length > 0 && (
                  <div style={css(`font-size:13.5px;color:${C.grigio};margin-bottom:10px;line-height:1.4`)}>
                    Le case salvate restano su questo telefono.{" "}
                    <button type="button" onClick={() => setAccesso(true)} style={css(`border:0;background:transparent;padding:0;font-family:inherit;font-size:13.5px;font-weight:800;color:${C.ink};text-decoration:underline;cursor:pointer`)}>
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
                />
              ) : user === null ? (
                <AccediScreen inLinea />
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
            onAccedi={() => setAccesso(true)}
            sedeUtente={pref.sede}
            onAvviso={(t) => mostraAvviso(t)}
          />
        )}

        {/* ---------- PUBBLICA ---------- */}
        {pubblica && user && (
          <Pubblica
            userId={user.id}
            modificaId={pubblica.modificaId}
            onChiudi={(cambiato) => {
              setPubblica(null);
              if (cambiato) aggiorna();
            }}
          />
        )}

        {/* ---------- IL MIO CERCO ---------- */}
        {cercoAperto && user && <IlMioCerco userId={user.id} onChiudi={() => setCercoAperto(false)} />}

        {/* ---------- ACCEDI (sopra a tutto, quando serve) ---------- */}
        {accesso && user === null && (
          <div style={css("position:absolute;inset:0;z-index:150")}>
            <AccediScreen onChiudi={() => setAccesso(false)} />
          </div>
        )}

        {/* ---------- FILTRI ---------- */}
        <Foglio aperto={pannelloFiltri} onChiudi={() => setPannelloFiltri(false)} titolo="Filtri">
          <div style={css("display:flex;flex-direction:column;gap:18px")}>
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
            <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
              <Chip on={avanzati.registrato} onClick={() => setAvanzati({ ...avanzati, registrato: !avanzati.registrato })}>
                Contratto registrato
              </Chip>
              <Chip on={avanzati.breve} onClick={() => setAvanzati({ ...avanzati, breve: !avanzati.breve })}>
                Breve periodo
              </Chip>
            </div>
            <div>
              <div style={css("font-size:14px;font-weight:800;margin-bottom:8px")}>Zone</div>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                {ZONE_BOLOGNA.map((z) => (
                  <Chip
                    key={z}
                    on={avanzati.zone.includes(z)}
                    onClick={() => setAvanzati({ ...avanzati, zone: avanzati.zone.includes(z) ? avanzati.zone.filter((x) => x !== z) : [...avanzati.zone, z] })}
                  >
                    {z}
                  </Chip>
                ))}
              </div>
            </div>
            <div style={css("display:flex;gap:8px")}>
              <button type="button" onClick={togliFiltri} style={css(`${BOTTONE.contorno};flex:1`)}>
                Togli tutto
              </button>
              <button type="button" onClick={() => setPannelloFiltri(false)} style={css(`${BOTTONE.scuro};flex:1;height:48px`)}>
                Mostra {poolCerca.length} {poolCerca.length === 1 ? "casa" : "case"}
              </button>
            </div>
          </div>
        </Foglio>

        {avviso && <Avviso testo={avviso.testo} azione={avviso.azione} onAzione={avviso.onAzione} />}
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

function AccediScreen({ onChiudi, inLinea = false }: { onChiudi?: () => void; inLinea?: boolean }) {
  const [modo, setModo] = useState<"registrati" | "accedi">("registrati");
  const [local, setLocal] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  const campo = `width:100%;height:52px;border:0;border-bottom:2px solid rgba(250,243,231,.7);background:transparent;color:${C.crema};font-family:inherit;font-size:17px;font-weight:600;outline:none;padding:0 2px;border-radius:0`;
  const etichetta = `display:block;font-size:13px;font-weight:800;color:${C.crema};margin-bottom:4px`;

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
      if (error) return setErrore("Mail o password non corrette, oppure la mail non è ancora confermata.");
    }
  }

  return (
    <div
      className="sb-accesso"
      role={inLinea ? undefined : "dialog"}
      aria-modal={inLinea ? undefined : true}
      aria-label={inLinea ? undefined : "Entra in SLEPBOLO"}
      style={css(
        `position:absolute;inset:0;background:${C.rosso};color:${C.crema};display:flex;flex-direction:column;padding:calc(48px + env(safe-area-inset-top)) 26px ${inLinea ? "110px" : "40px"};overflow:auto;animation:sbIn .4s ${EASE} both`,
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

      <h1 style={css("font-size:36px;line-height:.98;font-weight:900;letter-spacing:-.045em;margin:24px 0 8px;max-width:12ch")}>
        {modo === "registrati" ? "Solo studenti UniBo." : "Bentornato."}
      </h1>
      <p style={css("font-size:15px;line-height:1.45;color:rgba(250,243,231,.92);margin:0 0 20px;max-width:32ch")}>
        {modo === "registrati"
          ? "Entra con la mail istituzionale: tiene fuori agenzie e sconosciuti. Ti servono solo mail e password."
          : "Accedi con la tua mail @studio.unibo.it."}
      </p>

      <div role="tablist" aria-label="Registrati o accedi" style={css("display:flex;gap:6px;margin-bottom:20px")}>
        {(["registrati", "accedi"] as const).map((m) => (
          <button
            type="button"
            role="tab"
            aria-selected={modo === m}
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
          <input
            id="sb-password"
            name="password"
            style={css(campo)}
            type="password"
            placeholder={modo === "registrati" ? "Almeno 8 caratteri" : ""}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={modo === "registrati" ? "new-password" : "current-password"}
          />
        </div>
        {modo === "accedi" && (
          <button
            type="button"
            onClick={inviaReset}
            style={css(`align-self:flex-start;min-height:44px;background:transparent;border:0;color:${C.crema};font-family:inherit;font-size:14px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:0`)}
          >
            Password dimenticata?
          </button>
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
        Il tuo nome non lo vede nessuno: negli annunci compari solo con età, corso e abitudini.{" "}
        <a href="https://slepbolo.it/privacy.html" target="_blank" rel="noopener noreferrer" style={css(`color:${C.crema};font-weight:800`)}>
          Privacy
        </a>
      </div>
    </div>
  );
}
