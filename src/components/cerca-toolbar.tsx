"use client";

import { useUrlFiltri } from "@/lib/use-url-filtri";
import { cn } from "@/lib/utils";

export function CercaToolbar() {
  const { get, set } = useUrlFiltri();
  const vista = get("vista") === "mappa" ? "mappa" : "griglia";
  const ordina = get("ordina") || "rilevanza";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-[--radius-pill] border border-linea bg-carta p-[3px]">
        {(["griglia", "mappa"] as const).map((v) => (
          <button
            key={v}
            onClick={() => set({ vista: v === "griglia" ? null : v })}
            className={cn(
              "rounded-[--radius-pill] px-4 py-2 text-[13px] font-semibold capitalize transition",
              vista === v ? "bg-inchiostro text-crema" : "text-grigio",
            )}
          >
            {v === "griglia" ? "Griglia" : "Mappa"}
          </button>
        ))}
      </div>

      <select
        value={ordina}
        onChange={(e) => set({ ordina: e.target.value === "rilevanza" ? null : e.target.value })}
        className="rounded-[10px] border-[1.5px] border-linea bg-carta px-3 py-2 text-[13px] font-semibold outline-none focus:border-rosso"
        aria-label="Ordina i risultati"
      >
        <option value="rilevanza">Ordina: consigliati</option>
        <option value="prezzo-asc">Prezzo crescente</option>
        <option value="prezzo-desc">Prezzo decrescente</option>
        <option value="distanza">Più vicini alla sede</option>
      </select>
    </div>
  );
}
