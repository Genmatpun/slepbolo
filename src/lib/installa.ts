import { useSyncExternalStore } from "react";

/**
 * Stato condiviso dell'installazione dell'app (PWA).
 *
 * Il browser lancia `beforeinstallprompt` UNA volta, e quell'evento si può
 * usare per UNA sola richiesta di installazione. Se il banner in basso e il
 * pulsante della home lo catturassero ciascuno per conto suo, il secondo tocco
 * fallirebbe in silenzio. Qui c'è un solo ascoltatore e tutti leggono da lui.
 *
 * L'ascoltatore si registra quando il modulo viene caricato, non al montaggio
 * di un componente: l'evento arriva presto e un componente montato dopo lo
 * perderebbe.
 */

type EventoInstallazione = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let evento: EventoInstallazione | null = null;
let appenaInstallata = false;
const iscritti = new Set<() => void>();
const avvisa = () => iscritti.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // niente mini-barra automatica: decidiamo noi quando proporlo
    evento = e as EventoInstallazione;
    avvisa();
  });
  window.addEventListener("appinstalled", () => {
    evento = null;
    appenaInstallata = true;
    avvisa();
  });
}

function iscriviti(f: () => void) {
  iscritti.add(f);
  return () => iscritti.delete(f);
}

export type Piattaforma = "iphone" | "android" | "desktop";

function rilevaPiattaforma(): Piattaforma {
  const ua = navigator.userAgent;
  // iPadOS si presenta come un Mac: lo riconosciamo dallo schermo touch.
  const ipad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || ipad) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function aperturaDaApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Su iPhone solo Safari mostra "Aggiungi a Home" in modo affidabile. */
function safariSuIphone(): boolean {
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/crios|fxios|edgios|opios|android/i.test(ua);
}

export type StatoInstallazione = {
  piattaforma: Piattaforma;
  /** true = il browser offre l'installazione con un tocco (Chrome/Edge). */
  unTocco: boolean;
  /** true = si sta già usando l'app installata, o è stata appena installata. */
  installata: boolean;
  /** Solo iPhone: false se è aperto in Chrome/Firefox invece che in Safari. */
  safari: boolean;
};

const SERVER: StatoInstallazione = {
  piattaforma: "desktop",
  unTocco: false,
  installata: false,
  safari: true,
};

// useSyncExternalStore confronta le istantanee per identità: ne teniamo una
// in cache e la sostituiamo solo quando cambia qualcosa, sennò React
// ridisegnerebbe all'infinito.
let cache: StatoInstallazione | null = null;
function istantanea(): StatoInstallazione {
  const nuovo: StatoInstallazione = {
    piattaforma: rilevaPiattaforma(),
    unTocco: evento !== null,
    installata: appenaInstallata || aperturaDaApp(),
    safari: safariSuIphone(),
  };
  if (
    cache &&
    cache.piattaforma === nuovo.piattaforma &&
    cache.unTocco === nuovo.unTocco &&
    cache.installata === nuovo.installata &&
    cache.safari === nuovo.safari
  ) {
    return cache;
  }
  cache = nuovo;
  return nuovo;
}

export function useInstallazione(): StatoInstallazione {
  return useSyncExternalStore(iscriviti, istantanea, () => SERVER);
}

/** Apre la finestra di installazione del browser, se disponibile. */
export async function avviaInstallazione(): Promise<"installata" | "annullata" | "non-disponibile"> {
  if (!evento) return "non-disponibile";
  const e = evento;
  evento = null; // consumato: un secondo prompt() sullo stesso evento lancia errore
  avvisa();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === "accepted" ? "installata" : "annullata";
  } catch {
    return "non-disponibile";
  }
}
