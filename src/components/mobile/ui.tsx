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
  domanda: <path d="M12 3a9 9 0 110 18 9 9 0 010-18zM9.5 9.5a2.5 2.5 0 115 0c0 1.8-2.5 2.2-2.5 4M12 16.5v.5" />,
  segnalibro: <path d="M6 3h12v18l-6-4.5L6 21z" />,
  lente: <path d="M10.5 4a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM15.5 15.5L20 20" />,
};

export type NomeIcona = keyof typeof TRACCE;

export function Icona({ nome, size = 20, titolo, pieno = false }: { nome: NomeIcona; size?: number; titolo?: string; pieno?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={pieno ? "currentColor" : "none"}
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
        `flex:none;min-height:44px;border:2px solid ${on ? C.rosso : C.bordo};background:${on ? "rgba(162,0,29,.08)" : "transparent"};color:${on ? C.rosso : C.testo};padding:0 12px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:border-color .18s,color .18s,background .18s`,
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
  const gruppo = useRef<HTMLDivElement>(null);
  // come un gruppo di radio vero: Tab entra sulla scelta attiva, le frecce la cambiano
  const conFrecce = (e: React.KeyboardEvent, i: number) => {
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const j = (i + passo + opzioni.length) % opzioni.length;
    onChange(opzioni[j].value);
    gruppo.current?.querySelectorAll<HTMLButtonElement>("button")[j]?.focus();
  };
  return (
    <div ref={gruppo} role="radiogroup" aria-label={etichetta} style={css("display:flex;gap:0;width:100%")}>
      {opzioni.map((o, i) => {
        const on = o.value === valore;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onKeyDown={(e) => conFrecce(e, i)}
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

// ---------- Schermate e fogli sopra l'app ----------
//
// Tutto ciò che si apre sopra l'app (dettaglio, accesso, pubblica, fogli
// dal basso) sta in una sola pila e segue la stessa regola: Esc e il tasto
// Indietro del telefono chiudono quello in cima, Tab resta dentro, e alla
// chiusura il focus torna dov'era.

interface Voce {
  chiudi: () => void;
  el: () => HTMLElement | null;
  /** ha ancora la sua voce nella cronologia del browser */
  inCronologia: boolean;
}
const pila: Voce[] = [];
let popDaSaltare = 0;
let vociDaTogliere = 0;
let inAscolto = false;

const FOCUSABILI =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Toglie dalla cronologia le voci delle schermate chiuse a mano, tutte insieme. */
function togliVoce() {
  vociDaTogliere += 1;
  queueMicrotask(() => {
    if (!vociDaTogliere) return;
    const n = vociDaTogliere;
    vociDaTogliere = 0;
    popDaSaltare += 1;
    window.history.go(-n);
  });
}

function avviaAscolto() {
  if (inAscolto) return;
  inAscolto = true;

  window.addEventListener("popstate", () => {
    if (popDaSaltare > 0) {
      popDaSaltare -= 1;
      return;
    }
    const cima = pila[pila.length - 1];
    if (!cima) return;
    cima.inCronologia = false;
    cima.chiudi();
    // chi è in cima può decidere di restare aperto (es. chiede conferma):
    // in quel caso si riprende la sua voce, così Indietro funziona ancora
    window.setTimeout(() => {
      if (pila.includes(cima) && !cima.inCronologia) {
        window.history.pushState({ sbSchermo: 1 }, "");
        cima.inCronologia = true;
      }
    }, 80);
  });

  document.addEventListener("keydown", (e) => {
    const cima = pila[pila.length - 1];
    if (!cima) return;
    if (e.key === "Escape") {
      e.preventDefault();
      cima.chiudi();
      return;
    }
    if (e.key !== "Tab") return;
    const el = cima.el();
    if (!el) return;
    const dentro = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABILI)).filter((x) => x.getClientRects().length > 0);
    if (!dentro.length) {
      e.preventDefault();
      el.focus();
      return;
    }
    const primo = dentro[0];
    const ultimo = dentro[dentro.length - 1];
    const attivo = document.activeElement as HTMLElement | null;
    if (!attivo || !el.contains(attivo)) {
      e.preventDefault();
      (e.shiftKey ? ultimo : primo).focus();
    } else if (!e.shiftKey && attivo === ultimo) {
      e.preventDefault();
      primo.focus();
    } else if (e.shiftKey && (attivo === primo || attivo === el)) {
      e.preventDefault();
      ultimo.focus();
    }
  });
}

/**
 * Da usare in ogni schermata o foglio che copre l'app. Restituisce il ref
 * da mettere sul contenitore (con tabIndex={-1}): il focus ci entra
 * all'apertura.
 */
export function useSchermo<T extends HTMLElement = HTMLDivElement>(attivo: boolean, onChiudi: () => void) {
  const ref = useRef<T>(null);
  const chiudi = useRef(onChiudi);
  useEffect(() => {
    chiudi.current = onChiudi;
  }, [onChiudi]);

  useEffect(() => {
    if (!attivo) return;
    avviaAscolto();
    const prima = document.activeElement as HTMLElement | null;
    const voce: Voce = { chiudi: () => chiudi.current(), el: () => ref.current, inCronologia: true };
    pila.push(voce);
    window.history.pushState({ sbSchermo: 1 }, "");
    ref.current?.focus({ preventScroll: true });
    return () => {
      const i = pila.indexOf(voce);
      if (i >= 0) pila.splice(i, 1);
      if (voce.inCronologia) togliVoce();
      prima?.focus?.({ preventScroll: true });
    };
  }, [attivo]);

  return ref;
}

// ---------- Foglio dal basso ----------

/**
 * Pannello che sale dal basso, per conferme e scelte brevi. Il tocco sullo
 * sfondo lo chiude; Esc, Indietro e focus li gestisce useSchermo.
 * `piede` resta sempre visibile in fondo (i pulsanti di conferma).
 */
export function Foglio({
  aperto,
  onChiudi,
  titolo,
  piede,
  children,
}: {
  aperto: boolean;
  onChiudi: () => void;
  titolo: string;
  piede?: ReactNode;
  children: ReactNode;
}) {
  const ref = useSchermo(aperto, onChiudi);
  const idTitolo = useId();

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
          `position:relative;max-height:88%;display:flex;flex-direction:column;background:${C.crema};border-top:2px solid ${C.ink};animation:sbSheet .32s ${EASE} both;outline:none`,
        )}
      >
        <div style={css("display:flex;align-items:flex-start;gap:12px;padding:20px 20px 14px;flex:none")}>
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
        <div
          style={css(`flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 20px ${piede ? "16px" : "calc(24px + env(safe-area-inset-bottom))"}`)}
        >
          {children}
        </div>
        {piede ? (
          <div style={css(`flex:none;border-top:2px solid ${C.ink};background:${C.crema};padding:12px 20px calc(14px + env(safe-area-inset-bottom))`)}>
            {piede}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Avviso temporaneo ----------

/**
 * Messaggio in basso, sopra la barra delle schede, con un'azione opzionale.
 * `alto` lo alza sopra una fila di pulsanti, per non coprirli (Scopri).
 */
export function Avviso({
  testo,
  azione,
  onAzione,
  alto = false,
}: {
  testo: string;
  azione?: string;
  onAzione?: () => void;
  alto?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={css(
        `position:absolute;left:16px;right:16px;bottom:calc(${alto ? 166 : 92}px + env(safe-area-inset-bottom));z-index:90;background:${C.ink};color:${C.crema};display:flex;align-items:center;gap:12px;padding:4px 4px 4px 16px;min-height:52px;animation:sbIn .28s ${EASE} both;box-shadow:0 10px 30px rgba(27,24,21,.25)`,
      )}
    >
      <span style={css("flex:1;font-size:14px;font-weight:700")}>{testo}</span>
      {azione && onAzione ? (
        <button
          type="button"
          onClick={onAzione}
          style={css(`min-height:44px;border:2px solid ${C.crema};background:transparent;color:${C.crema};font-family:inherit;font-size:13px;font-weight:800;padding:0 12px;cursor:pointer;display:flex;align-items:center;gap:6px`)}
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
