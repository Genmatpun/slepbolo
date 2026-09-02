"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { geocodaVia } from "@/lib/geocoding";
import { Button } from "@/components/ui/button";

interface Coinq { nome: string; eta?: string; corso?: string }
interface Dati {
  titolo: string; zona: string; via: string; piano: string; genere: string;
  camere_totali: number; camere_occupate: number;
  tipo: string; prezzo: number; spese_incluse: boolean; spese_stimate: number | null;
  disponibile_dal: string; permanenza_minima_mesi: number; cauzione: string; contratto: string;
  servizi: string[]; descrizione: string; coinquilini: Coinq[];
  contatto_nome: string; contatto_telefono: string; contatto_whatsapp: string; contatto_email: string; contatto_note: string;
}
interface Richiesta {
  id: string;
  dati: Dati;
  created_at: string;
  submitted_by: string | null;
  proponente: { nome: string | null; cognome: string | null } | null;
}

export function RichiesteLista({ richieste, adminId }: { richieste: Richiesta[]; adminId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function pubblica(r: Richiesta) {
    setBusy(r.id);
    const d = r.dati;
    const supabase = createClient();
    const coord = d.via ? await geocodaVia(d.via, d.zona) : null;
    const { data: apt, error } = await supabase
      .from("apartments")
      .insert({
        host_id: r.submitted_by ?? adminId, // l'annuncio è di chi lo ha proposto
        titolo: d.titolo, descrizione: d.descrizione, zona: d.zona, via: d.via,
        lat: coord?.lat ?? null, lng: coord?.lng ?? null, piano: d.piano, genere: d.genere,
        camere_totali: d.camere_totali, camere_occupate: d.camere_occupate, servizi: d.servizi,
        contratto_tipo: d.contratto, cauzione: d.cauzione,
        contatto_nome: d.contatto_nome || null, contatto_telefono: d.contatto_telefono || null,
        contatto_whatsapp: d.contatto_whatsapp || null, contatto_email: d.contatto_email || null,
        contatto_note: d.contatto_note || null, attivo: true,
      })
      .select("id")
      .single();

    if (error || !apt) { setBusy(null); alert("Errore: " + error?.message); return; }

    const libere = Math.max(0, d.camere_totali - d.camere_occupate);
    if (libere > 0) {
      await supabase.from("rooms").insert(
        Array.from({ length: libere }, () => ({
          apartment_id: apt.id, tipo: d.tipo, prezzo_mensile: d.prezzo,
          spese_incluse: d.spese_incluse, spese_stimate: d.spese_incluse ? null : d.spese_stimate,
          disponibile_dal: d.disponibile_dal, permanenza_minima_mesi: d.permanenza_minima_mesi, stato: "libera",
        })),
      );
    }
    if (d.coinquilini?.length) {
      await supabase.from("housemates").insert(
        d.coinquilini.map((c) => ({ apartment_id: apt.id, nome_visualizzato: c.nome, eta: c.eta ? Number(c.eta) : null, corso: c.corso || null })),
      );
    }
    await supabase.from("richieste").update({ stato: "pubblicato" }).eq("id", r.id);
    setBusy(null);
    router.refresh();
  }

  async function rifiuta(r: Richiesta) {
    if (!confirm("Rifiutare questa proposta?")) return;
    setBusy(r.id);
    await createClient().from("richieste").update({ stato: "rifiutato" }).eq("id", r.id);
    setBusy(null);
    router.refresh();
  }

  if (richieste.length === 0) {
    return <div className="border-2 border-dashed border-linea p-10 text-center text-grigio">Nessuna richiesta in attesa.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {richieste.map((r) => {
        const d = r.dati;
        const libere = Math.max(0, d.camere_totali - d.camere_occupate);
        return (
          <div key={r.id} className="border-2 border-inchiostro">
            <div className="flex flex-wrap items-center gap-2 border-b-2 border-linea p-4">
              <b className="text-[16px]">{d.titolo}</b>
              <span className="text-[13px] text-grigio">{d.zona} · {d.prezzo} €/mese · {libere} {libere === 1 ? "libera" : "libere"}/{d.camere_totali}</span>
              <span className="ml-auto text-[12px] text-grigio">{new Date(r.created_at).toLocaleDateString("it-IT")}</span>
              <span className="w-full text-[12.5px] font-semibold text-arancio">
                Proposto da: {[r.proponente?.nome, r.proponente?.cognome].filter(Boolean).join(" ") || "utente registrato"}
              </span>
            </div>
            <div className="grid gap-3 p-4 text-[13.5px] sm:grid-cols-2">
              <div><b>Via:</b> {d.via || "—"} · {d.piano || "—"}</div>
              <div><b>Contratto:</b> {d.contratto} · Cauzione {d.cauzione}</div>
              <div><b>Contatti:</b> {[d.contatto_nome, d.contatto_telefono, d.contatto_whatsapp, d.contatto_email].filter(Boolean).join(" · ") || "—"}</div>
              <div><b>Coinquilini:</b> {d.coinquilini?.length ? d.coinquilini.map((c) => `${c.nome}${c.eta ? ` (${c.eta})` : ""}`).join(", ") : "—"}</div>
              {d.descrizione && <div className="sm:col-span-2 text-grigio">{d.descrizione}</div>}
              {d.servizi?.length ? <div className="sm:col-span-2 text-grigio">{d.servizi.join(" · ")}</div> : null}
            </div>
            <div className="flex justify-end gap-2 border-t-2 border-linea p-3">
              <button onClick={() => rifiuta(r)} disabled={busy === r.id} className="border-2 border-linea px-4 py-2 text-[13px] font-bold text-grigio hover:border-rosso hover:text-rosso">Rifiuta</button>
              <Button size="sm" onClick={() => pubblica(r)} disabled={busy === r.id}>{busy === r.id ? "…" : "Pubblica"}</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
