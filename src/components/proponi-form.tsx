"use client";

import { useState } from "react";
import { Field, inputClass, ChipToggle } from "@/components/field";
import { Button } from "@/components/ui/button";
import { ZONE_BOLOGNA, GENERI_CASA, TIPI_STANZA } from "@/lib/constants";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";

const SERVIZI = ["Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Lavastoviglie", "Aria condizionata", "Ammessi animali", "Si può fumare", "Bici/garage"];
const CONTRATTI = ["Registrato — studenti (3+2)", "Registrato — transitorio", "Da concordare"];
const CAUZIONI = ["1 mensilità", "2 mensilità", "Nessuna"];

interface Coinq { nome: string; eta: string; corso: string }

export function ProponiForm() {
  const [titolo, setTitolo] = useState("");
  const [zona, setZona] = useState<string>(ZONE_BOLOGNA[0]);
  const [via, setVia] = useState("");
  const [piano, setPiano] = useState("");
  const [genere, setGenere] = useState<string>("misto");
  const [tot, setTot] = useState(3);
  const [occ, setOcc] = useState(2);
  const [tipo, setTipo] = useState<string>("singola");
  const [prezzo, setPrezzo] = useState(380);
  const [speseIncl, setSpeseIncl] = useState(true);
  const [speseStim, setSpeseStim] = useState(50);
  const [dal, setDal] = useState("2026-09-01");
  const [permanenza, setPermanenza] = useState(6);
  const [cauzione, setCauzione] = useState(CAUZIONI[0]);
  const [contratto, setContratto] = useState(CONTRATTI[0]);
  const [descrizione, setDescrizione] = useState("");
  const [servizi, setServizi] = useState<string[]>(["Wi-Fi", "Lavatrice", "Arredata"]);
  const [coinq, setCoinq] = useState<Coinq[]>([]);
  const [cNome, setCNome] = useState("");
  const [cTel, setCTel] = useState("");
  const [cWa, setCWa] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNote, setCNote] = useState("");

  const [nomeC, setNomeC] = useState("");
  const [etaC, setEtaC] = useState("");
  const [corsoC, setCorsoC] = useState("");

  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState(false);

  const libere = Math.max(0, tot - occ);
  const occValide = occ >= 0 && occ < tot;

  function aggiungiCoinq() {
    if (!nomeC.trim()) return;
    setCoinq((p) => [...p, { nome: nomeC.trim(), eta: etaC, corso: corsoC.trim() }]);
    setNomeC(""); setEtaC(""); setCorsoC("");
  }

  function err(m: string) {
    setErrore(m);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function invia() {
    setErrore(null);
    if (!titolo.trim()) return err("Manca il titolo dell'annuncio.");
    if (!via.trim()) return err("Manca la via (serve per la mappa).");
    if (!occValide) return err("Le camere occupate devono essere meno di quelle totali (almeno una libera).");
    if (!prezzo || prezzo <= 0) return err("Inserisci l'affitto mensile.");
    if (!cTel && !cWa && !cEmail) return err("Metti almeno un contatto: telefono, WhatsApp o email.");
    if (!supabaseConfigurato()) return err("Invio non disponibile in questo momento.");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return err("Sessione scaduta: torna all'app e accedi di nuovo.");

    setInvio(true);
    const dati = {
      titolo: titolo.trim(), zona, via, piano, genere,
      camere_totali: tot, camere_occupate: occ,
      tipo, prezzo, spese_incluse: speseIncl, spese_stimate: speseIncl ? null : speseStim,
      disponibile_dal: dal, permanenza_minima_mesi: permanenza, cauzione, contratto,
      servizi, descrizione,
      coinquilini: coinq,
      contatto_nome: cNome, contatto_telefono: cTel, contatto_whatsapp: cWa, contatto_email: cEmail, contatto_note: cNote,
    };
    const { error } = await supabase.from("richieste").insert({ submitted_by: user.id, dati });
    setInvio(false);
    if (error) return err("Errore nell'invio: " + error.message);
    setFatto(true);
  }

  if (fatto) {
    return (
      <div className="border-2 border-verde bg-verde/[0.08] p-8 text-center">
        <div className="text-[22px] font-black text-verde">Richiesta inviata!</div>
        <p className="mx-auto mt-2 max-w-[44ch] text-[15px] text-inchiostro/80">
          La controlliamo e la pubblichiamo a breve. Grazie: così aiuti altri studenti a trovare casa.
        </p>
        <Button asChild className="mt-5"><a href="/app">Torna all&apos;app</a></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {errore && (
        <p className="border-2 border-rosso bg-rosso/[0.06] p-3 text-[13.5px] font-bold text-rosso">{errore}</p>
      )}
      <p className="-mb-3 text-[12.5px] text-grigio">I campi con <span className="font-bold text-rosso">*</span> sono obbligatori.</p>
      <Sez titolo="La casa" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titolo *" wide><input className={inputClass} value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Singola in trilocale a Zamboni" /></Field>
        <Field label="Zona *"><select className={inputClass} value={zona} onChange={(e) => setZona(e.target.value)}>{[...ZONE_BOLOGNA].sort().map((z) => <option key={z}>{z}</option>)}</select></Field>
        <Field label="Via * (senza civico)"><input className={inputClass} value={via} onChange={(e) => setVia(e.target.value)} placeholder="Es. Via Mascarella" /></Field>
        <Field label="Camere totali"><input type="number" min={1} max={12} className={inputClass} value={tot} onChange={(e) => setTot(Number(e.target.value))} /></Field>
        <Field label="Camere occupate" errore={!occValide ? "Almeno una libera" : undefined}><input type="number" min={0} max={tot - 1} className={inputClass} value={occ} onChange={(e) => setOcc(Number(e.target.value))} /></Field>
        <Field label="Piano / ascensore" wide><input className={inputClass} value={piano} onChange={(e) => setPiano(e.target.value)} /></Field>
        <Field label="Casa di" wide>
          <div className="flex flex-wrap gap-1.5">
            {GENERI_CASA.filter((g) => g.value !== "indifferente").map((g) => (
              <ChipToggle key={g.value} attivo={genere === g.value} onClick={() => setGenere(g.value)}>{g.value === "misto" ? "Ragazzi e ragazze" : `Solo ${g.label.toLowerCase()}`}</ChipToggle>
            ))}
          </div>
        </Field>
      </div>

      <Sez titolo="Stanza e prezzo" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo stanza"><div className="flex gap-1.5">{TIPI_STANZA.map((t) => <ChipToggle key={t.value} attivo={tipo === t.value} onClick={() => setTipo(t.value)}>{t.label}</ChipToggle>)}</div></Field>
        <Field label="Affitto/mese (a persona) *"><input type="number" className={inputClass} value={prezzo} onChange={(e) => setPrezzo(Number(e.target.value))} /></Field>
        <Field label="Spese"><label className="flex items-center gap-2.5 py-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-rosso" checked={speseIncl} onChange={(e) => setSpeseIncl(e.target.checked)} /> Incluse</label></Field>
        {!speseIncl && <Field label="Spese stimate (€)"><input type="number" className={inputClass} value={speseStim} onChange={(e) => setSpeseStim(Number(e.target.value))} /></Field>}
        <Field label="Disponibile dal"><input type="date" className={inputClass} value={dal} onChange={(e) => setDal(e.target.value)} /></Field>
        <Field label="Permanenza minima"><select className={inputClass} value={permanenza} onChange={(e) => setPermanenza(Number(e.target.value))}><option value={3}>3 mesi</option><option value={6}>6 mesi</option><option value={12}>12 mesi</option></select></Field>
        <Field label="Cauzione"><select className={inputClass} value={cauzione} onChange={(e) => setCauzione(e.target.value)}>{CAUZIONI.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Contratto"><select className={inputClass} value={contratto} onChange={(e) => setContratto(e.target.value)}>{CONTRATTI.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>

      <Sez titolo="Chi ci abita già" />
      {coinq.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {coinq.map((c, i) => (
            <div key={i} className="flex items-center gap-2 border-2 border-linea px-3 py-2 text-sm">
              <b>{c.nome}</b><span className="text-grigio">{c.eta && `${c.eta} · `}{c.corso}</span>
              <button onClick={() => setCoinq(coinq.filter((_, j) => j !== i))} className="text-grigio hover:text-rosso">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_90px_1fr_auto] sm:items-end">
        <Field label="Nome"><input className={inputClass} value={nomeC} onChange={(e) => setNomeC(e.target.value)} /></Field>
        <Field label="Età"><input className={inputClass} value={etaC} onChange={(e) => setEtaC(e.target.value)} inputMode="numeric" /></Field>
        <Field label="Corso"><input className={inputClass} value={corsoC} onChange={(e) => setCorsoC(e.target.value)} /></Field>
        <Button variant="ghost" size="sm" onClick={aggiungiCoinq} className="h-[46px]">Aggiungi</Button>
      </div>

      <Sez titolo="I tuoi contatti" />
      <p className="-mt-4 text-[13px] text-grigio">Chi cerca casa ti contatterà direttamente qui. <span className="font-bold text-rosso">Almeno uno *</span> (telefono, WhatsApp o email).</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome referente"><input className={inputClass} value={cNome} onChange={(e) => setCNome(e.target.value)} /></Field>
        <Field label="Telefono"><input className={inputClass} value={cTel} onChange={(e) => setCTel(e.target.value)} placeholder="+39 ..." /></Field>
        <Field label="WhatsApp (se diverso)"><input className={inputClass} value={cWa} onChange={(e) => setCWa(e.target.value)} /></Field>
        <Field label="Email"><input className={inputClass} value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></Field>
        <Field label="Note" wide><input className={inputClass} value={cNote} onChange={(e) => setCNote(e.target.value)} placeholder="Es. scrivere di sera" /></Field>
      </div>

      <Sez titolo="Descrizione e servizi" />
      <Field label="Descrizione"><textarea rows={4} className={`${inputClass} resize-y`} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Com'è la casa, cosa cercate in un coinquilino..." /></Field>
      <div className="flex flex-wrap gap-1.5">{SERVIZI.map((s) => <ChipToggle key={s} attivo={servizi.includes(s)} onClick={() => setServizi((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}>{s}</ChipToggle>)}</div>

      <div className="border-t-2 border-inchiostro pt-5 text-right">
        <Button onClick={invia} disabled={invio} size="lg">{invio ? "Invio…" : "Invia proposta"}</Button>
        <p className="mt-2 text-[12.5px] text-grigio">{libere} {libere === 1 ? "camera libera" : "camere libere"} · verrà controllata prima di essere pubblicata.</p>
      </div>
    </div>
  );
}

function Sez({ titolo }: { titolo: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-arancio">{titolo}</h2>
      <div className="h-[2px] flex-1 bg-linea" />
    </div>
  );
}
