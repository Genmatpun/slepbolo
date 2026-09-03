"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { ZONE_BOLOGNA, SEDI_UNIBO, personaCoinquilino } from "@/lib/constants";
import { MappaBologna } from "./mappa-bologna";

/** Riepilogo privacy-safe dei coinquilini: "2 ragazze · 1 ragazzo". */
function riepilogoCoinq(coinq: { g: string }[]): string {
  const f = coinq.filter((c) => c.g === "ragazza").length;
  const m = coinq.filter((c) => c.g === "ragazzo").length;
  const altro = coinq.length - f - m;
  const parti: string[] = [];
  if (f) parti.push(`${f} ${f === 1 ? "ragazza" : "ragazze"}`);
  if (m) parti.push(`${m} ${m === 1 ? "ragazzo" : "ragazzi"}`);
  if (altro) parti.push(`${altro} ${altro === 1 ? "persona" : "persone"}`);
  return parti.join(" · ") || "Nessuno ancora";
}

// ============================================================
// SLEPBOLO Mobile — app iOS-style (design "SLEPBOLO Mobile.dc.html")
// Stessa palette UniBo, impaginazione a vista: griglia, filetti 2px,
// angoli vivi, titoli grandi. Dati reali passati dal server.
// ============================================================

export interface MobileAnnuncio {
  id: string;
  titolo: string;
  zona: string;
  via: string;
  lat: number;
  lng: number;
  tot: number;
  occ: number;
  prezzo: number;
  tipo: string;
  spese: string;
  speseIncl: boolean;
  min: number;
  contratto: string;
  servizi: string[];
  descrizione: string;
  coinq: { g: string; e: number | null; c: string; ab: string[]; pending: boolean }[];
  contattoNome: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  contattoNote: string | null;
  foto: string | null;
}

const SEDI = [
  { nome: "Zamboni", lat: 44.4967, lng: 11.3518 },
  { nome: "Terracini", lat: 44.5215, lng: 11.3289 },
  { nome: "Sant'Orsola", lat: 44.488, lng: 11.362 },
];

const GRAD = [
  "linear-gradient(135deg,#A2001D,#E4572E)",
  "linear-gradient(135deg,#E4572E,#F0A868)",
  "linear-gradient(135deg,#7A0016,#A2001D)",
  "linear-gradient(135deg,#B5651D,#E4572E)",
  "linear-gradient(135deg,#8C3B2E,#D9744F)",
];

/** Converte una stringa CSS "a:b;c:d" in oggetto style React — fedele al design. */
function css(s: string): CSSProperties {
  const o: Record<string, string> = {};
  for (const decl of s.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) continue;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return o as CSSProperties;
}

function hash(id: string): number {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % 997;
  return n;
}
const grad = (id: string) => GRAD[(hash(id) * 7) % GRAD.length];
const coverBg = (a: MobileAnnuncio) => (a.foto ? `#000 url('${a.foto}') center/cover no-repeat` : grad(a.id));
const glyph = (a: MobileAnnuncio) => a.zona.slice(0, 3).toUpperCase();
const libere = (a: MobileAnnuncio) => a.tot - a.occ;
const labelCamere = (n: number) => (n === 1 ? "1 camera libera" : `${n} camere libere`);

function squares(a: MobileAnnuncio, size = 12) {
  return Array.from({ length: a.tot }, (_, i) => ({
    st: `display:block;width:${size}px;height:${size}px;background:${i >= a.occ ? "#2e7d5b" : "#e5dccb"};animation:sbPop .34s cubic-bezier(.2,1.4,.4,1) both;animation-delay:${i * 70}ms`,
  }));
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371,
    dLa = ((b.lat - a.lat) * Math.PI) / 180,
    dLo = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.sin(dLo / 2) ** 2 * Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.35;
}

const CHIP_FILTRI = ["Sotto 400 €", "Spese incluse", "2+ camere libere", "Breve periodo", "Contratto registrato"];

// Abitudini divise per categoria (profilo studente)
const ABIT_CATEGORIE: { titolo: string; voci: string[] }[] = [
  { titolo: "Fumo", voci: ["Non fumo", "Fumo", "Fumo solo fuori"] },
  { titolo: "Ritmi", voci: ["Mattiniero/a", "Nottambulo/a", "Rientro tardi", "Weekend fuori"] },
  { titolo: "In casa", voci: ["Ordinato/a", "Cucino spesso", "Studio a casa", "Silenzioso/a", "Socievole", "Ospiti ok"] },
  { titolo: "Animali", voci: ["Ho un animale", "Ok agli animali", "No animali"] },
  { titolo: "Altro", voci: ["Sportivo/a", "Vegetariano/a", "Vegano/a", "Musica alta", "Niente feste"] },
];

interface Utente {
  id: string;
  email: string;
  nome: string;
  cognome: string;
}

