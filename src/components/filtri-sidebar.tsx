"use client";

import { useUrlFiltri } from "@/lib/use-url-filtri";
import {
  ZONE_BOLOGNA,
  GENERI_CASA,
  TIPI_STANZA,
  SERVIZI_FILTRO,
  PREZZO_MIN,
  PREZZO_MAX,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const DURATE = [
  { v: "", label: "Tutte" },
  { v: "3", label: "3 mesi" },
  { v: "6", label: "6 mesi" },
  { v: "12", label: "12 mesi" },
];

export function FiltriSidebar() {
  const { get, set, toggleInList } = useUrlFiltri();
  const prezzoMax = Number(get("prezzoMax")) || PREZZO_MAX;
  const serviziSel = get("servizi").split(",").filter(Boolean);

  return (
    <aside className="border-2 border-inchiostro bg-carta p-5 lg:sticky lg:top-[88px]">
      <h3 className="text-[15px] font-bold">Filtri</h3>

      <Group label="Prezzo massimo">
        <input
          type="range"
          min={PREZZO_MIN}
          max={PREZZO_MAX}
          step={10}
          value={prezzoMax}
          onChange={(e) => set({ prezzoMax: e.target.value === String(PREZZO_MAX) ? null : e.target.value })}
          className="w-full accent-rosso"
          aria-label="Prezzo massimo"
        />
        <div className="mt-1.5 flex justify-between text-[13px] font-bold">
          <span>{PREZZO_MIN} €</span>
          <span className="text-rosso">{prezzoMax} €</span>
        </div>
      </Group>

      <Group label="Zona">
        <select
          value={get("zona")}
          onChange={(e) => set({ zona: e.target.value || null })}
          className="w-full border-2 border-linea bg-crema px-3 py-2.5 text-sm font-semibold outline-none focus:border-inchiostro"
        >
          <option value="">Tutte le zone</option>
          {[...ZONE_BOLOGNA].sort().map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Group>

      <Group label="Casa per">
        <Chips
          options={GENERI_CASA.map((g) => ({
            v: g.value === "indifferente" ? "" : g.value,
            label: g.label,
          }))}
          value={get("casaPer")}
          onPick={(v) => set({ casaPer: v || null })}
        />
      </Group>

      <Group label="Tipo di stanza">
        <Chips
          options={[{ v: "", label: "Tutte" }, ...TIPI_STANZA.map((t) => ({ v: t.value, label: t.label }))]}
          value={get("tipo")}
          onPick={(v) => set({ tipo: v || null })}
        />
      </Group>

      <Group label="Durata minima">
        <Chips
          options={DURATE}
          value={get("durata")}
          onPick={(v) => set({ durata: v || null })}
        />
      </Group>

      <Group label="Deve avere">
        <div className="flex flex-col">
          {SERVIZI_FILTRO.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2.5 py-[5px] text-sm">
              <input
                type="checkbox"
                checked={serviziSel.includes(s)}
                onChange={() => toggleInList("servizi", s)}
                className="h-4 w-4 accent-rosso"
              />
              {s}
            </label>
          ))}
        </div>
      </Group>

      <Group label="Fiducia" last>
        <label className="flex cursor-pointer items-center gap-2.5 py-[5px] text-sm">
          <input
            type="checkbox"
            checked={get("verificati") === "1"}
            onChange={(e) => set({ verificati: e.target.checked ? "1" : null })}
            className="h-4 w-4 accent-rosso"
          />
          Solo profili verificati UniBo
        </label>
      </Group>

      <button
        onClick={() => set(Object.fromEntries(RESET))}
        className="mt-3.5 text-[13px] font-semibold text-rosso underline"
      >
        Azzera tutti i filtri
      </button>
    </aside>
  );
}

const RESET: [string, null][] = [
  ["prezzoMax", null],
  ["zona", null],
  ["casaPer", null],
  ["tipo", null],
  ["durata", null],
  ["servizi", null],
  ["verificati", null],
];

function Group({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("py-4", !last && "border-b border-linea")}>
      <label className="mb-2.5 block text-[12px] font-bold uppercase tracking-[0.06em] text-grigio">
        {label}
      </label>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onPick,
}: {
  options: { v: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.v || (o.v === "" && value === "");
        return (
          <button
            key={o.v || "all"}
            onClick={() => onPick(o.v)}
            className={cn(
              "border-2 px-3 py-[7px] text-[13px] font-bold transition",
              on
                ? "border-inchiostro bg-inchiostro text-crema"
                : "border-linea bg-crema hover:border-grigio",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
