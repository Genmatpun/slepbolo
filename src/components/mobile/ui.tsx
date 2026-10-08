"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { C, CAMPO, EASE, css } from "./stile";

// ============================================================
// Pezzi d'interfaccia condivisi dall'app mobile.
// ============================================================

// ---------- Icone ----------
// Disegnate su griglia 24, tratto 2, angoli vivi: lo stesso segno dei
// filetti dell'app. Nessuna emoji al posto delle icone.
const TRACCE: Record<string, ReactNode> = {
  indietro: <path d="M15 5l-7 7 7 7" />,
  avanti: <path d="M9 5l7 7-7 7" />,
  freccia: <path d="M4 12h15M13 6l6 6-6 6" />,
  chiudi: <path d="M6 6l12 12M18 6L6 18" />,
  piu: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  annulla: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  aggiorna: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
  condividi: <path d="M12 3v12M7 8l5-5 5 5M5 13v8h14v-8" />,
  telefono: <path d="M6 3h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 014 5a2 2 0 012-2z" />,
  chat: <path d="M4 5h16v11H9l-5 4V5z" />,
  mail: <path d="M3 6h18v12H3zM3 6l9 7 9-7" />,
  bandiera: <path d="M5 21V4h11l-2 4 2 4H5" />,
  scudo: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-5" />,
  esterno: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  matita: <path d="M4 20h4L20 8l-4-4L4 16v4zM14 6l4 4" />,
  cestino: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />,
  orologio: <path d="M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2" />,
  occhio: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 110 6 3 3 0 010-6z" />,
  lucchetto: <path d="M6 11h12v10H6zM8 11V8a4 4 0 018 0v3" />,
  incolla: <path d="M8 4h8v3H8zM6 5H4v16h16V5h-2M8 12h8M8 16h5" />,
  persona: <path d="M12 4a4 4 0 110 8 4 4 0 010-8zM4 21c1-4 4-6 8-6s7 2 8 6" />,
};

export type NomeIcona = keyof typeof TRACCE;

export function Icona({ nome, size = 20, titolo }: { nome: NomeIcona; size?: number; titolo?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={titolo ? undefined : true}
      role={titolo ? "img" : undefined}
      style={{ flex: "none", display: "block" }}
    >
      {titolo ? <title>{titolo}</title> : null}
      {TRACCE[nome]}
    </svg>
  );
}

// ---------- Titoli e etichette ----------

/** Titolo di sezione: è il titolo, non un'etichetta sopra un titolo. */
export function Sezione({ titolo, extra }: { titolo: string; extra?: ReactNode }) {
  return (
    <h2 style={css("display:flex;align-items:center;gap:10px;margin:28px 0 14px;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:" + C.arancioTesto)}>
      <span>{titolo}</span>
      <span style={css(`height:2px;flex:1;background:${C.linea}`)} />
      {extra}
    </h2>
  );
}

/** Campo con etichetta vera, collegata all'input (non solo il segnaposto). */
export function Campo({
  etichetta,
  aiuto,
  children,
}: {
  etichetta: string;
  aiuto?: string;
  children: (id: string, descritto?: string) => ReactNode;
}) {
  const id = useId();
  const idAiuto = aiuto ? id + "-aiuto" : undefined;
  return (
    <div style={css("display:flex;flex-direction:column;gap:6px;min-width:0")}>
      <label htmlFor={id} style={css(`font-size:13px;font-weight:800;color:${C.ink}`)}>
        {etichetta}
      </label>
      {children(id, idAiuto)}
      {aiuto ? (
        <span id={idAiuto} style={css(`font-size:12.5px;color:${C.grigio};line-height:1.35`)}>
          {aiuto}
        </span>
      ) : null}
    </div>
  );
}

/** Input testuale con etichetta. */
export function CampoTesto({
  etichetta,
  aiuto,
  value,
  onChange,
  ...resto
}: {
  etichetta: string;
  aiuto?: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "style">) {
  return (
    <Campo etichetta={etichetta} aiuto={aiuto}>
      {(id, d) => (
        <input
          id={id}
          aria-describedby={d}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={css(CAMPO)}
          {...resto}
        />
      )}
    </Campo>
  );
}

/** Chip selezionabile (filtro o scelta multipla). */
export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={css(
        `flex:none;min-height:40px;border:2px solid ${on ? C.rosso : C.linea};background:${on ? "rgba(162,0,29,.08)" : "transparent"};color:${on ? C.rosso : C.grigio};padding:0 12px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .18s,color .18s,background .18s`,
      )}
    >
      {children}
    </button>
  );
}

