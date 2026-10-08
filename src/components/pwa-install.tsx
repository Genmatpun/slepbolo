"use client";

import { useEffect, useState } from "react";
import { avviaInstallazione, useInstallazione } from "@/lib/installa";

/**
 * Registra il service worker e propone l'installazione dell'app.
 * - Android/Chrome: pulsante "Installa" nativo (beforeinstallprompt).
 * - iPhone/Safari: istruzioni per "Aggiungi a Home" (Apple non espone il prompt).
 *
 * L'evento di installazione arriva da lib/installa.ts, condiviso con la home:
 * se ognuno lo catturasse per sé, il secondo pulsante toccato non farebbe nulla.
 */
export function PwaInstall() {
  const { piattaforma, unTocco, installata, safari } = useInstallazione();
  const [chiuso, setChiuso] = useState(true); // chiuso finché non leggiamo localStorage

  useEffect(() => {
    // In sviluppo il service worker non si registra: serve i file dalla sua
    // cache e nasconde ogni modifica al codice, facendo sembrare rotto quello
    // che invece è solo vecchio. Se ne trova uno rimasto, lo toglie.
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((r) => r.forEach((sw) => sw.unregister()))
          .catch(() => {});
      }
    }
    try {
      setChiuso(localStorage.getItem("slepbolo-install-chiuso") === "1");
    } catch {
      setChiuso(false);
    }
  }, []);

  function chiudi() {
    setChiuso(true);
    try {
      localStorage.setItem("slepbolo-install-chiuso", "1");
    } catch {
      /* modalità privata: pazienza, ricomparirà */
    }
  }

  const mostraIos = piattaforma === "iphone" && safari;
  if (chiuso || installata || (!unTocco && !mostraIos)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4">
      <div className="mx-auto flex max-w-[560px] items-center gap-3 border-2 border-inchiostro bg-carta p-3.5 shadow-[var(--shadow-alta)]">
        <div className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden bg-rosso">
          <span className="text-[15px] font-extrabold tracking-[-0.04em] text-crema">SB</span>
        </div>
        <div className="min-w-0 flex-1">
          <b className="block text-[14px]">Installa SLEPBOLO sul telefono</b>
          <span className="text-[12.5px] text-grigio">
            {unTocco
              ? "Icona sulla home, si apre a schermo intero come un'app."
              : "Tocca Condividi e poi «Aggiungi a Home»."}
          </span>
        </div>
        {unTocco ? (
          <button
            onClick={() => void avviaInstallazione()}
            className="flex-shrink-0 bg-rosso px-4 py-2 text-[13px] font-bold text-white transition hover:bg-rosso-scuro"
          >
            Installa
          </button>
        ) : null}
        <button
          onClick={chiudi}
          aria-label="Chiudi"
          className="flex-shrink-0 px-2 py-1 text-grigio hover:text-inchiostro"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
