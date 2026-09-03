"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputClass, ChipToggle } from "@/components/field";
import { Button } from "@/components/ui/button";
import { RoomsIndicator } from "@/components/rooms-indicator";
import { ZONE_BOLOGNA, GENERI_CASA, TIPI_STANZA, GENERI_COINQUILINO, ABITUDINI, personaCoinquilino } from "@/lib/constants";
import { geocodaVia } from "@/lib/geocoding";
import { createClient } from "@/lib/supabase/client";
import type { Annuncio } from "@/lib/types";

const SERVIZI = [
  "Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Lavastoviglie",
  "Aria condizionata", "Ammessi animali", "Si può fumare", "Bici/garage",
];
const CONTRATTI = ["Registrato — studenti (3+2)", "Registrato — transitorio", "Da concordare"];
const CAUZIONI = ["1 mensilità", "2 mensilità", "Nessuna"];

interface Coinq { genere: string; eta: string; corso: string; abitudini: string[] }

export function AdminForm({ initial }: { initial?: Annuncio }) {
  const router = useRouter();
  const room0 = initial?.rooms.find((r) => r.stato === "libera");

  const [titolo, setTitolo] = useState(initial?.titolo ?? "");
  const [zona, setZona] = useState(initial?.zona ?? ZONE_BOLOGNA[0]);
  const [via, setVia] = useState(initial?.via ?? "");
  const [piano, setPiano] = useState(initial?.piano ?? "");
  const [genere, setGenere] = useState(initial?.genere ?? "misto");
  const [tot, setTot] = useState(initial?.camere_totali ?? 3);
  const [occ, setOcc] = useState(initial?.camere_occupate ?? 2);
  const [tipo, setTipo] = useState(room0?.tipo ?? "singola");
  const [prezzo, setPrezzo] = useState(room0?.prezzo_mensile ?? 380);
  const [speseIncl, setSpeseIncl] = useState(room0?.spese_incluse ?? true);
  const [speseStim, setSpeseStim] = useState(room0?.spese_stimate ?? 50);
  const [dal, setDal] = useState(room0?.disponibile_dal ?? "2026-09-01");
  const [permanenza, setPermanenza] = useState(room0?.permanenza_minima_mesi ?? 6);
  const [cauzione, setCauzione] = useState(initial?.cauzione ?? CAUZIONI[0]);
  const [contratto, setContratto] = useState(initial?.contratto_tipo ?? CONTRATTI[0]);
  const [descrizione, setDescrizione] = useState(initial?.descrizione ?? "");
  const [servizi, setServizi] = useState<string[]>(initial?.servizi ?? ["Wi-Fi", "Lavatrice", "Arredata"]);
  // Solo i coinquilini "manuali" (non collegati a un profilo): quelli invitati si gestiscono a parte.
  const [coinq, setCoinq] = useState<Coinq[]>(
    initial?.housemates.filter((h) => !h.profile_id).map((h) => ({ genere: h.genere ?? "ragazza", eta: h.eta ? String(h.eta) : "", corso: h.corso ?? "", abitudini: h.abitudini ?? [] })) ?? [],
  );
  const [invitati, setInvitati] = useState<string[]>([]);
  const [emailC, setEmailC] = useState("");
  const [cNome, setCNome] = useState(initial?.contatto_nome ?? "");
  const [cTel, setCTel] = useState(initial?.contatto_telefono ?? "");
  const [cWa, setCWa] = useState(initial?.contatto_whatsapp ?? "");
  const [cEmail, setCEmail] = useState(initial?.contatto_email ?? "");
  const [cNote, setCNote] = useState(initial?.contatto_note ?? "");
  const [attivo, setAttivo] = useState(initial?.attivo ?? true);

  const [fotoEsistenti, setFotoEsistenti] = useState<string[]>(initial?.foto_urls ?? []);
  const [nuoveFoto, setNuoveFoto] = useState<File[]>([]);

  const [genereC, setGenereC] = useState<string>("ragazza");
  const [etaC, setEtaC] = useState("");
  const [corsoC, setCorsoC] = useState("");
  const [abitC, setAbitC] = useState<string[]>([]);

  const [fase, setFase] = useState("");
  const [errore, setErrore] = useState<string | null>(null);

  const libere = Math.max(0, tot - occ);
  const occValide = occ >= 0 && occ < tot;

  function toggleServ(s: string) {
    setServizi((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }
  function aggiungiCoinq() {
    setCoinq((p) => [...p, { genere: genereC, eta: etaC, corso: corsoC.trim(), abitudini: abitC }]);
    setGenereC("ragazza"); setEtaC(""); setCorsoC(""); setAbitC([]);
  }

  async function salva() {
    setErrore(null);
    if (!titolo.trim()) return setErrore("Serve un titolo.");
    if (!occValide) return setErrore("Deve restare almeno una camera libera.");
    if (!cTel && !cWa && !cEmail) return setErrore("Metti almeno un contatto (telefono, WhatsApp o email).");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setErrore("Sessione scaduta, riaccedi.");

    setFase("Localizzo la via…");
    const coord = via ? await geocodaVia(via, zona) : null;

    const payload = {
      host_id: initial?.host_id ?? user.id, // in modifica mantiene il proprietario originale
      titolo: titolo.trim(),
      descrizione,
      zona,
      via,
      lat: coord?.lat ?? initial?.lat ?? null,
      lng: coord?.lng ?? initial?.lng ?? null,
      piano,
      genere,
      camere_totali: tot,
      camere_occupate: occ,
      servizi,
      contratto_tipo: contratto,
      cauzione,
      contatto_nome: cNome || null,
      contatto_telefono: cTel || null,
      contatto_whatsapp: cWa || null,
      contatto_email: cEmail || null,
      contatto_note: cNote || null,
      attivo,
    };

    setFase("Salvo l'annuncio…");
    let aptId = initial?.id;
    if (initial) {
      const { error } = await supabase.from("apartments").update(payload).eq("id", initial.id);
      if (error) return setErrore("Errore nel salvataggio: " + error.message), setFase("");
      // ricreo stanze e SOLO i coinquilini manuali (gli invitati collegati restano)
      await supabase.from("rooms").delete().eq("apartment_id", initial.id);
      await supabase.from("housemates").delete().eq("apartment_id", initial.id).is("profile_id", null);
    } else {
      const { data, error } = await supabase.from("apartments").insert(payload).select("id").single();
      if (error || !data) return setErrore("Errore nel salvataggio: " + (error?.message ?? "")), setFase("");
      aptId = data.id as string;
    }

    // Foto
    if (nuoveFoto.length && aptId) {
      setFase("Carico le foto…");
      const urls = [...fotoEsistenti];
      for (const file of nuoveFoto) {
        const path = `${user.id}/${aptId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("foto").upload(path, file, { upsert: true });
        if (!upErr) urls.push(supabase.storage.from("foto").getPublicUrl(path).data.publicUrl);
      }
      await supabase.from("apartments").update({ foto_urls: urls }).eq("id", aptId);
    } else if (initial && aptId) {
      await supabase.from("apartments").update({ foto_urls: fotoEsistenti }).eq("id", aptId);
    }

    // Stanze libere
    if (aptId && libere > 0) {
      await supabase.from("rooms").insert(
        Array.from({ length: libere }, () => ({
          apartment_id: aptId,
          tipo,
          prezzo_mensile: prezzo,
          spese_incluse: speseIncl,
          spese_stimate: speseIncl ? null : speseStim,
          disponibile_dal: dal,
          permanenza_minima_mesi: permanenza,
          stato: "libera",
        })),
      );
    }
    // Coinquilini manuali
    if (aptId && coinq.length) {
      await supabase.from("housemates").insert(
        coinq.map((c) => ({
          apartment_id: aptId,
          nome_visualizzato: null,
          genere: c.genere,
          eta: c.eta ? Number(c.eta) : null,
          corso: c.corso || null,
          abitudini: c.abitudini,
        })),
      );
    }

    // Coinquilini invitati per mail UniBo (compaiono subito, hanno 24h per accettare)
    if (aptId && invitati.length) {
      setFase("Invito i coinquilini…");
      const nonTrovate: string[] = [];
      for (const em of invitati) {
        const { data: res } = await supabase.rpc("invita_coinquilino", { p_apartment: aptId, p_email: em });
        if (res && res !== "ok" && res !== "gia_presente") nonTrovate.push(em);
      }
      if (nonTrovate.length) {
        alert("Salvato. Questi non risultano iscritti a SLEPBOLO e NON sono stati aggiunti:\n" + nonTrovate.join("\n"));
      }
    }

    setFase("");
    router.push("/admin");
    router.refresh();
  }

  async function elimina() {
    if (!initial) return;
    if (!confirm("Eliminare definitivamente questo annuncio?")) return;
    const supabase = createClient();
    await supabase.from("apartments").delete().eq("id", initial.id);
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <Sez titolo="L'appartamento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titolo annuncio" wide>
            <input className={inputClass} value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Singola in trilocale a Zamboni" />
          </Field>
          <Field label="Zona">
            <select className={inputClass} value={zona} onChange={(e) => setZona(e.target.value)}>
              {[...ZONE_BOLOGNA].sort().map((z) => <option key={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Via" hint="senza civico">
            <input className={inputClass} value={via} onChange={(e) => setVia(e.target.value)} placeholder="Es. Via Mascarella" />
          </Field>
          <Field label="Camere totali">
            <input type="number" min={1} max={12} className={inputClass} value={tot} onChange={(e) => setTot(Number(e.target.value))} />
          </Field>
          <Field label="Camere occupate" errore={!occValide ? "Deve restare almeno una libera" : undefined}>
            <input type="number" min={0} max={tot - 1} className={inputClass} value={occ} onChange={(e) => setOcc(Number(e.target.value))} />
          </Field>
          <Field label="Piano / ascensore" wide>
            <input className={inputClass} value={piano} onChange={(e) => setPiano(e.target.value)} placeholder="Es. 2° con ascensore" />
          </Field>
          <Field label="Casa di" wide>
            <div className="flex flex-wrap gap-1.5">
              {GENERI_CASA.filter((g) => g.value !== "indifferente").map((g) => (
                <ChipToggle key={g.value} attivo={genere === g.value} onClick={() => setGenere(g.value as typeof genere)}>
                  {g.value === "misto" ? "Ragazzi e ragazze" : `Solo ${g.label.toLowerCase()}`}
                </ChipToggle>
              ))}
            </div>
          </Field>
          {occValide && <div className="sm:col-span-2"><RoomsIndicator totali={tot} libere={libere} /></div>}
        </div>
      </Sez>

      <Sez titolo="Prezzo e stanza libera">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo stanza">
            <div className="flex flex-wrap gap-1.5">
              {TIPI_STANZA.map((t) => (
                <ChipToggle key={t.value} attivo={tipo === t.value} onClick={() => setTipo(t.value as typeof tipo)}>{t.label}</ChipToggle>
              ))}
            </div>
          </Field>
          <Field label="Affitto al mese (a persona)">
            <input type="number" className={inputClass} value={prezzo} onChange={(e) => setPrezzo(Number(e.target.value))} />
          </Field>
          <Field label="Spese">
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-rosso" checked={speseIncl} onChange={(e) => setSpeseIncl(e.target.checked)} /> Incluse nel prezzo
            </label>
          </Field>
          {!speseIncl && (
            <Field label="Spese stimate (€/mese)">
              <input type="number" className={inputClass} value={speseStim} onChange={(e) => setSpeseStim(Number(e.target.value))} />
            </Field>
          )}
          <Field label="Disponibile dal">
            <input type="date" className={inputClass} value={dal} onChange={(e) => setDal(e.target.value)} />
          </Field>
          <Field label="Permanenza minima">
            <select className={inputClass} value={permanenza} onChange={(e) => setPermanenza(Number(e.target.value))}>
              <option value={3}>3 mesi</option><option value={6}>6 mesi</option><option value={12}>12 mesi</option>
            </select>
          </Field>
          <Field label="Cauzione">
            <select className={inputClass} value={cauzione} onChange={(e) => setCauzione(e.target.value)}>{CAUZIONI.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Contratto">
            <select className={inputClass} value={contratto} onChange={(e) => setContratto(e.target.value)}>{CONTRATTI.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
      </Sez>

      <Sez titolo="Chi ci abita già">
        <p className="mb-3 text-[13px] text-grigio">Per privacy niente nomi: solo genere, età, corso e stile di vita. Non serve che siano iscritti.</p>
        {coinq.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {coinq.map((c, i) => (
              <div key={i} className="flex items-center gap-2 border-2 border-linea px-3 py-2 text-sm">
                <b>{personaCoinquilino(c.genere).label}</b>
                <span className="text-grigio">{c.eta && `${c.eta} · `}{c.corso}{c.abitudini.length ? ` · ${c.abitudini.join(", ")}` : ""}</span>
                <button onClick={() => setCoinq(coinq.filter((_, j) => j !== i))} className="text-grigio hover:text-rosso">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Genere">
            <div className="flex flex-wrap gap-1.5">
              {GENERI_COINQUILINO.map((g) => (
                <ChipToggle key={g.value} attivo={genereC === g.value} onClick={() => setGenereC(g.value)}>{g.label}</ChipToggle>
              ))}
            </div>
          </Field>
          <Field label="Età"><input className={inputClass} value={etaC} onChange={(e) => setEtaC(e.target.value)} inputMode="numeric" /></Field>
          <Field label="Corso" wide><input className={inputClass} value={corsoC} onChange={(e) => setCorsoC(e.target.value)} /></Field>
          <Field label="Stile di vita" wide>
            <div className="flex flex-wrap gap-1.5">
              {ABITUDINI.map((a) => (
                <ChipToggle key={a} attivo={abitC.includes(a)} onClick={() => setAbitC((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a])}>{a}</ChipToggle>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-2 text-right">
          <Button variant="ghost" size="sm" onClick={aggiungiCoinq}>+ Aggiungi coinquilino</Button>
        </div>

        <div className="mt-6 border-t border-linea pt-4">
          <p className="mb-2 text-[13px] text-grigio"><b>Oppure invita un coinquilino registrato</b> con la sua mail UniBo: comparirà subito nell&apos;annuncio e avrà 24h per accettare (dati presi dal suo profilo).</p>
          {invitati.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {invitati.map((em, i) => (
                <div key={i} className="flex items-center gap-2 border-2 border-linea px-3 py-2 text-sm">
                  <b>{em}</b>
                  <button onClick={() => setInvitati(invitati.filter((_, j) => j !== i))} className="text-grigio hover:text-rosso">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Mail UniBo del coinquilino"><input className={inputClass} value={emailC} type="email" onChange={(e) => setEmailC(e.target.value)} placeholder="nome.cognome@studio.unibo.it" /></Field>
            <Button variant="ghost" size="sm" onClick={() => { const v = emailC.trim().toLowerCase(); if (v.includes("@") && !invitati.includes(v)) { setInvitati((p) => [...p, v]); setEmailC(""); } }}>+ Invita</Button>
          </div>
        </div>
      </Sez>

      <Sez titolo="Contatti dell'host">
        <p className="mb-3 text-[13px] text-grigio">Chi cerca vede questi recapiti per contattarti direttamente. Metti almeno uno.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome referente"><input className={inputClass} value={cNome} onChange={(e) => setCNome(e.target.value)} placeholder="Es. Giulia" /></Field>
          <Field label="Telefono"><input className={inputClass} value={cTel} onChange={(e) => setCTel(e.target.value)} placeholder="+39 ..." /></Field>
          <Field label="WhatsApp" hint="se diverso"><input className={inputClass} value={cWa} onChange={(e) => setCWa(e.target.value)} placeholder="+39 ..." /></Field>
          <Field label="Email"><input className={inputClass} value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="nome@email.it" /></Field>
          <Field label="Note per chi contatta" wide><input className={inputClass} value={cNote} onChange={(e) => setCNote(e.target.value)} placeholder="Es. scrivere di sera, no chiamate al mattino" /></Field>
        </div>
      </Sez>

      <Sez titolo="Descrizione e servizi">
        <Field label="Descrizione">
          <textarea rows={5} className={`${inputClass} resize-y`} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Com'è la casa, che aria si respira, cosa cercate in un coinquilino..." />
        </Field>
        <div className="mt-4">
          <div className="mb-2 text-[12.5px] font-bold">Cosa c&apos;è in casa</div>
          <div className="flex flex-wrap gap-1.5">
            {SERVIZI.map((s) => <ChipToggle key={s} attivo={servizi.includes(s)} onClick={() => toggleServ(s)}>{s}</ChipToggle>)}
          </div>
        </div>
      </Sez>

      <Sez titolo="Foto">
        {fotoEsistenti.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {fotoEsistenti.map((u) => (
              <div key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-20 w-20 border-2 border-inchiostro object-cover" />
                <button onClick={() => setFotoEsistenti(fotoEsistenti.filter((x) => x !== u))} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center bg-inchiostro text-[11px] text-crema">✕</button>
              </div>
            ))}
          </div>
        )}
        <input type="file" accept="image/*" multiple onChange={(e) => setNuoveFoto([...(e.target.files ?? [])])} className="text-sm" />
        {nuoveFoto.length > 0 && <div className="mt-2 text-[13px] text-grigio">{nuoveFoto.length} foto da caricare al salvataggio</div>}
      </Sez>

      <Sez titolo="Pubblicazione">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-rosso" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
          Visibile nella ricerca (togli la spunta per nasconderlo)
        </label>
      </Sez>

      {errore && <p className="border-2 border-rosso bg-rosso/[0.06] p-3 text-[13px] font-semibold text-rosso">{errore}</p>}

      <div className="flex items-center justify-between gap-3 border-t-2 border-inchiostro pt-5">
        {initial ? (
          <button onClick={elimina} className="text-[13px] font-bold text-rosso underline">Elimina annuncio</button>
        ) : <span />}
        <Button onClick={salva} disabled={!!fase} size="lg">
          {fase || (initial ? "Salva modifiche" : "Pubblica appartamento")}
        </Button>
      </div>
    </div>
  );
}

function Sez({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-arancio">{titolo}</h2>
        <div className="h-[2px] flex-1 bg-linea" />
      </div>
      {children}
    </section>
  );
}