/** Scelta singola a segmenti (es. Libera / In trattativa / Presa). */
export function Segmenti<T extends string>({
  valore,
  opzioni,
  onChange,
  etichetta,
}: {
  valore: T;
  opzioni: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  etichetta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etichetta} style={css("display:flex;gap:0;width:100%")}>
      {opzioni.map((o, i) => {
        const on = o.value === valore;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={css(
              `flex:1;min-height:44px;border:2px solid ${C.ink};${i > 0 ? "margin-left:-2px;" : ""}background:${on ? C.ink : "transparent"};color:${on ? C.crema : C.ink};font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:0 6px`,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Foglio dal basso ----------

/**
 * Pannello che sale dal basso, per conferme e scelte brevi.
 * Esc e il tocco sullo sfondo lo chiudono; il focus entra nel pannello
 * e torna dov'era quando si chiude.
 */
export function Foglio({
  aperto,
  onChiudi,
  titolo,
  children,
}: {
  aperto: boolean;
  onChiudi: () => void;
  titolo: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitolo = useId();

  useEffect(() => {
    if (!aperto) return;
    const prima = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prima?.focus?.();
    };
  }, [aperto, onChiudi]);

  if (!aperto) return null;
  return (
    <div style={css("position:absolute;inset:0;z-index:120;display:flex;flex-direction:column;justify-content:flex-end")}>
      <div
        onClick={onChiudi}
        style={css("position:absolute;inset:0;background:rgba(27,24,21,.45);animation:sbFade .2s ease both")}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitolo}
        tabIndex={-1}
        style={css(
          `position:relative;max-height:88%;overflow:auto;background:${C.crema};border-top:2px solid ${C.ink};padding:20px 20px calc(24px + env(safe-area-inset-bottom));animation:sbSheet .32s ${EASE} both;outline:none`,
        )}
      >
        <div style={css("display:flex;align-items:flex-start;gap:12px;margin-bottom:14px")}>
          <h2 id={idTitolo} style={css("margin:0;flex:1;font-size:21px;font-weight:900;letter-spacing:-.03em;line-height:1.1")}>
            {titolo}
          </h2>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            style={css(`width:44px;height:44px;margin:-10px -10px 0 0;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}
          >
            <Icona nome="chiudi" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Avviso temporaneo ----------

/** Messaggio in basso, sopra la barra delle schede, con un'azione opzionale. */
export function Avviso({
  testo,
  azione,
  onAzione,
}: {
  testo: string;
  azione?: string;
  onAzione?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={css(
        `position:absolute;left:16px;right:16px;bottom:92px;z-index:90;background:${C.ink};color:${C.crema};display:flex;align-items:center;gap:12px;padding:6px 6px 6px 16px;min-height:52px;animation:sbIn .28s ${EASE} both;box-shadow:0 10px 30px rgba(27,24,21,.25)`,
      )}
    >
      <span style={css("flex:1;font-size:14px;font-weight:700")}>{testo}</span>
      {azione && onAzione ? (
        <button
          type="button"
          onClick={onAzione}
          style={css(`min-height:40px;border:2px solid ${C.crema};background:transparent;color:${C.crema};font-family:inherit;font-size:13px;font-weight:800;padding:0 12px;cursor:pointer;display:flex;align-items:center;gap:6px`)}
        >
          <Icona nome="annulla" size={16} />
          {azione}
        </button>
      ) : null}
    </div>
  );
}

/** Riga di stato di un annuncio: "aggiornato oggi" con un pallino colorato per freschezza. */
export function Freschezza({ testo, giorni }: { testo: string; giorni: number }) {
  if (!testo) return null;
  const colore = giorni <= 2 ? C.verde : giorni <= 7 ? C.ambra : C.grigio;
  return (
    <span style={css(`display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:${C.grigio}`)}>
      <span aria-hidden style={css(`width:7px;height:7px;border-radius:99px;background:${colore};flex:none`)} />
      {testo}
    </span>
  );
}
