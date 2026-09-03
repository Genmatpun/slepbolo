"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { personaCoinquilino } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface Invito {
  id: string;
  genere: string | null;
  eta: number | null;
  corso: string;
  abitudini: string[];
  scadenza: string;
  titolo: string;
  zona: string;
}

function oreRestanti(scadenza: string): string {
  const ms = new Date(scadenza).getTime() - Date.now();
  if (ms <= 0) return "scaduto";
  const ore = Math.floor(ms / 3_600_000);
  const min = Math.floor((ms % 3_600_000) / 60_000);
  if (ore >= 1) return `${ore}h ${min}m`;
  return `${min}m`;
}

export function InvitiLista({ inviti }: { inviti: Invito[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function rispondi(id: string, accetta: boolean) {
    setBusy(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("rispondi_invito", { p_housemate: id, p_accetta: accetta });
    setBusy(null);
    if (error) {
      alert("Errore: " + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {inviti.map((i) => {
        const per = personaCoinquilino(i.genere);
        return (
          <div key={i.id} className="border-2 border-inchiostro bg-crema p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-arancio">Invito</div>
                <h2 className="mt-0.5 text-[19px] font-black leading-tight">{i.titolo}</h2>
                <div className="text-[13px] text-grigio">{i.zona}</div>
              </div>
              <div className="shrink-0 border border-[#e4a11b] bg-[#fdf3dd] px-2.5 py-1 text-center">
                <div className="text-[10px] font-bold uppercase text-[#9a6a00]">Scade tra</div>
                <div className="text-[15px] font-black text-[#9a6a00]">{oreRestanti(i.scadenza)}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-linea pt-3 text-[13.5px]">
              <span className="text-[18px]">{per.emoji}</span>
              <b>{per.label}{i.eta ? `, ${i.eta}` : ""}</b>
              {i.corso ? <span className="text-grigio">· {i.corso}</span> : null}
            </div>
            {i.abitudini.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {i.abitudini.map((x) => (
                  <span key={x} className="border border-linea px-2 py-0.5 text-[11px] text-grigio">{x}</span>
                ))}
              </div>
            )}
            <p className="mt-3 text-[12.5px] text-grigio">Verrai mostrato così nell&apos;annuncio (senza nome). I dati sono presi dal tuo profilo.</p>

            <div className="mt-4 flex gap-2">
              <Button size="sm" disabled={busy === i.id} onClick={() => rispondi(i.id, true)}>
                {busy === i.id ? "…" : "Accetta"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === i.id} onClick={() => rispondi(i.id, false)}>
                Rifiuta
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
