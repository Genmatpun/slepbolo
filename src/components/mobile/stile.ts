import type { CSSProperties } from "react";

// ============================================================
// Stile dell'app mobile: una sola fonte per i colori.
//
// Gli stili restano stringhe CSS ("a:b;c:d"), come nel resto dell'app,
// ma i colori passano dalle variabili --sb-*, definite una volta in
// TOKENS_CSS. Cambiare un colore = cambiare una riga qui.
// ============================================================

export const PALETTE = {
  ink: "#1b1815",
  testo: "#3a332d",
  grigio: "#736b62",
  spento: "#cfc5b4",
  linea: "#e5dccb",
  sabbia: "#f0e7d6",
  crema: "#faf3e7",
  carta: "#fffdf9",
  fondo: "#e9e2d5",
  rosso: "#a2001d",
  rossoScuro: "#7a0016",
  arancio: "#e4572e",
  arancioTesto: "#b23a17",
  verde: "#2e7d5b",
  ambra: "#e4a11b",
  ambraFondo: "#fdf3dd",
  ambraTesto: "#8a5d00",
  erroreChiaro: "#ffd7c2",
  /** Pallino delle sedi UniBo sulla mappa: blu, per non confondersi con i pin delle case. */
  sede: "#2e5fa3",
} as const;

/**
 * Sfondi delle case senza foto: cinque sfumature calde della palette,
 * scelte in base all'id così la stessa casa ha sempre lo stesso colore.
 */
export const SFONDI_CASA = [
  "linear-gradient(135deg,#a2001d,#e4572e)",
  "linear-gradient(135deg,#e4572e,#f0a868)",
  "linear-gradient(135deg,#7a0016,#a2001d)",
  "linear-gradient(135deg,#b5651d,#e4572e)",
  "linear-gradient(135deg,#8c3b2e,#d9744f)",
] as const;

type Chiave = keyof typeof PALETTE;

const nomeVar = (k: string) => `--sb-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;

/** I colori come riferimenti a variabile: C.rosso === "var(--sb-rosso)". */
export const C = Object.fromEntries(
  Object.keys(PALETTE).map((k) => [k, `var(${nomeVar(k)})`]),
) as Record<Chiave, string>;

/** Dichiarazioni delle variabili, da mettere sul contenitore dell'app. */
export const TOKENS_CSS = Object.entries(PALETTE)
  .map(([k, v]) => `${nomeVar(k)}:${v}`)
  .join(";");

/** Curva d'uscita usata per tutti i movimenti: veloce all'inizio, morbida alla fine. */
export const EASE = "cubic-bezier(.22,1,.36,1)";

/** Converte una stringa CSS "a:b;c:d" in oggetto style React. */
export function css(s: string): CSSProperties {
  const o: Record<string, string> = {};
  for (const decl of s.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) continue;
    // le variabili CSS vanno passate così come sono
    o[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return o as CSSProperties;
}

/** Campo di testo standard, su fondo chiaro. */
export const CAMPO = `width:100%;height:48px;border:2px solid ${C.linea};background:${C.carta};padding:0 12px;font-family:inherit;font-size:16px;font-weight:600;color:${C.ink};outline:none;border-radius:0`;

/** Bottoni: pieno, contorno, scuro. Sempre almeno 44px di altezza. */
export const BOTTONE = {
  pieno: `height:52px;border:0;background:${C.rosso};color:${C.crema};font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;padding:0 18px`,
  scuro: `height:52px;border:0;background:${C.ink};color:${C.crema};font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;padding:0 18px`,
  contorno: `height:48px;border:2px solid ${C.ink};background:transparent;color:${C.ink};font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;padding:0 16px`,
  piccolo: `min-height:44px;border:2px solid ${C.ink};background:transparent;color:${C.ink};font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:0 12px`,
} as const;

/** Formatta un prezzo in euro senza decimali: "1.250 €". */
export function euro(n: number): string {
  return `${new Intl.NumberFormat("it-IT").format(Math.round(n))} €`;
}

/** "1 ottobre" · "15 gen 2027" se non è quest'anno. */
export function dataBreve(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "";
  const stessoAnno = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: stessoAnno ? "long" : "short",
    ...(stessoAnno ? {} : { year: "numeric" }),
  }).format(d);
}

/** Oggi in formato AAAA-MM-GG, nel fuso dell'utente (per i campi data). */
export function oggiISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