export function MobileApp({ annunci }: { annunci: MobileAnnuncio[] }) {
  // undefined = sto controllando la sessione; null = non loggato
  const [user, setUser] = useState<Utente | null | undefined>(undefined);
  const [tab, setTab] = useState("scopri");
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<string[]>([]);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selPin, setSelPin] = useState(0);
  // preferenze profilo che filtrano SOLO l'Esplora (Scopri)
  const [pref, setPref] = useState<{ budget: number | null; zona: string | null }>({ budget: null, zona: null });

  const sx = useRef(0);
  const py = useRef<number | null>(null);
  const ps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- sessione + profilo ----
  useEffect(() => {
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
        .select("nome, cognome, abitudini, budget_max, zona_preferita")
        .eq("id", u.id)
        .single();
      setPref({ budget: data?.budget_max ?? null, zona: data?.zona_preferita ?? null });
      let nome = data?.nome ?? "";
      let cognome = data?.cognome ?? "";
      // Sincronizza nome/cognome dai dati di registrazione se il profilo è vuoto
      if ((!nome || !cognome) && (meta.nome || meta.cognome)) {
        nome = (meta.nome as string) ?? nome;
        cognome = (meta.cognome as string) ?? cognome;
        await supabase.from("profiles").update({ nome, cognome, eta: meta.eta ?? null }).eq("id", u.id);
      }
      setUser({ id: u.id, email: u.email, nome, cognome });
    }
    supabase.auth.getUser().then(({ data: { user: u } }) => (u ? carica(u) : setUser(null)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      session?.user ? carica(session.user) : setUser(null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- salvati: salvati sul dispositivo, per utente ----
  const chiaveSalvati = user ? `slepbolo-salvati-${user.id}` : null;
  useEffect(() => {
    if (!chiaveSalvati) return;
    try {
      const raw = localStorage.getItem(chiaveSalvati);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, [chiaveSalvati]);
  useEffect(() => {
    if (chiaveSalvati) localStorage.setItem(chiaveSalvati, JSON.stringify(saved));
  }, [saved, chiaveSalvati]);

  async function logout() {
    if (supabaseConfigurato()) await createClient().auth.signOut();
    setUser(null);
    setTab("scopri");
  }

  const filtrati = () =>
    annunci.filter(
      (a) =>
        (!filtri.includes("Spese incluse") || a.speseIncl) &&
        (!filtri.includes("Sotto 400 €") || a.prezzo < 400) &&
        (!filtri.includes("Breve periodo") || a.min <= 3) &&
        (!filtri.includes("Contratto registrato") || a.contratto === "Registrato") &&
        (!filtri.includes("2+ camere libere") || libere(a) >= 2),
    );

  // Esplora: filtrato sulle preferenze del profilo. Cerca: filtri a chip. Mappa: tutte.
  const poolScopri = annunci.filter(
    (a) => (!pref.budget || a.prezzo <= pref.budget) && (!pref.zona || a.zona === pref.zona),
  );
  const poolCerca = filtrati();
  const poolMappa = annunci;
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
  const avanza = (save: boolean) => {
    const a = poolScopri[idx];
    setSaved((prev) => (save && a && !prev.includes(a.id) ? [...prev, a.id] : prev));
    setIdx((i) => i + 1);
    setDragX(0);
    setDragging(false);
  };
  const salva = () => avanza(true);
  const passa = () => avanza(false);
  const onUp = () => {
    if (dragX > 95) salva();
    else if (dragX < -95) passa();
    else {
      setDragX(0);
      setDragging(false);
    }
  };

  // ---- pull to refresh ----
  const pullDown = (e: React.PointerEvent) => {
    py.current = e.clientY;
    ps.current = (e.currentTarget as HTMLElement).scrollTop;
  };
  const pullMove = (e: React.PointerEvent) => {
    if (py.current == null || ps.current > 0 || refreshing) return;
    const d = e.clientY - py.current;
    if (d > 0) setPull(Math.min(d * 0.55, 78));
  };
  const pullUp = () => {
    py.current = null;
    if (pull > 46) {
      setRefreshing(true);
      setPull(52);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 1400);
    } else if (pull) setPull(0);
  };

  const selA = poolMappa[Math.min(selPin, Math.max(0, poolMappa.length - 1))] || annunci[0];

  const row = (a: MobileAnnuncio) => (
    <div
      key={a.id}
      onClick={() => setDetail(a.id)}
      style={css("display:flex;gap:13px;padding:14px 20px;border-top:1px solid #e5dccb;cursor:pointer;background:transparent")}
    >
      <div
        style={css(
          `width:64px;height:64px;flex:none;display:grid;place-items:center;background:${coverBg(a)};color:rgba(255,255,255,.35);font-size:19px;font-weight:900;letter-spacing:-.05em`,
        )}
      >
        {a.foto ? "" : glyph(a)}
      </div>
      <div style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:6px")}>
        <div style={css("display:flex;align-items:baseline;gap:8px")}>
          <span style={css("font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#e4572e")}>
            {a.zona}
          </span>
          <span style={css("margin-left:auto;font-size:18px;font-weight:900;letter-spacing:-.03em")}>{a.prezzo} €</span>
        </div>
        <div style={css("font-size:15px;font-weight:700;letter-spacing:-.02em;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
          {a.titolo}
        </div>
        <div style={css("display:flex;align-items:center;gap:6px")}>
          {squares(a, 10).map((s, i) => (
            <span key={i} style={css(s.st)} />
          ))}
          <span style={css("font-size:12px;font-weight:600;color:#736b62")}>
            {libere(a)} su {a.tot} · {a.tipo.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );

  const tabDefs: [string, string][] = [
    ["scopri", "Scopri"],
    ["cerca", "Cerca"],
    ["mappa", "Mappa"],
    ["salvati", "Salvati"],
    ["profilo", "Profilo"],
  ];

  const stack = poolScopri.slice(idx, idx + 3);

  return (
    <div style={css("min-height:100dvh;background:#e9e2d5;display:flex;justify-content:center")}>
      <style>{`
        @keyframes sbIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes sbSlide{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
        @keyframes sbPop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}
        @keyframes sbPopPin{from{opacity:0;transform:translate(-50%,-50%) scale(.2)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        @keyframes sbSpin{to{transform:rotate(360deg)}}
        @keyframes sbSheet{from{transform:translateY(100%)}to{transform:none}}
        @keyframes sbBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .sb-noscroll::-webkit-scrollbar{display:none}
      `}</style>

      <div
        className="sb-noscroll"
        style={css(
          "position:relative;width:100%;max-width:440px;min-height:100dvh;height:100dvh;background:#faf3e7;overflow:hidden;color:#1b1815",
        )}
      >
        {/* ---------- CARICAMENTO ---------- */}
        {user === undefined && (
          <div style={css("position:absolute;inset:0;background:#a2001d;display:grid;place-items:center;animation:sbIn .3s ease both")}>
            <span style={css("color:#faf3e7;font-size:20px;font-weight:900;letter-spacing:-.05em")}>
              SLEP<span style={css("color:#e4572e")}>BOLO</span>
            </span>
          </div>
        )}

        {/* ---------- ACCEDI (login/registrazione UniBo) ---------- */}
        {user === null && <AccediScreen />}

        {/* ---------- APP ---------- */}
        {user && (
          <div style={css("position:absolute;inset:0;display:flex;flex-direction:column")}>
            <div
              key={tab}
              style={css("flex:1;overflow:hidden;position:relative;animation:sbSlide .32s cubic-bezier(.22,.9,.3,1) both")}
            >
              {/* SCOPRI */}
              {tab === "scopri" && (
                <div style={css("height:100%;display:flex;flex-direction:column;padding:62px 20px 0")}>
                  <div style={css("display:flex;align-items:flex-end;justify-content:space-between")}>
                    <h1 style={css("font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1")}>Scopri</h1>
                    <div style={css("font-size:12px;font-weight:700;color:#736b62;padding-bottom:4px")}>
                      {Math.max(0, poolScopri.length - idx)} case
                    </div>
                  </div>
                  <div style={css("height:2px;background:#1b1815;margin:12px 0 0")} />
                  <div
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    style={css("position:relative;flex:1;margin:18px 0 0;touch-action:none")}
                  >
                    {stack.length === 0 && (
                      <div style={css("position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px")}>
                        {poolScopri.length === 0 && (pref.budget || pref.zona) ? (
                          <div>
                            <div style={css("font-size:19px;font-weight:900;letter-spacing:-.03em")}>Nessuna casa con le tue preferenze.</div>
                            <div style={css("font-size:13.5px;color:#736b62;margin-top:6px;max-width:26ch")}>
                              Allarga budget o zona nel Profilo, oppure guardale tutte in Cerca e Mappa.
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={css("font-size:19px;font-weight:900;letter-spacing:-.03em")}>Hai visto tutto.</div>
                            <div style={css("font-size:13.5px;color:#736b62;margin-top:6px")}>Le case salvate sono nel tab Salvati.</div>
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
                        const wrap = `position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;background:#fffdf9;border:2px solid #1b1815;overflow:hidden;transform:${tf};z-index:${10 - i};transition:${dragging && i === 0 ? "none" : "transform .32s cubic-bezier(.2,.9,.3,1)"};box-shadow:${i === 0 ? "0 14px 40px rgba(27,24,21,.18)" : "none"}`;
                        const tags = [
                          libere(a) === 1 ? { testo: "Ultima camera", hot: true } : null,
                          a.speseIncl ? { testo: "Spese incluse" } : null,
                          a.min <= 3 ? { testo: "Breve periodo" } : null,
                          a.contratto === "Registrato" ? { testo: "Contratto registrato" } : null,
                        ]
                          .filter(Boolean)
                          .slice(0, 3) as { testo: string; hot?: boolean }[];
                        return (
                          <div key={a.id} style={css(wrap)}>
                            <div style={css(`position:relative;height:170px;flex:none;display:grid;place-items:center;background:${coverBg(a)}`)}>
                              <span style={css("position:absolute;left:14px;top:14px;background:#faf3e7;padding:5px 10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase")}>
                                {a.zona}
                              </span>
                              {!a.foto && <span style={css("font-size:74px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.22)")}>{glyph(a)}</span>}
                              <span style={css("position:absolute;right:14px;bottom:14px;background:#1b1815;color:#faf3e7;padding:7px 12px;font-size:19px;font-weight:900;letter-spacing:-.03em")}>
                                {a.prezzo} €<span style={css("font-size:11px;font-weight:600")}>/mese</span>
                              </span>
                            </div>
                            <div style={css("padding:16px 16px 18px;display:flex;flex-direction:column;gap:11px;flex:1")}>
                              <h2 style={css("margin:0;font-size:21px;font-weight:800;letter-spacing:-.035em;line-height:1.08")}>{a.titolo}</h2>
                              <div style={css("display:flex;align-items:center;gap:7px")}>
                                {squares(a).map((s, k) => (
                                  <span key={k} style={css(s.st)} />
                                ))}
                                <span style={css("font-size:12.5px;font-weight:700;color:#736b62")}>
                                  {labelCamere(libere(a))} su {a.tot}
                                </span>
                              </div>
                              <div style={css("height:1px;background:#e5dccb")} />
                              <div style={css("display:flex;gap:8px;align-items:center")}>
                                {a.coinq.slice(0, 3).map((c, k) => (
                                  <span
                                    key={k}
                                    style={css("width:26px;height:26px;flex:none;display:grid;place-items:center;background:#f0e7d6;font-size:15px")}
                                  >
                                    {personaCoinquilino(c.g).emoji}
                                  </span>
                                ))}
                                <span style={css("font-size:12.5px;color:#736b62;font-weight:600")}>
                                  {riepilogoCoinq(a.coinq)}
                                </span>
                              </div>
                              <div style={css("margin-top:auto;display:flex;gap:6px;flex-wrap:wrap")}>
                                {tags.map((t, k) => (
                                  <span
                                    key={k}
                                    style={css(
                                      t.hot
                                        ? "border:1px solid rgba(228,87,46,.35);background:rgba(228,87,46,.12);color:#B23A17;padding:5px 9px;font-size:11.5px;font-weight:800"
                                        : "border:1px solid #e5dccb;background:#faf3e7;color:#736b62;padding:5px 9px;font-size:11.5px;font-weight:700",
                                    )}
                                  >
                                    {t.testo}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div
                              style={css(
                                `position:absolute;left:18px;top:18px;border:3px solid #2e7d5b;color:#2e7d5b;font-size:20px;font-weight:900;letter-spacing:.06em;padding:5px 12px;transform:rotate(-12deg);opacity:${i === 0 ? Math.max(0, Math.min(1, dragX / 90)) : 0};background:rgba(250,243,231,.85)`,
                              )}
                            >
                              SALVA
                            </div>
                            <div
                              style={css(
                                `position:absolute;right:18px;top:18px;border:3px solid #a2001d;color:#a2001d;font-size:20px;font-weight:900;letter-spacing:.06em;padding:5px 12px;transform:rotate(12deg);opacity:${i === 0 ? Math.max(0, Math.min(1, -dragX / 90)) : 0};background:rgba(250,243,231,.85)`,
                              )}
                            >
                              PASSA
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div style={css("display:flex;gap:10px;padding:14px 0 90px")}>
                    <button onClick={passa} style={css("flex:1;height:52px;border:2px solid #1b1815;background:transparent;font-family:inherit;font-size:14px;font-weight:800;letter-spacing:-.01em;cursor:pointer;color:#1b1815")}>
                      Passa
                    </button>
                    <button onClick={salva} style={css("flex:1;height:52px;border:0;background:#a2001d;color:#faf3e7;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer")}>
                      Salva
                    </button>
                    <button onClick={() => poolScopri[idx] && setDetail(poolScopri[idx].id)} style={css("width:52px;height:52px;border:0;background:#1b1815;color:#faf3e7;font-size:19px;cursor:pointer")}>
                      →
                    </button>
                  </div>
                </div>
              )}

              {/* CERCA */}
              {tab === "cerca" && (
                <div
                  onPointerDown={pullDown}
                  onPointerMove={pullMove}
                  onPointerUp={pullUp}
                  onPointerCancel={pullUp}
                  className="sb-noscroll"
                  style={css("height:100%;overflow:auto;padding:62px 0 96px;touch-action:pan-y")}
                >
                  <div style={css("padding:0 20px")}>
                    <h1 style={css("font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1")}>Cerca</h1>
                    <div style={css("height:2px;background:#1b1815;margin:12px 0 14px")} />
                  </div>
                  <div
                    style={css(
                      `display:flex;align-items:center;justify-content:center;gap:9px;height:${pull}px;overflow:hidden;transition:${pull === 0 || refreshing ? "height .3s ease" : "none"}`,
                    )}
                  >
                    <span
                      style={css(
                        `width:14px;height:14px;border:2px solid #e5dccb;border-top-color:#a2001d;border-radius:99px;display:block;animation:sbSpin .8s linear infinite;animation-play-state:${refreshing ? "running" : "paused"}`,
                      )}
                    />
                    <span style={css("font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#736b62")}>
                      {refreshing ? "Aggiorno…" : "Tira per aggiornare"}
                    </span>
                  </div>
                  <div className="sb-noscroll" style={css("display:flex;gap:8px;overflow:auto;padding:0 20px 14px")}>
                    {CHIP_FILTRI.map((label) => {
                      const on = filtri.includes(label);
                      return (
                        <button
                          key={label}
                          onClick={() => setFiltri(on ? filtri.filter((x) => x !== label) : [...filtri, label])}
                          style={css(
                            `flex:none;border:2px solid #1b1815;background:${on ? "#1b1815" : "transparent"};color:${on ? "#faf3e7" : "#1b1815"};padding:8px 13px;font-size:12.5px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .18s,color .18s`,
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={css("padding:0 20px 8px;font-size:12px;font-weight:700;color:#736b62")}>
                    {poolCerca.length} case · ordinate per distanza da Terracini
                  </div>
                  {poolCerca.map((a) => row(a))}
                </div>
              )}

              {/* MAPPA */}
              {tab === "mappa" && (
                <div style={css("height:100%;position:relative;background:#f0e7d6")}>
                  <MappaBologna annunci={poolMappa} selId={selA?.id ?? null} onSelect={(i) => setSelPin(i)} />
                  <div style={css("position:absolute;top:62px;left:20px;right:20px;display:flex;align-items:center;gap:10px;pointer-events:none;z-index:5")}>
                    <h1 style={css("font-size:26px;font-weight:900;letter-spacing:-.045em;margin:0")}>Mappa</h1>
                    <span style={css("font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#736b62;background:#faf3e7;padding:5px 9px")}>
                      {poolMappa.length} case
                    </span>
                  </div>
                  {selA && (
                    <div
                      key={selA.id}
                      style={css("position:absolute;left:0;right:0;bottom:78px;background:#fffdf9;border-top:2px solid #1b1815;padding:16px 20px 18px;animation:sbSheet .3s cubic-bezier(.2,.9,.3,1) both")}
                    >
                      <div style={css("display:flex;align-items:baseline;gap:10px")}>
                        <span style={css("font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#e4572e")}>{selA.zona}</span>
                        <span style={css("margin-left:auto;font-size:22px;font-weight:900;letter-spacing:-.03em")}>{selA.prezzo} €</span>
                      </div>
                      <div style={css("font-size:17px;font-weight:800;letter-spacing:-.025em;line-height:1.12;margin:6px 0 10px")}>{selA.titolo}</div>
                      <div style={css("display:flex;align-items:center;gap:7px;margin-bottom:12px")}>
                        {squares(selA, 10).map((s, k) => (
                          <span key={k} style={css(s.st)} />
                        ))}
                        <span style={css("font-size:12.5px;font-weight:600;color:#736b62")}>
                          {labelCamere(libere(selA))} su {selA.tot} · {selA.via}
                        </span>
                      </div>
                      <button
                        onClick={() => setDetail(selA.id)}
                        style={css("width:100%;height:48px;border:0;background:#1b1815;color:#faf3e7;font-family:inherit;font-size:14px;font-weight:800;text-align:left;padding:0 16px;display:flex;align-items:center;cursor:pointer")}
                      >
                        Vedi la casa<span style={css("margin-left:auto")}>→</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SALVATI */}
              {tab === "salvati" && (
                <div className="sb-noscroll" style={css("height:100%;overflow:auto;padding:62px 20px 96px")}>
                  <h1 style={css("font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1")}>Salvati</h1>
                  <div style={css("height:2px;background:#1b1815;margin:12px 0 16px")} />
                  {saved.length === 0 && (
                    <div style={css("border:2px dashed #e5dccb;padding:28px 20px;text-align:left")}>
                      <div style={css("font-size:17px;font-weight:800;letter-spacing:-.02em")}>Ancora niente.</div>
                      <div style={css("font-size:13.5px;color:#736b62;margin-top:6px")}>Scorri le case in Scopri e salva quelle giuste.</div>
                    </div>
                  )}
                  <div style={css("margin:0 -20px")}>
                    {saved
                      .map((id) => annunci.find((a) => a.id === id))
                      .filter((a): a is MobileAnnuncio => !!a)
                      .map((a) => row(a))}
                  </div>
                </div>
              )}

              {/* PROFILO */}
              {tab === "profilo" && (
                <ProfiloTab
                  user={user}
                  onLogout={logout}
                  onSaved={(budget, zona) => {
                    setPref({ budget, zona });
                    setIdx(0);
                  }}
                />
              )}
            </div>

            {/* TAB BAR */}
            <div style={css("position:absolute;left:0;right:0;bottom:0;height:78px;background:rgba(255,253,249,.92);backdrop-filter:blur(14px);border-top:2px solid #1b1815;display:grid;grid-template-columns:repeat(5,1fr);align-items:start;padding-top:9px;z-index:40")}>
              {tabDefs.map(([k, label]) => {
                const on = tab === k;
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setTab(k);
                      setDetail(null);
                    }}
                    style={css("display:flex;flex-direction:column;align-items:center;gap:7px;background:transparent;border:0;padding:6px 0;cursor:pointer;font-family:inherit")}
                  >
                    <span style={css(`width:22px;height:4px;background:${on ? "#a2001d" : "#cfc5b4"};transition:background .2s`)} />
                    <span style={css(`font-size:11px;font-weight:${on ? 800 : 600};color:${on ? "#1b1815" : "#736b62"};letter-spacing:-.01em`)}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------- DETAIL ---------- */}
        {det && (
          <div style={css("position:absolute;inset:0;background:#faf3e7;z-index:70;display:flex;flex-direction:column;animation:sbSlide .34s cubic-bezier(.22,.9,.3,1) both")}>
            <div className="sb-noscroll" style={css("flex:1;overflow:auto")}>
              <div style={css(`position:relative;height:270px;display:grid;place-items:center;background:${coverBg(det)}`)}>
                {!det.foto && <span style={css("font-size:96px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.2)")}>{glyph(det)}</span>}
                <button onClick={() => setDetail(null)} style={css("position:absolute;left:18px;top:58px;width:40px;height:40px;border:0;background:#faf3e7;color:#1b1815;font-size:18px;font-weight:800;cursor:pointer")}>
                  ←
                </button>
                <button
                  onClick={() => setSaved(saved.includes(det.id) ? saved.filter((x) => x !== det.id) : [...saved, det.id])}
                  style={css(
                    `position:absolute;right:18px;top:58px;height:40px;padding:0 14px;border:0;background:${saved.includes(det.id) ? "#2e7d5b" : "#faf3e7"};color:${saved.includes(det.id) ? "#faf3e7" : "#1b1815"};font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:background .2s`,
                  )}
                >
                  {saved.includes(det.id) ? "✓ Salvata" : "Salva"}
                </button>
                <span style={css("position:absolute;left:18px;bottom:16px;background:#faf3e7;padding:6px 11px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase")}>
                  {det.zona} · {det.via}
                </span>
              </div>
              <div style={css("padding:20px 20px 0")}>
                <h1 style={css("margin:0;font-size:29px;font-weight:900;letter-spacing:-.04em;line-height:1.05")}>{det.titolo}</h1>
                <div style={css("display:flex;align-items:baseline;gap:10px;margin-top:14px;border-top:2px solid #1b1815;border-bottom:2px solid #1b1815;padding:12px 0")}>
                  <span style={css("font-size:34px;font-weight:900;letter-spacing:-.045em")}>{det.prezzo} €</span>
                  <span style={css("font-size:13px;font-weight:700;color:#736b62")}>/mese · {det.spese}</span>
                  <span style={css("margin-left:auto;font-size:12px;font-weight:800;background:#1b1815;color:#faf3e7;padding:5px 9px")}>{det.tipo}</span>
                </div>
                <div style={css("display:flex;align-items:center;gap:9px;padding:16px 0 4px")}>
                  {squares(det, 14).map((s, k) => (
                    <span key={k} style={css(s.st)} />
                  ))}
                  <span style={css("font-size:13.5px;font-weight:700")}>
                    {labelCamere(libere(det))} su {det.tot}
                  </span>
                </div>
              </div>
              <div style={css("padding:18px 20px 0")}>
                <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e;margin-bottom:12px")}>Chi ci abita già</div>
                {det.coinq.map((p, k) => {
                  const per = personaCoinquilino(p.g);
                  return (
                    <div key={k} style={css("display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid #e5dccb")}>
                      <span style={css("width:42px;height:42px;flex:none;display:grid;place-items:center;background:#f0e7d6;font-size:22px")}>{per.emoji}</span>
                      <div style={css("flex:1")}>
                        <div style={css("font-size:15px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:7px;flex-wrap:wrap")}>
                          <span>
                            {per.label}
                            {p.e ? `, ${p.e}` : ""}
                          </span>
                          {p.pending ? (
                            <span style={css("border:1px solid #e4a11b;background:#fdf3dd;color:#9a6a00;padding:2px 6px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase")}>In attesa</span>
                          ) : null}
                        </div>
                        {p.c ? <div style={css("font-size:12.5px;color:#736b62;font-weight:600")}>{p.c}</div> : null}
                        {p.ab.length > 0 && (
                          <div style={css("display:flex;flex-wrap:wrap;gap:5px;margin-top:7px")}>
                            {p.ab.map((x, j) => (
                              <span key={j} style={css("border:1px solid #e5dccb;background:#faf3e7;color:#736b62;padding:3px 8px;font-size:11px;font-weight:700")}>{x}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={css("padding:20px 20px 0")}>
                <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e;margin-bottom:10px")}>Distanza dalle lezioni</div>
                {SEDI.map((v) => {
                  const k = km(det, v);
                  return {
                    nome: v.nome,
                    bici: Math.max(1, Math.round((k / 14) * 60)),
                    piedi: Math.max(1, Math.round((k / 4.8) * 60)),
                  };
                })
                  .sort((a, b) => a.bici - b.bici)
                  .map((d) => (
                    <div key={d.nome} style={css("display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #e5dccb")}>
                      <span style={css("font-size:14px;font-weight:700;letter-spacing:-.02em")}>{d.nome}</span>
                      <span style={css("margin-left:auto;font-size:13px;font-weight:800")}>{d.bici}′ bici</span>
                      <span style={css("font-size:13px;color:#736b62;font-weight:600")}>{d.piedi}′ a piedi</span>
                    </div>
                  ))}
              </div>
              <div style={css("padding:20px 20px 0;display:flex;flex-wrap:wrap;gap:7px")}>
                {det.servizi.map((s, k) => (
                  <span key={k} style={css("border:1px solid #e5dccb;background:#fffdf9;padding:6px 10px;font-size:12px;font-weight:700;color:#736b62")}>
                    {s}
                  </span>
                ))}
              </div>
              <div style={css("padding:20px 20px 30px;font-size:14.5px;line-height:1.5;color:#3a332d")}>{det.descrizione}</div>
            </div>
            <div style={css("padding:12px 20px 24px;background:#faf3e7;border-top:2px solid #1b1815")}>
              <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#736b62;margin-bottom:8px")}>
                Contatta {det.contattoNome || "l'host"}
                {det.contattoNote ? ` · ${det.contattoNote}` : ""}
              </div>
              <div style={css("display:flex;gap:8px")}>
                {det.telefono && (
                  <a href={`tel:${det.telefono.replace(/\s/g, "")}`} style={css("flex:1;height:52px;background:#a2001d;color:#faf3e7;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none")}>
                    Chiama
                  </a>
                )}
                {(det.whatsapp || det.telefono) && (
                  <a href={`https://wa.me/${(det.whatsapp || det.telefono || "").replace(/[^\d]/g, "")}`} target="_blank" rel="noopener" style={css("flex:1;height:52px;background:#1b1815;color:#faf3e7;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;text-decoration:none")}>
                    WhatsApp
                  </a>
                )}
                {det.email && (
                  <a href={`mailto:${det.email}`} style={css("flex:1;height:52px;border:2px solid #1b1815;color:#1b1815;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;text-decoration:none")}>
                    Email
                  </a>
                )}
              </div>
              {!det.telefono && !det.whatsapp && !det.email && (
                <div style={css("font-size:13px;color:#736b62")}>Nessun contatto disponibile per questo annuncio.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Schermata di accesso: solo mail @studio.unibo.it
// ============================================================
function AccediScreen() {
  const [modo, setModo] = useState<"registrati" | "accedi">("registrati");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [eta, setEta] = useState("");
  const [local, setLocal] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  const campo = "width:100%;height:52px;border:0;border-bottom:2px solid rgba(250,243,231,.45);background:transparent;color:#faf3e7;font-family:inherit;font-size:17px;font-weight:600;outline:none;padding:0 2px";

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
    if (error) return setErrore(error.message);
    setAvviso("Ti abbiamo mandato una mail per reimpostare la password: apri il link e scegline una nuova.");
  }

  async function submit() {
    setErrore(null);
    setAvviso(null);
    const l = local.trim().toLowerCase().replace(/@.*/, "");
    if (!l) return setErrore("Scrivi la tua mail UniBo.");
    if (password.length < 8) return setErrore("La password deve avere almeno 8 caratteri.");
    if (modo === "registrati" && (!nome.trim() || !cognome.trim())) return setErrore("Servono nome e cognome.");
    if (!supabaseConfigurato()) return setErrore("Accesso non disponibile in questa demo.");

    const email = `${l}@studio.unibo.it`;
    setInvio(true);
    const supabase = createClient();
    if (modo === "registrati") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome: nome.trim(), cognome: cognome.trim(), eta: eta ? Number(eta) : null } },
      });
      setInvio(false);
      if (error) return setErrore(error.message);
      if (!data.session) {
        setAvviso("Ti abbiamo mandato una mail: clicca il link per confermare, poi accedi.");
        setModo("accedi");
      }
      // se c'è già la sessione, onAuthStateChange fa entrare in automatico
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setInvio(false);
      if (error) return setErrore("Email o password non corretti (o mail non ancora confermata).");
    }
  }

  return (
    <div style={css("position:absolute;inset:0;background:#a2001d;color:#faf3e7;display:flex;flex-direction:column;padding:64px 26px 40px;overflow:auto;animation:sbIn .45s ease both")}>
      <div style={css("display:flex;align-items:center;gap:10px")}>
        <div style={css("position:relative;width:38px;height:38px;display:grid;place-items:center;background:#faf3e7;overflow:hidden")}>
          <span style={css("position:relative;z-index:2;font-size:16px;font-weight:900;letter-spacing:-.05em;color:#a2001d")}>SB</span>
          <span style={css("position:absolute;right:-7px;bottom:-8px;width:22px;height:22px;border-radius:99px;background:#e4572e")} />
        </div>
        <div style={css("font-size:20px;font-weight:900;letter-spacing:-.05em")}>
          SLEP<span style={css("color:#e4572e")}>BOLO</span>
        </div>
      </div>

      <h1 style={css("font-size:38px;line-height:.96;font-weight:900;letter-spacing:-.045em;margin:26px 0 6px;max-width:11ch")}>
        {modo === "registrati" ? "Solo studenti UniBo." : "Bentornato."}
      </h1>
      <p style={css("font-size:14px;line-height:1.35;color:rgba(250,243,231,.72);margin:0 0 22px;max-width:30ch")}>
        {modo === "registrati"
          ? "Entra con la tua mail istituzionale. Serve a tenere fuori chi non studia qui."
          : "Accedi con la tua mail @studio.unibo.it."}
      </p>

      <div style={css("display:flex;gap:6px;margin-bottom:20px")}>
        {(["registrati", "accedi"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            style={css(`flex:1;height:40px;border:2px solid #faf3e7;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;background:${modo === m ? "#faf3e7" : "transparent"};color:${modo === m ? "#a2001d" : "#faf3e7"}`)}
          >
            {m === "registrati" ? "Registrati" : "Accedi"}
          </button>
        ))}
      </div>

      <div style={css("display:flex;flex-direction:column;gap:16px")}>
        {modo === "registrati" && (
          <>
            <div style={css("display:flex;gap:12px")}>
              <input style={css(campo)} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <input style={css(campo)} placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} />
            </div>
            <input style={css(campo)} placeholder="Età" inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value)} />
          </>
        )}
        <div>
          <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e;margin-bottom:8px")}>Mail istituzionale</div>
          <div style={css("display:flex;align-items:center;border-bottom:2px solid rgba(250,243,231,.45)")}>
            <input style={css("flex:1;height:52px;border:0;background:transparent;color:#faf3e7;font-family:inherit;font-size:17px;font-weight:600;outline:none")} placeholder="nome.cognome" value={local} onChange={(e) => setLocal(e.target.value)} autoCapitalize="none" />
            <span style={css("font-size:15px;font-weight:600;color:rgba(250,243,231,.6);white-space:nowrap")}>@studio.unibo.it</span>
          </div>
        </div>
        <input style={css(campo)} type="password" placeholder="Password (min 8 caratteri)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {modo === "accedi" && (
          <button onClick={inviaReset} style={css("align-self:flex-start;background:transparent;border:0;color:rgba(250,243,231,.8);font-family:inherit;font-size:13px;font-weight:700;text-decoration:underline;cursor:pointer;padding:0")}>
            Password dimenticata?
          </button>
        )}
      </div>

      {errore && <div style={css("margin-top:16px;font-size:13px;font-weight:700;color:#ffd7c2")}>{errore}</div>}
      {avviso && <div style={css("margin-top:16px;font-size:13px;font-weight:700;background:rgba(250,243,231,.16);padding:10px 12px")}>{avviso}</div>}

      <button
        onClick={submit}
        disabled={invio}
        style={css("margin-top:24px;width:100%;height:56px;border:0;background:#faf3e7;color:#a2001d;font-family:inherit;font-size:16px;font-weight:800;text-align:left;padding:0 20px;display:flex;align-items:center;cursor:pointer")}
      >
        {invio ? "Un attimo…" : modo === "registrati" ? "Crea account" : "Entra"}
        <span style={css("margin-left:auto;font-size:19px")}>→</span>
      </button>
      <div style={css("margin-top:14px;font-size:12px;color:rgba(250,243,231,.6)")}>Solo studenti UniBo. Nessuna agenzia.</div>
    </div>
  );
}

// ============================================================
// Profilo studente — modificabile e salvato nel database
// ============================================================
const inCampo = "width:100%;height:48px;border:2px solid #e5dccb;background:#fffdf9;padding:0 12px;font-family:inherit;font-size:15px;font-weight:600;color:#1b1815;outline:none";

function ProfiloTab({
  user,
  onLogout,
  onSaved,
}: {
  user: Utente;
  onLogout: () => void;
  onSaved: (budget: number | null, zona: string | null) => void;
}) {
  const [nome, setNome] = useState(user.nome);
  const [cognome, setCognome] = useState(user.cognome);
  const [eta, setEta] = useState("");
  const [corso, setCorso] = useState("");
  const [sede, setSede] = useState("");
  const [zona, setZona] = useState("");
  const [budget, setBudget] = useState("");
  const [bio, setBio] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [abit, setAbit] = useState<string[]>([]);
  const [caricamentoFoto, setCaricamentoFoto] = useState(false);
  const [salvato, setSalvato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mieCase, setMieCase] = useState<{ id: string; titolo: string; zona: string; prezzo: number; attivo: boolean }[]>([]);

  useEffect(() => {
    if (!supabaseConfigurato()) return;
    const supabase = createClient();
    supabase
      .from("apartments")
      .select("id, titolo, zona, attivo, rooms(prezzo_mensile, stato)")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setMieCase(
          data.map((a) => {
            const libere = (a.rooms as { prezzo_mensile: number; stato: string }[] | null)?.filter((r) => r.stato === "libera") ?? [];
            return { id: a.id as string, titolo: a.titolo as string, zona: a.zona as string, attivo: a.attivo as boolean, prezzo: libere.length ? Math.min(...libere.map((r) => r.prezzo_mensile)) : 0 };
          }),
        );
      });
  }, [user.id]);

  async function eliminaCasa(id: string) {
    if (!confirm("Eliminare questo annuncio? L'operazione è definitiva.")) return;
    await createClient().from("apartments").delete().eq("id", id);
    setMieCase((c) => c.filter((x) => x.id !== id));
  }

  useEffect(() => {
    if (!supabaseConfigurato()) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("nome, cognome, eta, corso_laurea, sede_principale, zona_preferita, budget_max, abitudini, foto_url, bio")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNome(data.nome ?? "");
        setCognome(data.cognome ?? "");
        setEta(data.eta != null ? String(data.eta) : "");
        setCorso(data.corso_laurea ?? "");
        setSede(data.sede_principale ?? "");
        setZona(data.zona_preferita ?? "");
        setBudget(data.budget_max != null ? String(data.budget_max) : "");
        setBio(data.bio ?? "");
        setFotoUrl(data.foto_url ?? null);
        setAbit((data.abitudini as string[]) ?? []);
      });
  }, [user.id]);

  function toggle(v: string) {
    setAbit((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  }

  async function caricaFoto(file: File) {
    if (!supabaseConfigurato()) return;
    setCaricamentoFoto(true);
    const supabase = createClient();
    const path = `${user.id}/avatar/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("foto").upload(path, file, { upsert: true });
    if (!error) setFotoUrl(supabase.storage.from("foto").getPublicUrl(path).data.publicUrl);
    setCaricamentoFoto(false);
  }

  async function salva() {
    if (!supabaseConfigurato()) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({
        nome, cognome,
        eta: eta ? Number(eta) : null,
        corso_laurea: corso || null,
        sede_principale: sede || null,
        zona_preferita: zona || null,
        budget_max: budget ? Number(budget) : null,
        bio: bio || null,
        abitudini: abit,
        foto_url: fotoUrl,
      })
      .eq("id", user.id);
    onSaved(budget ? Number(budget) : null, zona || null);
    setSalvando(false);
    setSalvato(true);
    setTimeout(() => setSalvato(false), 2200);
  }

  const campi = [nome, cognome, eta, corso, sede, budget, fotoUrl, abit.length ? "x" : ""];
  const compl = Math.round((campi.filter(Boolean).length / campi.length) * 100);
  const iniziali = ((nome[0] ?? user.email[0] ?? "?") + (cognome[0] ?? "")).toUpperCase();

  return (
    <div className="sb-noscroll" style={css("height:100%;overflow:auto;padding:62px 20px 110px")}>
      <h1 style={css("font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1")}>Profilo</h1>
      <div style={css("height:2px;background:#1b1815;margin:12px 0 18px")} />

      {/* Testata: foto + nome */}
      <div style={css("display:flex;gap:14px;align-items:center")}>
        <label style={css("position:relative;width:74px;height:74px;flex:none;cursor:pointer;overflow:hidden;background:#a2001d")}>
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
          ) : (
            <span style={css("width:100%;height:100%;display:grid;place-items:center;color:#faf3e7;font-size:26px;font-weight:900;letter-spacing:-.04em")}>{iniziali}</span>
          )}
          <span style={css("position:absolute;left:0;right:0;bottom:0;background:rgba(27,24,21,.72);color:#faf3e7;font-size:9px;font-weight:800;text-align:center;padding:2px 0;letter-spacing:.04em;text-transform:uppercase")}>
            {caricamentoFoto ? "…" : "Cambia"}
          </span>
          <input type="file" accept="image/*" style={css("display:none")} onChange={(e) => e.target.files?.[0] && caricaFoto(e.target.files[0])} />
        </label>
        <div style={css("min-width:0")}>
          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.035em;line-height:1.05")}>
            {`${nome} ${cognome}`.trim() || "Studente UniBo"}
          </div>
          <div style={css("font-size:12.5px;color:#736b62;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis")}>{user.email}</div>
          <span style={css("display:inline-flex;align-items:center;gap:5px;margin-top:6px;background:rgba(46,125,91,.12);border:1px solid rgba(46,125,91,.3);color:#2e7d5b;font-size:11px;font-weight:800;padding:4px 8px")}>✓ Verificato UniBo</span>
        </div>
      </div>

      {/* Completamento */}
      <div style={css("margin:18px 0 6px;height:10px;background:#e5dccb;overflow:hidden")}>
        <div style={css(`height:100%;width:${compl}%;background:#a2001d;transition:width .3s`)} />
      </div>
      <div style={css("font-size:12px;color:#736b62;font-weight:600")}>Profilo completo al {compl}%</div>

      {/* Proponi una casa */}
      <a href="/proponi" style={css("margin-top:18px;display:flex;align-items:center;gap:12px;border:2px solid #1b1815;background:#1b1815;color:#faf3e7;padding:14px 16px;text-decoration:none")}>
        <span style={css("font-size:22px")}>＋</span>
        <span style={css("flex:1")}>
          <span style={css("display:block;font-size:15px;font-weight:800;letter-spacing:-.02em")}>Hai una stanza libera?</span>
          <span style={css("display:block;font-size:12.5px;color:rgba(250,243,231,.7)")}>Proponi la casa e cerca il coinquilino</span>
        </span>
        <span style={css("font-size:18px")}>→</span>
      </a>

      {/* Inviti come coinquilino */}
      <a href="/inviti" style={css("margin-top:10px;display:flex;align-items:center;gap:12px;border:2px solid #1b1815;background:#faf3e7;color:#1b1815;padding:14px 16px;text-decoration:none")}>
        <span style={css("font-size:20px")}>✉️</span>
        <span style={css("flex:1")}>
          <span style={css("display:block;font-size:15px;font-weight:800;letter-spacing:-.02em")}>Inviti come coinquilino</span>
          <span style={css("display:block;font-size:12.5px;color:#736b62")}>Ti hanno aggiunto a una casa? Accetta qui</span>
        </span>
        <span style={css("font-size:18px")}>→</span>
      </a>

      {/* Le mie case pubblicate */}
      {mieCase.length > 0 && (
        <>
          <SezP titolo="Le mie case" />
          <div style={css("display:flex;flex-direction:column;gap:8px")}>
            {mieCase.map((c) => (
              <div key={c.id} style={css("display:flex;align-items:center;gap:10px;border:2px solid #e5dccb;padding:10px 12px")}>
                <div style={css("min-width:0;flex:1")}>
                  <div style={css("font-size:14px;font-weight:800;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{c.titolo}</div>
                  <div style={css("font-size:12px;color:#736b62;font-weight:600")}>{c.zona} · {c.prezzo} €{c.attivo ? "" : " · nascosto"}</div>
                </div>
                <button onClick={() => eliminaCasa(c.id)} style={css("flex:none;border:2px solid #a2001d;background:transparent;color:#a2001d;font-family:inherit;font-size:12px;font-weight:800;padding:7px 12px;cursor:pointer")}>Elimina</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dati */}
      <SezP titolo="I tuoi dati" />
      <div style={css("display:flex;flex-direction:column;gap:12px")}>
        <div style={css("display:flex;gap:10px")}>
          <input style={css(inCampo)} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input style={css(inCampo)} placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} />
        </div>
        <div style={css("display:flex;gap:10px")}>
          <input style={css(inCampo + ";flex:0 0 90px")} placeholder="Età" inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value)} />
          <input style={css(inCampo + ";flex:1")} placeholder="Corso di laurea" value={corso} onChange={(e) => setCorso(e.target.value)} />
        </div>
        <LabelP testo="Sede principale" />
        <select style={css(inCampo)} value={sede} onChange={(e) => setSede(e.target.value)}>
          <option value="">— scegli —</option>
          {SEDI_UNIBO.map((s) => <option key={s.key} value={s.nome}>{s.nome}</option>)}
        </select>
        <LabelP testo="Zona preferita" />
        <select style={css(inCampo)} value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">Indifferente</option>
          {[...ZONE_BOLOGNA].sort().map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <LabelP testo={`Budget massimo ${budget ? `· ${budget} €/mese` : ""}`} />
        <input type="range" min={250} max={800} step={10} value={budget || "450"} onChange={(e) => setBudget(e.target.value)} style={css("width:100%;accent-color:#a2001d")} />
        <LabelP testo="Due righe su di te" />
        <textarea style={css(inCampo + ";height:auto;padding:10px 12px;resize:vertical;min-height:70px")} placeholder="Chi sei, cosa cerchi in una casa..." value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>

      {/* Abitudini a categorie */}
      <SezP titolo="Abitudini e preferenze" />
      <div style={css("display:flex;flex-direction:column;gap:14px")}>
        {ABIT_CATEGORIE.map((cat) => (
          <div key={cat.titolo}>
            <div style={css("font-size:12px;font-weight:800;color:#1b1815;margin-bottom:7px")}>{cat.titolo}</div>
            <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
              {cat.voci.map((v) => {
                const on = abit.includes(v);
                return (
                  <button key={v} onClick={() => toggle(v)} style={css(`border:2px solid ${on ? "#a2001d" : "#e5dccb"};background:${on ? "rgba(162,0,29,.08)" : "transparent"};color:${on ? "#a2001d" : "#736b62"};padding:7px 11px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer`)}>{v}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={salva} disabled={salvando} style={css(`margin-top:24px;width:100%;height:54px;border:0;background:${salvato ? "#2e7d5b" : "#a2001d"};color:#faf3e7;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer`)}>
        {salvando ? "Salvo…" : salvato ? "✓ Profilo salvato" : "Salva profilo"}
      </button>
      <button onClick={onLogout} style={css("margin-top:10px;width:100%;height:46px;border:2px solid #1b1815;background:transparent;color:#1b1815;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer")}>
        Esci
      </button>
    </div>
  );
}

function SezP({ titolo }: { titolo: string }) {
  return (
    <div style={css("display:flex;align-items:center;gap:10px;margin:26px 0 14px")}>
      <span style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e")}>{titolo}</span>
      <span style={css("height:2px;flex:1;background:#e5dccb")} />
    </div>
  );
}
function LabelP({ testo }: { testo: string }) {
  return <div style={css("font-size:12px;font-weight:700;color:#736b62;margin:2px 0 -4px")}>{testo}</div>;
}
