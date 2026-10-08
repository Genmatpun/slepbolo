"use client";

import type { MobileAnnuncio } from "@/lib/annuncio-mobile";
import { C, EASE, css } from "./stile";

// ============================================================
// Pezzi che esistono solo in SLEPBOLO.
// ============================================================

/** Riepilogo dei coinquilini senza nomi: "2 ragazze · 1 ragazzo". */
export function riepilogoCoinq(coinq: { g: string }[]): string {
  const f = coinq.filter((c) => c.g === "ragazza").length;
  const m = coinq.filter((c) => c.g === "ragazzo").length;
  const altro = coinq.length - f - m;
  const parti: string[] = [];
  if (f) parti.push(`${f} ${f === 1 ? "ragazza" : "ragazze"}`);
  if (m) parti.push(`${m} ${m === 1 ? "ragazzo" : "ragazzi"}`);
  if (altro) parti.push(`${altro} ${altro === 1 ? "persona" : "persone"}`);
  return parti.join(" · ") || "Ancora nessuno";
}

/** Camere libere (righe "libera"), in trattativa, e le altre occupate. */
export function conteggioCamere(a: MobileAnnuncio) {
  const libere = a.stanze.filter((s) => s.stato === "libera").length;
  const trattativa = a.stanze.filter((s) => s.stato === "in_trattativa").length;
  const tot = Math.max(a.tot, libere + trattativa);
  return { tot, libere, trattativa, occupate: tot - libere - trattativa };
}

/** "1 camera libera su 4 · 2 posti" · "In trattativa". */
export function etichettaCamere(a: MobileAnnuncio): string {
  const { tot, libere, trattativa } = conteggioCamere(a);
  if (libere === 0 && trattativa > 0) return `In trattativa · ${tot} camere`;
  const base = libere === 1 ? `1 camera libera su ${tot}` : `${libere} camere libere su ${tot}`;
  return a.liberi > libere ? `${base} · ${a.liberi} posti letto` : base;
}

/**
 * I quadratini: una casella per camera. Verde = libera, ambra = in
 * trattativa, sabbia = già occupata. Lo stato della casa in un'occhiata.
 */
export function Quadratini({ a, size = 12 }: { a: MobileAnnuncio; size?: number }) {
  const { tot, libere, trattativa, occupate } = conteggioCamere(a);
  const caselle = [
    ...Array<string>(occupate).fill(C.linea),
    ...Array<string>(trattativa).fill(C.ambra),
    ...Array<string>(libere).fill(C.verde),
  ].slice(0, tot);
  return (
    <span aria-hidden style={css("display:inline-flex;gap:" + Math.round(size / 2) + "px;flex:none")}>
      {caselle.map((bg, i) => (
        <span
          key={i}
          style={css(
            `display:block;width:${size}px;height:${size}px;background:${bg};animation:sbPop .36s ${EASE} both;animation-delay:${i * 60}ms`,
          )}
        />
      ))}
    </span>
  );
}

/** Etichetta del genere della casa, solo se dice qualcosa. */
export function etichettaGenereCasa(g: MobileAnnuncio["genere"]): string | null {
  if (g === "ragazze") return "Casa di sole ragazze";
  if (g === "ragazzi") return "Casa di soli ragazzi";
  return null;
}
