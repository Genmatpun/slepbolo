"use client";

import { useRef, useState, type CSSProperties } from "react";

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
  coinq: { n: string; e: number | null; c: string }[];
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
const ABIT_ALL = ["Non fumo", "Studio a casa", "Rientro tardi", "Cucino spesso", "Ordinato/a", "Ho un animale", "Weekend fuori"];

export function MobileApp({ annunci }: { annunci: MobileAnnuncio[] }) {
  const [screen, setScreen] = useState<"accedi" | "app">("accedi");
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
  const [abit, setAbit] = useState<string[]>(["Non fumo", "Studio a casa", "Ordinato/a"]);

  const sx = useRef(0);
  const py = useRef<number | null>(null);
  const ps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtrati = () =>
    annunci.filter(
      (a) =>
        (!filtri.includes("Spese incluse") || a.speseIncl) &&
        (!filtri.includes("Sotto 400 €") || a.prezzo < 400) &&
        (!filtri.includes("Breve periodo") || a.min <= 3) &&
        (!filtri.includes("Contratto registrato") || a.contratto === "Registrato") &&
        (!filtri.includes("2+ camere libere") || libere(a) >= 2),
    );

  const pool = filtrati();
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
    const a = pool[idx];
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

  const selA = pool[Math.min(selPin, Math.max(0, pool.length - 1))] || annunci[0];

  const row = (a: MobileAnnuncio) => (
    <div
      key={a.id}
      onClick={() => setDetail(a.id)}
      style={css("display:flex;gap:13px;padding:14px 20px;border-top:1px solid #e5dccb;cursor:pointer;background:transparent")}
    >
      <div
        style={css(
          `width:64px;height:64px;flex:none;display:grid;place-items:center;background:${grad(a.id)};color:rgba(255,255,255,.35);font-size:19px;font-weight:900;letter-spacing:-.05em`,
        )}
      >
        {glyph(a)}
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

  const av = (n: string, size: number) =>
    css(
      `width:${size}px;height:${size}px;flex:none;display:grid;place-items:center;background:#1b1815;color:#faf3e7;font-size:${Math.round(size * 0.4)}px;font-weight:800`,
    );

  // ---- projection mappa ----
  const latB = [44.474, 44.528],
    lngB = [11.3, 11.378];
  const px = (p: { lat: number; lng: number }) => {
    const fx = (p.lng - lngB[0]) / (lngB[1] - lngB[0]),
      fy = 1 - (p.lat - latB[0]) / (latB[1] - latB[0]);
    const x = 30 + Math.max(0, Math.min(1, fx)) * (402 - 60);
    const y = 118 + Math.max(0, Math.min(1, fy)) * (600 - 118);
    return `left:${x}px;top:${y}px`;
  };

  const compl = 60 + abit.length * 5;
  const tabDefs: [string, string][] = [
    ["scopri", "Scopri"],
    ["cerca", "Cerca"],
    ["mappa", "Mappa"],
    ["salvati", "Salvati"],
    ["profilo", "Profilo"],
  ];

  const stack = pool.slice(idx, idx + 3);

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
        {/* ---------- ACCEDI ---------- */}
        {screen === "accedi" && (
          <div style={css("position:absolute;inset:0;background:#a2001d;color:#faf3e7;display:flex;flex-direction:column;padding:96px 26px 46px;animation:sbIn .45s ease both")}>
            <div style={css("display:flex;align-items:center;gap:10px")}>
              <div style={css("position:relative;width:38px;height:38px;display:grid;place-items:center;background:#faf3e7;overflow:hidden")}>
                <span style={css("position:relative;z-index:2;font-size:16px;font-weight:900;letter-spacing:-.05em;color:#a2001d")}>SB</span>
                <span style={css("position:absolute;right:-7px;bottom:-8px;width:22px;height:22px;border-radius:99px;background:#e4572e")} />
              </div>
              <div style={css("font-size:20px;font-weight:900;letter-spacing:-.05em")}>
                SLEP<span style={css("color:#e4572e")}>BOLO</span>
              </div>
            </div>
            <div style={css("height:2px;background:rgba(250,243,231,.35);margin:22px 0 0")} />
            <h1 style={css("font-size:46px;line-height:.94;font-weight:900;letter-spacing:-.045em;margin:auto 0 0;max-width:9ch")}>
              Chi abita<br />già in casa.
            </h1>
            <p style={css("font-size:15px;line-height:1.35;color:rgba(250,243,231,.72);margin:16px 0 30px;max-width:26ch")}>
              Stanze a Bologna, viste dal lato dei coinquilini.
            </p>
            <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e;margin-bottom:8px")}>
              Mail istituzionale
            </div>
            <div style={css("display:flex;align-items:center;border-bottom:2px solid rgba(250,243,231,.45);padding-bottom:10px")}>
              <span style={css("font-size:17px;font-weight:600")}>nome.cognome</span>
              <span style={css("font-size:17px;font-weight:600;color:rgba(250,243,231,.55)")}>@studio.unibo.it</span>
              <span style={css("margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:#faf3e7;background:#2e7d5b;padding:4px 8px")}>
                ✓ VERIFICATA
              </span>
            </div>
            <button
              onClick={() => setScreen("app")}
              style={css("margin-top:26px;width:100%;height:56px;border:0;background:#faf3e7;color:#a2001d;font-family:inherit;font-size:16px;font-weight:800;letter-spacing:-.01em;text-align:left;padding:0 20px;display:flex;align-items:center;cursor:pointer")}
            >
              Entra<span style={css("margin-left:auto;font-size:19px")}>→</span>
            </button>
            <div style={css("margin-top:14px;font-size:12px;color:rgba(250,243,231,.6)")}>Solo studenti UniBo. Nessuna agenzia.</div>
          </div>
        )}

        {/* ---------- APP ---------- */}
        {screen === "app" && (
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
                      {Math.max(0, pool.length - idx)} case
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
                        <div>
                          <div style={css("font-size:19px;font-weight:900;letter-spacing:-.03em")}>Hai visto tutto.</div>
                          <div style={css("font-size:13.5px;color:#736b62;margin-top:6px")}>Le case salvate sono nel tab Salvati.</div>
                        </div>
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
                            <div style={css(`position:relative;height:170px;flex:none;display:grid;place-items:center;background:${grad(a.id)}`)}>
                              <span style={css("position:absolute;left:14px;top:14px;background:#faf3e7;padding:5px 10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase")}>
                                {a.zona}
                              </span>
                              <span style={css("font-size:74px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.22)")}>{glyph(a)}</span>
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
                                  <span key={k} style={av(c.n, 26)}>
                                    {c.n[0]}
                                  </span>
                                ))}
                                <span style={css("font-size:12.5px;color:#736b62;font-weight:600")}>
                                  {a.coinq.map((c) => c.n).slice(0, 2).join(", ")}
                                  {a.coinq.length > 2 ? ` +${a.coinq.length - 2}` : ""}
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
                    <button onClick={() => pool[idx] && setDetail(pool[idx].id)} style={css("width:52px;height:52px;border:0;background:#1b1815;color:#faf3e7;font-size:19px;cursor:pointer")}>
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
                    {pool.length} case · ordinate per distanza da Terracini
                  </div>
                  {pool.map((a) => row(a))}
                </div>
              )}

              {/* MAPPA */}
              {tab === "mappa" && (
                <div style={css("height:100%;position:relative;background:#f0e7d6")}>
                  <div style={css("position:absolute;inset:0;background-image:linear-gradient(rgba(27,24,21,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(27,24,21,.07) 1px,transparent 1px);background-size:46px 46px")} />
                  {SEDI.map((s) => (
                    <div key={s.nome} style={css(`position:absolute;${px(s)};transform:translate(-50%,-50%);display:flex;align-items:center;gap:5px;opacity:.75`)}>
                      <span style={css("width:9px;height:9px;background:#1b1815;display:block")} />
                      <span style={css("font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1b1815;white-space:nowrap")}>{s.nome}</span>
                    </div>
                  ))}
                  {pool.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setSelPin(i)}
                      style={css(
                        `position:absolute;${px(a)};transform:translate(-50%,-50%);border:2px solid #1b1815;background:${selA?.id === a.id ? "#a2001d" : "#fffdf9"};color:${selA?.id === a.id ? "#faf3e7" : "#1b1815"};font-family:inherit;font-size:12px;font-weight:800;padding:5px 8px;cursor:pointer;z-index:${selA?.id === a.id ? 20 : 10};transition:background .2s;animation:sbPopPin .3s ease both;animation-delay:${i * 45}ms`,
                      )}
                    >
                      {a.prezzo}€
                    </button>
                  ))}
                  <div style={css("position:absolute;top:62px;left:20px;right:20px;display:flex;align-items:center;gap:10px")}>
                    <h1 style={css("font-size:26px;font-weight:900;letter-spacing:-.045em;margin:0")}>Mappa</h1>
                    <span style={css("font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#736b62;background:#faf3e7;padding:5px 9px")}>
                      {pool.length} case
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
                <div className="sb-noscroll" style={css("height:100%;overflow:auto;padding:62px 0 96px")}>
                  <div style={css("padding:0 20px")}>
                    <h1 style={css("font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1")}>Profilo</h1>
                    <div style={css("height:2px;background:#1b1815;margin:12px 0 18px")} />
                    <div style={css("display:flex;gap:14px;align-items:center")}>
                      <div style={css("width:66px;height:66px;background:#a2001d;color:#faf3e7;display:grid;place-items:center;font-size:24px;font-weight:900;letter-spacing:-.04em")}>MR</div>
                      <div>
                        <div style={css("font-size:22px;font-weight:900;letter-spacing:-.035em;line-height:1.05")}>Marco Rinaldi</div>
                        <div style={css("font-size:13px;color:#736b62;font-weight:600;margin-top:3px")}>Ingegneria informatica · 2º anno</div>
                        <span style={css("display:inline-flex;align-items:center;gap:5px;margin-top:7px;background:rgba(46,125,91,.12);border:1px solid rgba(46,125,91,.3);color:#2e7d5b;font-size:11px;font-weight:800;padding:5px 9px;line-height:1.2;white-space:nowrap")}>
                          ✓ Verificato UniBo
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={css("display:grid;grid-template-columns:1fr 1fr 1fr;border-top:2px solid #1b1815;border-bottom:2px solid #1b1815;margin:20px 0 0")}>
                    <div style={css("padding:14px 16px;border-right:1px solid #e5dccb")}>
                      <div style={css("font-size:24px;font-weight:900;letter-spacing:-.04em")}>450 €</div>
                      <div style={css("font-size:11px;color:#736b62;font-weight:700")}>budget max</div>
                    </div>
                    <div style={css("padding:14px 16px;border-right:1px solid #e5dccb")}>
                      <div style={css("font-size:24px;font-weight:900;letter-spacing:-.04em")}>Terracini</div>
                      <div style={css("font-size:11px;color:#736b62;font-weight:700")}>sede</div>
                    </div>
                    <div style={css("padding:14px 16px")}>
                      <div style={css("font-size:24px;font-weight:900;letter-spacing:-.04em")}>12</div>
                      <div style={css("font-size:11px;color:#736b62;font-weight:700")}>mesi</div>
                    </div>
                  </div>
                  <div style={css("padding:18px 20px 0")}>
                    <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e;margin-bottom:10px")}>Abitudini</div>
                    <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
                      {ABIT_ALL.map((label) => {
                        const on = abit.includes(label);
                        return (
                          <button
                            key={label}
                            onClick={() => setAbit(on ? abit.filter((x) => x !== label) : [...abit, label])}
                            style={css(
                              `border:2px solid ${on ? "#a2001d" : "#e5dccb"};background:${on ? "rgba(162,0,29,.08)" : "transparent"};color:${on ? "#a2001d" : "#736b62"};padding:8px 12px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .18s`,
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div style={css("height:1px;background:#e5dccb;margin:20px 0")} />
                    <div style={css("font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e4572e;margin-bottom:8px")}>Completamento</div>
                    <div style={css("height:10px;background:#e5dccb;overflow:hidden")}>
                      <div style={css(`height:100%;width:${Math.min(100, compl)}%;background:#a2001d;transform-origin:left;animation:sbBar .7s cubic-bezier(.2,.9,.3,1) both;transition:width .3s`)} />
                    </div>
                    <div style={css("font-size:12.5px;color:#736b62;font-weight:600;margin-top:8px")}>
                      Profilo al {Math.min(100, compl)}% · più è completo, più risposte ricevi
                    </div>
                    <button style={css("margin-top:20px;width:100%;height:52px;border:2px solid #1b1815;background:transparent;color:#1b1815;font-family:inherit;font-size:14px;font-weight:800;text-align:left;padding:0 16px;display:flex;align-items:center;cursor:pointer")}>
                      Ho una stanza libera<span style={css("margin-left:auto")}>+</span>
                    </button>
                  </div>
                </div>
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
              <div style={css(`position:relative;height:270px;display:grid;place-items:center;background:${grad(det.id)}`)}>
                <span style={css("font-size:96px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.2)")}>{glyph(det)}</span>
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
                {det.coinq.map((p, k) => (
                  <div key={k} style={css("display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #e5dccb")}>
                    <span style={av(p.n, 42)}>{p.n[0]}</span>
                    <div>
                      <div style={css("font-size:15px;font-weight:800;letter-spacing:-.02em")}>
                        {p.n}
                        {p.e ? `, ${p.e}` : ""}
                      </div>
                      <div style={css("font-size:12.5px;color:#736b62;font-weight:600")}>{p.c}</div>
                    </div>
                  </div>
                ))}
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
            <div style={css("padding:14px 20px 24px;background:#faf3e7;border-top:1px solid #e5dccb")}>
              <button style={css("width:100%;height:56px;border:0;background:#a2001d;color:#faf3e7;font-family:inherit;font-size:16px;font-weight:800;text-align:left;padding:0 20px;display:flex;align-items:center;cursor:pointer")}>
                Scrivi a {det.coinq[0]?.n ?? "la casa"}
                <span style={css("margin-left:auto")}>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
