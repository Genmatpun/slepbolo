"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Registra il service worker e propone l'installazione dell'app.
 * - Android/Chrome: pulsante "Installa" nativo (beforeinstallprompt).
 * - iPhone/Safari: istruzioni per "Aggiungi a Home" (Apple non espone il prompt).
 */
export function PwaInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostraIos, setMostraIos] = useState(false);
  const [chiuso, setChiuso] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error proprietà Safari iOS
      window.navigator.standalone === true;
    if (standalone) return;

    if (localStorage.getItem("slepbolo-install-chiuso") === "1") {
      setChiuso(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS: nessun beforeinstallprompt, riconosciamo Safari su iPhone/iPad.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|android/i.test(ua);
    if (isIos && isSafari) setMostraIos(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function chiudi() {
    setChiuso(true);
    localStorage.setItem("slepbolo-install-chiuso", "1");
  }

  async function installa() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  if (chiuso || (!prompt && !mostraIos)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4">
      <div className="mx-auto flex max-w-[560px] items-center gap-3 rounded-[--radius-lg] border border-linea bg-carta p-3.5 shadow-[var(--shadow-alta)]">
        <div className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-[12px] bg-rosso">
          <span className="text-[15px] font-extrabold tracking-[-0.04em] text-crema">SB</span>
        </div>
        <div className="min-w-0 flex-1">
          <b className="block text-[14px]">Installa SLEPBOLO sul telefono</b>
          <span className="text-[12.5px] text-grigio">
            {prompt
              ? "Icona sulla home, si apre a schermo intero come un'app."
              : "Tocca Condividi e poi «Aggiungi a Home»."}
          </span>
        </div>
        {prompt ? (
          <button
            onClick={installa}
            className="flex-shrink-0 rounded-[--radius-pill] bg-rosso px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-rosso-scuro"
          >
            Installa
          </button>
        ) : null}
        <button
          onClick={chiudi}
          aria-label="Chiudi"
          className="flex-shrink-0 rounded-full px-2 py-1 text-grigio hover:text-inchiostro"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
