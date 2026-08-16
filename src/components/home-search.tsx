"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZONE_BOLOGNA, SEDI_UNIBO } from "@/lib/constants";
import { Button } from "./ui/button";

export function HomeSearch() {
  const router = useRouter();
  const [zona, setZona] = useState("");
  const [sede, setSede] = useState("");

  function cerca() {
    const p = new URLSearchParams();
    if (zona) p.set("zona", zona);
    if (sede) {
      p.set("sede", sede);
      p.set("ordina", "distanza");
    }
    router.push(`/cerca${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="flex max-w-[920px] flex-wrap items-center gap-1 border-2 border-inchiostro bg-carta p-2">
      <Field label="Zona">
        <select
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          className="w-full appearance-none bg-transparent text-[15px] font-semibold outline-none"
        >
          <option value="">Tutta Bologna</option>
          {[...ZONE_BOLOGNA].sort().map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Field>
      <Divider />
      <Field label="Sede UniBo">
        <select
          value={sede}
          onChange={(e) => setSede(e.target.value)}
          className="w-full appearance-none bg-transparent text-[15px] font-semibold outline-none"
        >
          <option value="">Qualsiasi sede</option>
          {SEDI_UNIBO.map((s) => (
            <option key={s.key} value={s.key}>
              {s.nome}
            </option>
          ))}
        </select>
      </Field>
      <Button onClick={cerca} className="ml-auto">
        Cerca stanze
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 basis-[170px] px-4 py-2.5 transition hover:bg-crema">
      <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-grigio">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="hidden h-[34px] w-px bg-linea sm:block" />;
}
