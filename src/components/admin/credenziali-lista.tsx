"use client";

import { useState } from "react";

export interface Credenziale {
  id: string;
  email: string;
  password: string;
  created_at: string;
}

export function CredenzialiLista({ righe }: { righe: Credenziale[] }) {
  const [mostraTutte, setMostraTutte] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-grigio">
          {righe.length} {righe.length === 1 ? "credenziale salvata" : "credenziali salvate"}
        </p>
        <button
          type="button"
          onClick={() => setMostraTutte((v) => !v)}
          className="border-2 border-inchiostro px-3 py-1.5 text-[12px] font-extrabold uppercase transition hover:bg-inchiostro hover:text-crema"
        >
          {mostraTutte ? "Nascondi password" : "Mostra password"}
        </button>
      </div>

      <div className="flex flex-col divide-y-2 divide-linea border-2 border-inchiostro">
        {righe.map((r) => (
          <Riga key={r.id} riga={r} mostra={mostraTutte} />
        ))}
      </div>
    </div>
  );
}

function Riga({ riga, mostra }: { riga: Credenziale; mostra: boolean }) {
  const [locale, setLocale] = useState(false);
  const visibile = mostra || locale;

  async function copia(testo: string) {
    try {
      await navigator.clipboard.writeText(testo);
    } catch {
      /* clipboard non disponibile */
    }
  }

  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold">{riga.email}</span>
          <button
            type="button"
            onClick={() => copia(riga.email)}
            className="flex-none text-[11px] font-bold uppercase text-grigio hover:text-inchiostro"
          >
            copia
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 truncate border border-linea bg-crema px-2 py-1 font-mono text-[13px]">
            {visibile ? riga.password : "•".repeat(Math.min(riga.password.length, 12))}
          </code>
          <button
            type="button"
            onClick={() => setLocale((v) => !v)}
            className="flex-none text-[11px] font-bold uppercase text-grigio hover:text-inchiostro"
          >
            {visibile ? "nascondi" : "mostra"}
          </button>
          <button
            type="button"
            onClick={() => copia(riga.password)}
            className="flex-none text-[11px] font-bold uppercase text-grigio hover:text-inchiostro"
          >
            copia
          </button>
        </div>
      </div>
      <div className="flex-none text-[12px] text-grigio">
        {new Date(riga.created_at).toLocaleDateString("it-IT")}
      </div>
    </div>
  );
}
