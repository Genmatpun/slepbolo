"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { geocodaVia } from "@/lib/geocoding";
import {
  ABIT_CATEGORIE,
  CAPARRE,
  CONTRATTI,
  GENERI_COINQUILINO,
  PREFERENZE_CASA,
  SERVIZI_CASA,
  SPESE_VOCI,
  ZONE_BOLOGNA,
  personaCoinquilino,
} from "@/lib/constants";
import type { AnnuncioEstratto, RispostaEstrazione } from "@/lib/estrazione";
import type { AnnuncioPrivato, Housemate, Room, StatoStanza } from "@/lib/types";
import { BOTTONE, C, CAMPO, EASE, css, euro, oggiISO } from "./stile";
import { Campo, CampoTesto, Chip, Foglio, Icona, Segmenti } from "./ui";

// ============================================================
// Pubblica una casa — dentro l'app, a passi.
//
// Si parte incollando il messaggio che si è già scritto per WhatsApp:
// il modulo si riempie da solo, e la persona controlla ogni passo prima
// di pubblicare. Oppure si compila a mano.
// In modifica le stanze esistenti tengono il loro stato (libera, in
// trattativa, presa): niente più "cancella tutto e ricrea".
// ============================================================

interface StanzaForm {
  /** id della riga in rooms, se esiste già */
  id: string | null;
  stato: StatoStanza;
  tipo: "singola" | "doppia";
  posti: number;
  prezzo: string;
  speseIncl: boolean;
  spese: string;
  speseComprendono: string[];
  dal: string;
  fino: string;
  min: number;
  nota: string;
}

interface CoinqForm {
  genere: string;
  eta: string;
  corso: string;
  abitudini: string[];
}

const nuovaStanza = (): StanzaForm => ({
  id: null,
  stato: "libera",
  tipo: "singola",
  posti: 1,
  prezzo: "",
  speseIncl: false,
  spese: "",
  speseComprendono: [],
  dal: oggiISO(),
  fino: "",
  min: 6,
  nota: "",
});

const PASSI = ["Inizia", "La casa", "Le stanze", "Chi ci abita", "Condizioni", "Contatti", "Controlla"] as const;

const GENERI_CASA_SCELTA = [
  { value: "misto", label: "Mista" },
  { value: "ragazze", label: "Solo ragazze" },
  { value: "ragazzi", label: "Solo ragazzi" },
] as const;

export function Pubblica({
  userId,
  modificaId,
  onChiudi,
}: {
  userId: string;
  modificaId: string | null;
  /** pubblicato = true se qualcosa è andato online o è cambiato */
  onChiudi: (pubblicato: boolean) => void;
}) {
  const modifica = !!modificaId;
  const [passo, setPasso] = useState(modifica ? 1 : 0);
  const [carico, setCarico] = useState(modifica);
  const [errori, setErrori] = useState<string[]>([]);
  const [avvisoEstrazione, setAvvisoEstrazione] = useState<string | null>(null);

  // casa
  const [zona, setZona] = useState<string>("");
  const [via, setVia] = useState("");
  const [piano, setPiano] = useState("");
  const [bagni, setBagni] = useState("");
  const [tot, setTot] = useState("3");
  const [genere, setGenere] = useState<"misto" | "ragazze" | "ragazzi">("misto");
  const [servizi, setServizi] = useState<string[]>([]);
  // stanze
  const [stanze, setStanze] = useState<StanzaForm[]>([nuovaStanza()]);
  const [stanzeEliminate, setStanzeEliminate] = useState<string[]>([]);
  // coinquilini
  const [coinq, setCoinq] = useState<CoinqForm[]>([]);
  const [inviti, setInviti] = useState<string[]>([]);
  const [mailInvito, setMailInvito] = useState("");
  const [abitPer, setAbitPer] = useState<number | null>(null);
  // condizioni
  const [titolo, setTitolo] = useState("");
  const [titoloToccato, setTitoloToccato] = useState(false);
  const [contratto, setContratto] = useState<string>("");
  const [agenzia, setAgenzia] = useState(false);
  const [senzaContratto, setSenzaContratto] = useState(false);
  const [caparra, setCaparra] = useState<string>("");
  const [preferenze, setPreferenze] = useState<string[]>([]);
  const [vicinoA, setVicinoA] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [linkFoto, setLinkFoto] = useState("");
  const [fotoEsistenti, setFotoEsistenti] = useState<string[]>([]);
  const [nuoveFoto, setNuoveFoto] = useState<File[]>([]);
  // contatti
  const [cNome, setCNome] = useState("");
  const [cTel, setCTel] = useState("");
  const [cWa, setCWa] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNote, setCNote] = useState("");
  const [coordEsatte, setCoordEsatte] = useState<{ lat: number; lng: number } | null>(null);
  const viaIniziale = useRef("");
  // In modifica può entrare anche un coinquilino confermato: gestisce stanze e
  // descrizione, ma contatti e via restano quelli di chi ha pubblicato.
  const [hostId, setHostId] = useState<string | null>(null);
  const sonoHost = !modifica || hostId === null || hostId === userId;

  // incolla
  const [incollato, setIncollato] = useState("");
  const [estraggo, setEstraggo] = useState(false);
  // invio
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState<null | { nonIscritti: string[] }>(null);

  const scorri = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scorri.current?.scrollTo({ top: 0 });
  }, [passo]);

  // ---------- modifica: carico l'annuncio ----------
  useEffect(() => {
    if (!modificaId || !supabaseConfigurato()) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("apartments").select("*, rooms(*), housemates(*)").eq("id", modificaId).single(),
      supabase.from("annunci_privati").select("*").eq("apartment_id", modificaId).maybeSingle(),
    ]).then(([a, p]) => {
      if (a.error || !a.data) {
        setErrori(["Non riesco a caricare l'annuncio. Torna indietro e riprova."]);
        setCarico(false);
        return;
      }
      const d = a.data as Record<string, unknown> & { rooms: Room[]; housemates: Housemate[] };
      setHostId((d.host_id as string) ?? null);
      setZona((d.zona as string) ?? "");
      setPiano((d.piano as string) ?? "");
      setBagni(d.bagni ? String(d.bagni) : "");
      setTot(String(d.camere_totali ?? 3));
      setGenere(d.genere === "ragazze" || d.genere === "ragazzi" ? d.genere : "misto");
      setServizi((d.servizi as string[]) ?? []);
      setTitolo((d.titolo as string) ?? "");
      setTitoloToccato(true);
      setContratto((d.contratto_tipo as string) ?? "");
      setAgenzia(!!d.tramite_agenzia);
      setCaparra((d.cauzione as string) ?? "");
      setPreferenze((d.preferenze as string[]) ?? []);
      setVicinoA((d.vicino_a as string) ?? "");
      setDescrizione((d.descrizione as string) ?? "");
      setLinkFoto((d.link_foto as string) ?? "");
      setFotoEsistenti((d.foto_urls as string[]) ?? []);
      setStanze(
        d.rooms.length
          ? d.rooms.map((r) => ({
              id: r.id,
              stato: r.stato,
              tipo: r.tipo,
              posti: r.posti_liberi ?? 1,
              prezzo: String(r.prezzo_mensile),
              speseIncl: r.spese_incluse,
              spese: r.spese_stimate ? String(r.spese_stimate) : "",
              speseComprendono: r.spese_comprendono ?? [],
              dal: r.disponibile_dal ?? oggiISO(),
              fino: r.disponibile_fino ?? "",
              min: r.permanenza_minima_mesi,
              nota: r.nota ?? "",
            }))
          : [nuovaStanza()],
      );
      setCoinq(
        d.housemates
          .filter((h) => !h.profile_id)
          .map((h) => ({ genere: h.genere ?? "ragazza", eta: h.eta ? String(h.eta) : "", corso: h.corso ?? "", abitudini: h.abitudini ?? [] })),
      );
      const priv = p.data as AnnuncioPrivato | null;
      if (priv) {
        setVia(priv.via ?? "");
        viaIniziale.current = priv.via ?? "";
        setCNome(priv.contatto_nome ?? "");
        setCTel(priv.contatto_telefono ?? "");
        setCWa(priv.contatto_whatsapp ?? "");
        setCEmail(priv.contatto_email ?? "");
        setCNote(priv.contatto_note ?? "");
        if (priv.lat && priv.lng) setCoordEsatte({ lat: priv.lat, lng: priv.lng });
      }
      setCarico(false);
    });
  }, [modificaId]);

  // titolo suggerito finché la persona non lo scrive lei
  const titoloSuggerito = useMemo(() => {
    const s = stanze.filter((x) => x.stato !== "occupata");
    if (!zona || !s.length) return "";
    const prima = s[0];
    const cosa =
      s.length > 1
        ? s.every((x) => x.tipo === "singola")
          ? `${s.length} singole`
          : `${s.length} stanze`
        : prima.tipo === "doppia"
          ? prima.posti >= 2
            ? `${prima.posti} posti in doppia`
            : "Posto letto in doppia"
          : "Singola";
    return `${cosa} in ${zona}`.slice(0, 60);
  }, [stanze, zona]);
  const titoloFinale = titoloToccato ? titolo : titoloSuggerito;

  // ---------- incolla da WhatsApp ----------
  async function compilaDaTesto() {
    setErrori([]);
    setAvvisoEstrazione(null);
    setEstraggo(true);
    let r: RispostaEstrazione;
    try {
      const res = await fetch("/api/estrai-annuncio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testo: incollato }),
      });
      r = (await res.json()) as RispostaEstrazione;
    } catch {
      r = { ok: false, errore: "Connessione assente. Controlla la rete e riprova." };
    }
    setEstraggo(false);
    if (!r.ok) {
      setErrori([r.errore]);
      return;
    }
    applica(r.dati);
    setPasso(1);
  }

  function applica(d: AnnuncioEstratto) {
    if (d.zona) setZona(d.zona);
    if (d.via) setVia(d.via);
    if (d.piano) setPiano(d.piano);
    if (d.bagni) setBagni(String(d.bagni));
    if (d.genere_casa === "ragazze" || d.genere_casa === "ragazzi" || d.genere_casa === "misto") setGenere(d.genere_casa);
    if (d.servizi.length) setServizi(d.servizi);
    if (d.stanze.length) {
      setStanze(
        d.stanze.map((s) => ({
          ...nuovaStanza(),
          tipo: s.tipo,
          posti: s.posti_liberi,
          prezzo: s.prezzo_mensile ? String(s.prezzo_mensile) : "",
          speseIncl: !!s.spese_incluse,
          spese: s.spese_mensili ? String(s.spese_mensili) : "",
          speseComprendono: s.spese_comprendono,
          dal: s.disponibile_dal && s.disponibile_dal >= oggiISO() ? s.disponibile_dal : oggiISO(),
          fino: s.disponibile_fino ?? "",
          min: s.permanenza_minima_mesi ?? 6,
          nota: s.nota ?? "",
        })),
      );
    }
    const residenti = d.coinquilini.length;
    if (d.camere_totali) setTot(String(d.camere_totali));
    else if (d.stanze.length) setTot(String(Math.max(d.stanze.length + residenti, d.stanze.length + 1)));
    if (residenti) {
      setCoinq(d.coinquilini.map((c) => ({ genere: c.genere ?? "altro", eta: c.eta ? String(c.eta) : "", corso: c.corso ?? "", abitudini: [] })));
    }
    if (d.contratto) setContratto(d.contratto);
    setAgenzia(!!d.tramite_agenzia);
    setSenzaContratto(d.senza_contratto);
    if (d.caparra) setCaparra(d.caparra);
    if (d.preferenze.length) setPreferenze(d.preferenze);
    if (d.vicino_a) setVicinoA(d.vicino_a);
    if (d.link_foto) setLinkFoto(d.link_foto);
    if (d.descrizione) setDescrizione(d.descrizione);
    if (d.titolo) {
      setTitolo(d.titolo);
      setTitoloToccato(true);
    }
    if (d.contatto_nome) setCNome(d.contatto_nome);
    if (d.contatto_telefono) setCTel(d.contatto_telefono);

    const mancano = [
      !d.zona && "la zona",
      !d.via && "la via",
      !d.stanze.some((s) => s.prezzo_mensile) && "il prezzo",
      !residenti && "chi ci abita",
      "le foto",
    ].filter(Boolean) as string[];
    setAvvisoEstrazione(
      `Ho compilato quello che c'era nel messaggio. Controlla ogni passo: mancano ${mancano.join(", ")}.`,
    );
  }

  // ---------- controlli per passo ----------
  const totN = Number(tot) || 0;
  const aperte = stanze.filter((s) => s.stato !== "occupata");

  function controlla(p: number): string[] {
    const e: string[] = [];
    if (p === 1) {
      if (!zona) e.push("Scegli la zona.");
      if (sonoHost && !via.trim()) e.push("Scrivi la via: serve per la mappa, e non la vede nessuno finché non ti scrivono.");
      if (!totN || totN < 1 || totN > 12) e.push("Le camere della casa vanno da 1 a 12.");
    }
    if (p === 2) {
      if (!stanze.length) e.push("Aggiungi almeno una stanza.");
      if (stanze.length > totN) e.push(`Hai descritto ${stanze.length} stanze ma la casa ne ha ${totN}: correggi il numero di camere al passo precedente.`);
      stanze.forEach((s, i) => {
        const n = stanze.length > 1 ? ` (stanza ${i + 1})` : "";
        const prezzo = Number(s.prezzo);
        if (!prezzo || prezzo < 50 || prezzo > 3000) e.push(`Scrivi l'affitto mensile${n}.`);
        if (!s.speseIncl && s.spese && (Number(s.spese) < 1 || Number(s.spese) > 1000)) e.push(`Le spese mensili${n} non sembrano giuste.`);
        if (s.fino && s.fino < s.dal) e.push(`La data di fine${n} viene prima di quella d'inizio.`);
      });
    }
    if (p === 3) {
      coinq.forEach((c, i) => {
        if (c.eta && (Number(c.eta) < 16 || Number(c.eta) > 99)) e.push(`L'età del coinquilino ${i + 1} non sembra giusta.`);
      });
    }
    if (p === 4) {
      if (!titoloFinale.trim()) e.push("Dai un titolo all'annuncio.");
      if (senzaContratto && (!contratto || contratto === "Da definire"))
        e.push("SLEPBOLO non pubblica affitti senza contratto registrato: scegli il tipo di contratto.");
      if (linkFoto && !/^https:\/\//i.test(linkFoto)) e.push("Il link alle foto deve iniziare con https://");
    }
    if (p === 5 && sonoHost) {
      if (!cTel.trim() && !cWa.trim() && !cEmail.trim()) e.push("Lascia almeno un contatto: telefono, WhatsApp o email.");
      if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail)) e.push("L'email non sembra giusta.");
    }
    return e;
  }

  function avanti() {
    const e = controlla(passo);
    setErrori(e);
    if (!e.length) setPasso((p) => Math.min(p + 1, PASSI.length - 1));
  }

  function indietro() {
    setErrori([]);
    if (passo <= (modifica ? 1 : 0)) onChiudi(false);
    else setPasso((p) => p - 1);
  }

  // ---------- pubblica ----------
  async function pubblica() {
    for (let p = 1; p <= 5; p++) {
      const e = controlla(p);
      if (e.length) {
        setErrori(e);
        setPasso(p);
        return;
      }
    }
    if (!supabaseConfigurato()) return setErrori(["Pubblicazione non disponibile in questo momento."]);
    setInvio(true);
    setErrori([]);
    const supabase = createClient();
    const ora = new Date().toISOString();

    // coordinate: le ricalcolo solo se la via è cambiata (e solo chi ha pubblicato può cambiarla)
    let coord = coordEsatte;
    if (sonoHost && (!coord || via.trim() !== viaIniziale.current)) coord = await geocodaVia(via.trim(), zona);

    const occupate = Math.max(0, totN - aperte.length);
    const casa = {
      titolo: titoloFinale.trim(),
      descrizione: descrizione.trim() || null,
      zona,
      // il database le arrotonda da solo: in apartments non finiscono mai esatte
      ...(sonoHost ? { lat: coord?.lat ?? null, lng: coord?.lng ?? null } : {}),
      piano: piano.trim() || null,
      bagni: bagni ? Number(bagni) : null,
      genere,
      camere_totali: totN,
      camere_occupate: Math.min(occupate, totN - 1),
      servizi,
      preferenze,
      vicino_a: vicinoA.trim() || null,
      contratto_tipo: contratto || "Da definire",
      tramite_agenzia: agenzia,
      cauzione: caparra || null,
      link_foto: linkFoto.trim() || null,
      confermato_il: ora,
    };

    let aptId = modificaId;
    if (modificaId) {
      const { error } = await supabase.from("apartments").update(casa).eq("id", modificaId);
      if (error) return fallito("Non sono riuscito a salvare le modifiche. Controlla la connessione e riprova.");
    } else {
      const { data, error } = await supabase
        .from("apartments")
        .insert({ ...casa, host_id: userId, attivo: true })
        .select("id")
        .single();
      if (error || !data) return fallito("Non sono riuscito a pubblicare. Controlla la connessione e riprova.");
      aptId = data.id as string;
    }
    if (!aptId) return fallito("Qualcosa non ha funzionato. Riprova.");

    // contatti, via e coordinate esatte: nella tabella protetta (solo chi ha pubblicato)
    if (sonoHost) {
      const { error: erroreContatti } = await supabase.from("annunci_privati").upsert(
        {
          apartment_id: aptId,
          contatto_nome: cNome.trim() || null,
          contatto_telefono: cTel.trim() || null,
          contatto_whatsapp: cWa.trim() || null,
          contatto_email: cEmail.trim() || null,
          contatto_note: cNote.trim() || null,
          via: via.trim(),
          lat: coord?.lat ?? null,
          lng: coord?.lng ?? null,
        },
        { onConflict: "apartment_id" },
      );
      if (erroreContatti) return fallito("L'annuncio è salvato, ma non i contatti. Aprilo da «Le mie case» e salva di nuovo.");
    }

    // foto
    const urls = [...fotoEsistenti];
    for (const file of nuoveFoto) {
      const path = `${userId}/${aptId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("foto").upload(path, file, { upsert: true });
      if (!error) urls.push(supabase.storage.from("foto").getPublicUrl(path).data.publicUrl);
    }
    await supabase.from("apartments").update({ foto_urls: urls }).eq("id", aptId);

    // stanze: aggiorno quelle che esistono (lo stato resta), aggiungo le nuove, tolgo le eliminate
    const riga = (s: StanzaForm) => ({
      apartment_id: aptId,
      tipo: s.tipo,
      posti_liberi: s.tipo === "doppia" ? s.posti : 1,
      prezzo_mensile: Number(s.prezzo),
      spese_incluse: s.speseIncl,
      spese_stimate: s.speseIncl ? null : s.spese ? Number(s.spese) : null,
      spese_comprendono: s.speseComprendono,
      disponibile_dal: s.dal || null,
      disponibile_fino: s.fino || null,
      permanenza_minima_mesi: s.min,
      nota: s.nota.trim() || null,
    });
    if (stanzeEliminate.length) await supabase.from("rooms").delete().in("id", stanzeEliminate);
    for (const s of stanze.filter((x) => x.id)) {
      await supabase.from("rooms").update(riga(s)).eq("id", s.id as string);
    }
    const nuove = stanze.filter((x) => !x.id);
    if (nuove.length) {
      const { error } = await supabase.from("rooms").insert(nuove.map((s) => ({ ...riga(s), stato: "libera" })));
      if (error) return fallito("L'annuncio è salvato, ma non tutte le stanze. Aprilo da «Le mie case» e controlla.");
    }

    // coinquilini descritti a mano (quelli invitati e confermati restano)
    if (modificaId) await supabase.from("housemates").delete().eq("apartment_id", aptId).is("profile_id", null);
    if (coinq.length) {
      await supabase.from("housemates").insert(
        coinq.map((c) => ({
          apartment_id: aptId,
          nome_visualizzato: null,
          genere: c.genere,
          eta: c.eta ? Number(c.eta) : null,
          corso: c.corso.trim() || null,
          abitudini: c.abitudini,
        })),
      );
    }

    // inviti
    const nonIscritti: string[] = [];
    for (const em of inviti) {
      const { data } = await supabase.rpc("invita_coinquilino", { p_apartment: aptId, p_email: em });
      if (data && data !== "ok" && data !== "gia_presente") nonIscritti.push(em);
    }

    setInvio(false);
    setFatto({ nonIscritti });
  }

  function fallito(m: string) {
    setInvio(false);
    setErrori([m]);
  }

  // ---------- interfaccia ----------
  const progresso = (passo + 1) / PASSI.length;

  if (fatto) {
    return (
      <Guscio titolo={modifica ? "Annuncio aggiornato" : "Annuncio pubblicato"} onChiudi={() => onChiudi(true)}>
        <div style={css("padding:28px 20px;display:flex;flex-direction:column;gap:14px")}>
          <div style={css(`width:56px;height:56px;background:${C.verde};color:${C.crema};display:grid;place-items:center`)}>
            <Icona nome="check" size={30} />
          </div>
          <h2 style={css("margin:0;font-size:28px;font-weight:900;letter-spacing:-.04em;line-height:1.05")}>
            {modifica ? "Fatto: le modifiche sono online." : "È online."}
          </h2>
          <p style={css(`margin:0;font-size:15.5px;line-height:1.5;color:${C.testo}`)}>
            Chi cerca casa lo vede da subito. <b>Ogni tanto conferma che è ancora libera</b> da &laquo;Le mie case&raquo;:
            un annuncio non confermato da 14 giorni sparisce dalla ricerca, così nessuno ti scrive per una stanza già presa.
          </p>
          {fatto.nonIscritti.length > 0 && (
            <div style={css(`border:2px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:12px 14px;font-size:14px;line-height:1.45`)}>
              Questi coinquilini non sono ancora iscritti a SLEPBOLO, quindi non li ho aggiunti: {fatto.nonIscritti.join(", ")}. Quando si iscrivono, invitali di nuovo.
            </div>
          )}
          <button type="button" onClick={() => onChiudi(true)} style={css(`${BOTTONE.scuro};width:100%;margin-top:6px`)}>
            Torna all&apos;app
          </button>
        </div>
      </Guscio>
    );
  }

  return (
    <Guscio
      titolo={modifica ? "Modifica annuncio" : "Pubblica una stanza"}
      onChiudi={() => onChiudi(false)}
      onIndietro={indietro}
      sotto={
        <div>
          <div style={css(`height:4px;background:${C.linea}`)}>
            <div style={css(`height:100%;background:${C.rosso};transform-origin:left;transform:scaleX(${progresso});transition:transform .35s ${EASE}`)} />
          </div>
          <div style={css(`padding:8px 20px 0;font-size:13px;font-weight:700;color:${C.grigio}`)}>
            Passo {passo + 1} di {PASSI.length} · {PASSI[passo]}
          </div>
        </div>
      }
    >
      <div ref={scorri} className="sb-noscroll" style={css("flex:1;overflow:auto;padding:16px 20px 24px")}>
        {carico ? (
          <div aria-busy="true" style={css(`font-size:14px;color:${C.grigio}`)}>Carico l&apos;annuncio…</div>
        ) : (
          <div style={css("display:flex;flex-direction:column;gap:16px")}>
            {errori.length > 0 && (
              <div role="alert" style={css(`border:2px solid ${C.rosso};background:${C.carta};padding:12px 14px`)}>
                {errori.map((e) => (
                  <div key={e} style={css(`font-size:14px;font-weight:700;color:${C.rosso};line-height:1.4`)}>
                    {e}
                  </div>
                ))}
              </div>
            )}
            {avvisoEstrazione && passo > 0 && passo < 6 && (
              <div role="status" style={css(`background:${C.sabbia};padding:12px 14px;font-size:14px;line-height:1.45;color:${C.ink}`)}>
                {avvisoEstrazione}
              </div>
            )}

            {/* 0 · incolla o compila */}
            {passo === 0 && (
              <>
                <h2 style={css("margin:0;font-size:24px;font-weight:900;letter-spacing:-.035em;line-height:1.1")}>
                  Hai già scritto l&apos;annuncio per WhatsApp?
                </h2>
                <p style={css(`margin:0;font-size:15px;line-height:1.5;color:${C.testo}`)}>
                  Incollalo qui: ricavo zona, prezzo, spese, stanze e chi ci abita, e riempio il modulo. Poi controlli tu ogni passo, niente va online senza la tua conferma.
                </p>
                <Campo etichetta="Il tuo messaggio" aiuto={`${incollato.length}/4000`}>
                  {(id, d) => (
                    <textarea
                      id={id}
                      aria-describedby={d}
                      value={incollato}
                      onChange={(e) => setIncollato(e.target.value.slice(0, 4000))}
                      rows={8}
                      placeholder="Es. Si libera una singola in zona Massarenti dal 1 novembre, 335 € + 50 di condominio. In casa siamo due ragazze di Medicina…"
                      style={css(`${CAMPO};height:auto;min-height:180px;padding:12px;resize:vertical;line-height:1.45`)}
                    />
                  )}
                </Campo>
                <button
                  type="button"
                  disabled={estraggo || incollato.trim().length < 20}
                  onClick={compilaDaTesto}
                  style={css(`${BOTTONE.pieno};width:100%;height:54px;display:flex;align-items:center;justify-content:center;gap:10px;opacity:${incollato.trim().length < 20 ? 0.5 : 1}`)}
                >
                  {estraggo ? (
                    <>
                      <span style={css(`width:16px;height:16px;border:2px solid rgba(250,243,231,.4);border-top-color:${C.crema};border-radius:99px;animation:sbSpin .8s linear infinite`)} />
                      Leggo il messaggio…
                    </>
                  ) : (
                    <>
                      <Icona nome="incolla" />
                      Compila per me
                    </>
                  )}
                </button>
                <button type="button" onClick={() => setPasso(1)} style={css(`${BOTTONE.contorno};width:100%`)}>
                  Preferisco compilare a mano
                </button>
              </>
            )}

            {/* 1 · la casa */}
            {passo === 1 && (
              <>
                <Campo etichetta="Zona">
                  {(id) => (
                    <select id={id} value={zona} onChange={(e) => setZona(e.target.value)} style={css(CAMPO)}>
                      <option value="">— scegli la zona —</option>
                      {ZONE_BOLOGNA.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <CampoTesto
                  etichetta="Via e civico"
                  aiuto={
                    sonoHost
                      ? "Non la vede nessuno nella ricerca: sulla mappa la casa compare in una zona approssimata. La via la vede solo chi ti contatta."
                      : "La via la gestisce chi ha pubblicato l'annuncio."
                  }
                  value={via}
                  onChange={setVia}
                  readOnly={!sonoHost}
                  autoComplete="street-address"
                  maxLength={120}
                />
                <div style={css("display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px")}>
                  <CampoTesto etichetta="Camere in tutto" value={tot} onChange={(v) => setTot(v.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
                  <CampoTesto etichetta="Bagni" value={bagni} onChange={(v) => setBagni(v.replace(/\D/g, "").slice(0, 1))} inputMode="numeric" />
                  <CampoTesto etichetta="Piano" value={piano} onChange={setPiano} maxLength={40} placeholder="3°, ascensore" />
                </div>
                <Campo etichetta="La casa è">
                  {() => <Segmenti etichetta="Chi può abitare la casa" valore={genere} opzioni={GENERI_CASA_SCELTA} onChange={setGenere} />}
                </Campo>
                <Campo etichetta="In casa c'è">
                  {() => (
                    <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                      {SERVIZI_CASA.map((s) => (
                        <Chip key={s} on={servizi.includes(s)} onClick={() => setServizi(servizi.includes(s) ? servizi.filter((x) => x !== s) : [...servizi, s])}>
                          {s}
                        </Chip>
                      ))}
                    </div>
                  )}
                </Campo>
              </>
            )}

            {/* 2 · le stanze */}
            {passo === 2 && (
              <>
                <p style={css(`margin:0;font-size:15px;line-height:1.5;color:${C.testo}`)}>
                  Una scheda per ogni stanza da affittare. Se le stanze sono diverse tra loro, descrivile una per una.
                </p>
                {stanze.map((s, i) => (
                  <SchedaStanza
                    key={i}
                    numero={stanze.length > 1 ? i + 1 : null}
                    s={s}
                    onCambia={(nuova) => setStanze(stanze.map((x, j) => (j === i ? nuova : x)))}
                    onDuplica={() => setStanze([...stanze.slice(0, i + 1), { ...s, id: null, stato: "libera" }, ...stanze.slice(i + 1)])}
                    onElimina={
                      stanze.length > 1
                        ? () => {
                            if (s.id) setStanzeEliminate([...stanzeEliminate, s.id]);
                            setStanze(stanze.filter((_, j) => j !== i));
                          }
                        : null
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setStanze([...stanze, nuovaStanza()])}
                  style={css(`${BOTTONE.contorno};width:100%;display:flex;align-items:center;justify-content:center;gap:8px`)}
                >
                  <Icona nome="piu" size={18} />
                  Aggiungi un&apos;altra stanza
                </button>
              </>
            )}

            {/* 3 · chi ci abita */}
            {passo === 3 && (
              <>
                <p style={css(`margin:0;font-size:15px;line-height:1.5;color:${C.testo}`)}>
                  È la cosa che chi cerca guarda per prima. Nessun nome: solo genere, età, corso e abitudini.
                </p>
                {coinq.map((c, i) => (
                  <div key={i} style={css(`border:2px solid ${C.ink};background:${C.carta};padding:14px;display:flex;flex-direction:column;gap:12px`)}>
                    <div style={css("display:flex;align-items:center;gap:10px")}>
                      <span style={css("font-size:15px;font-weight:900;flex:1")}>
                        {personaCoinquilino(c.genere).label}
                        {c.eta ? `, ${c.eta} anni` : ""}
                      </span>
                      <button
                        type="button"
                        aria-label={`Togli il coinquilino ${i + 1}`}
                        onClick={() => setCoinq(coinq.filter((_, j) => j !== i))}
                        style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.rosso};display:grid;place-items:center;cursor:pointer`)}
                      >
                        <Icona nome="cestino" size={18} />
                      </button>
                    </div>
                    <Segmenti
                      etichetta={`Genere del coinquilino ${i + 1}`}
                      valore={c.genere as "ragazza" | "ragazzo" | "altro"}
                      opzioni={GENERI_COINQUILINO}
                      onChange={(v) => setCoinq(coinq.map((x, j) => (j === i ? { ...x, genere: v } : x)))}
                    />
                    <div style={css("display:grid;grid-template-columns:90px 1fr;gap:10px")}>
                      <CampoTesto
                        etichetta="Età"
                        value={c.eta}
                        onChange={(v) => setCoinq(coinq.map((x, j) => (j === i ? { ...x, eta: v.replace(/\D/g, "").slice(0, 2) } : x)))}
                        inputMode="numeric"
                      />
                      <CampoTesto
                        etichetta="Corso"
                        value={c.corso}
                        onChange={(v) => setCoinq(coinq.map((x, j) => (j === i ? { ...x, corso: v } : x)))}
                        maxLength={80}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAbitPer(i)}
                      style={css(`${CAMPO};text-align:left;cursor:pointer;display:flex;align-items:center;gap:8px;height:auto;min-height:48px;padding:8px 12px`)}
                    >
                      <span style={css("flex:1;line-height:1.35")}>{c.abitudini.length ? c.abitudini.join(", ") : "Abitudini (facoltativo)"}</span>
                      <Icona nome="avanti" size={18} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCoinq([...coinq, { genere: "ragazza", eta: "", corso: "", abitudini: [] }])}
                  style={css(`${BOTTONE.contorno};width:100%;display:flex;align-items:center;justify-content:center;gap:8px`)}
                >
                  <Icona nome="piu" size={18} />
                  Aggiungi chi ci abita
                </button>

                <div style={css(`border-top:2px solid ${C.linea};padding-top:16px;display:flex;flex-direction:column;gap:10px`)}>
                  <div style={css("font-size:15px;font-weight:900")}>Il coinquilino è già su SLEPBOLO?</div>
                  <p style={css(`margin:0;font-size:14px;line-height:1.45;color:${C.testo}`)}>
                    Invitalo con la sua mail UniBo: compare con i dati del suo profilo e conferma entro 24 ore. È più credibile di una descrizione.
                  </p>
                  {inviti.map((em) => (
                    <div key={em} style={css(`display:flex;align-items:center;gap:8px;border:2px solid ${C.linea};padding:6px 6px 6px 12px;font-size:14px;font-weight:700`)}>
                      <span style={css("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis")}>{em}</span>
                      <button
                        type="button"
                        aria-label={`Togli l'invito a ${em}`}
                        onClick={() => setInviti(inviti.filter((x) => x !== em))}
                        style={css(`width:40px;height:40px;border:0;background:transparent;color:${C.grigio};display:grid;place-items:center;cursor:pointer`)}
                      >
                        <Icona nome="chiudi" size={16} />
                      </button>
                    </div>
                  ))}
                  <div style={css("display:flex;gap:8px;align-items:flex-end")}>
                    <div style={css("flex:1")}>
                      <CampoTesto
                        etichetta="Mail UniBo del coinquilino"
                        value={mailInvito}
                        onChange={setMailInvito}
                        type="email"
                        autoComplete="off"
                        placeholder="nome.cognome@studio.unibo.it"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const v = mailInvito.trim().toLowerCase();
                        if (/^[^\s@]+@studio\.unibo\.it$/.test(v) && !inviti.includes(v)) {
                          setInviti([...inviti, v]);
                          setMailInvito("");
                          setErrori([]);
                        } else setErrori(["Serve una mail @studio.unibo.it."]);
                      }}
                      style={css(`${BOTTONE.scuro};height:48px`)}
                    >
                      Invita
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 4 · condizioni */}
            {passo === 4 && (
              <>
                <CampoTesto
                  etichetta="Titolo"
                  aiuto="Breve: tipo di stanza e zona."
                  value={titoloFinale}
                  onChange={(v) => {
                    setTitolo(v);
                    setTitoloToccato(true);
                  }}
                  maxLength={80}
                />
                {senzaContratto && (
                  <div role="note" style={css(`border:2px solid ${C.rosso};background:${C.carta};padding:12px 14px;font-size:14px;font-weight:700;line-height:1.45;color:${C.rosso}`)}>
                    Il messaggio parla di un affitto senza contratto. SLEPBOLO pubblica solo affitti con contratto registrato: è una tutela per chi entra e per te.
                  </div>
                )}
                <Campo etichetta="Contratto">
                  {(id) => (
                    <select id={id} value={contratto} onChange={(e) => setContratto(e.target.value)} style={css(CAMPO)}>
                      <option value="">— scegli —</option>
                      {CONTRATTI.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {contratto && !(CONTRATTI as readonly string[]).includes(contratto) && <option value={contratto}>{contratto}</option>}
                    </select>
                  )}
                </Campo>
                <label style={css(`display:flex;align-items:center;gap:12px;min-height:48px;border:2px solid ${agenzia ? C.rosso : C.linea};padding:8px 14px;cursor:pointer;font-size:15px;font-weight:700`)}>
                  <input type="checkbox" checked={agenzia} onChange={(e) => setAgenzia(e.target.checked)} style={css(`width:20px;height:20px;accent-color:${C.rosso}`)} />
                  <span>
                    Il contratto passa da un&apos;agenzia
                    <span style={css(`display:block;font-size:13px;font-weight:600;color:${C.grigio}`)}>Lo scriviamo nell&apos;annuncio, così nessuno ha sorprese.</span>
                  </span>
                </label>
                <Campo etichetta="Caparra">
                  {(id) => (
                    <select id={id} value={caparra} onChange={(e) => setCaparra(e.target.value)} style={css(CAMPO)}>
                      <option value="">— non dirlo ora —</option>
                      {CAPARRE.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {caparra && !(CAPARRE as readonly string[]).includes(caparra) && <option value={caparra}>{caparra}</option>}
                    </select>
                  )}
                </Campo>
                <Campo etichetta="Chi cercate">
                  {() => (
                    <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                      {PREFERENZE_CASA.map((p) => (
                        <Chip
                          key={p.value}
                          on={preferenze.includes(p.value)}
                          onClick={() => setPreferenze(preferenze.includes(p.value) ? preferenze.filter((x) => x !== p.value) : [...preferenze, p.value])}
                        >
                          {p.label}
                        </Chip>
                      ))}
                    </div>
                  )}
                </Campo>
                <CampoTesto
                  etichetta="Cosa c'è vicino"
                  aiuto="Fermate e linee bus, dipartimenti, supermercati."
                  value={vicinoA}
                  onChange={setVicinoA}
                  maxLength={200}
                  placeholder="Bus 19 e 36 sotto casa, 10 minuti da Chimica"
                />
                <Campo etichetta="Descrizione" aiuto={`${descrizione.length}/2000`}>
                  {(id, d) => (
                    <textarea
                      id={id}
                      aria-describedby={d}
                      rows={5}
                      maxLength={2000}
                      value={descrizione}
                      onChange={(e) => setDescrizione(e.target.value)}
                      placeholder="Com'è la casa, com'è la vita in casa, cosa cercate in un coinquilino"
                      style={css(`${CAMPO};height:auto;min-height:120px;padding:12px;resize:vertical;line-height:1.45`)}
                    />
                  )}
                </Campo>

                <Campo etichetta="Foto" aiuto="Gli annunci con foto vere ricevono molte più richieste. Luce naturale, letto fatto.">
                  {() => (
                    <div style={css("display:flex;flex-wrap:wrap;gap:10px")}>
                      {fotoEsistenti.map((u, i) => (
                        <Miniatura key={u} src={u} onTogli={() => setFotoEsistenti(fotoEsistenti.filter((_, j) => j !== i))} />
                      ))}
                      {nuoveFoto.map((f, i) => (
                        <MiniaturaFile key={`${f.name}-${i}`} file={f} onTogli={() => setNuoveFoto(nuoveFoto.filter((_, j) => j !== i))} />
                      ))}
                      <label
                        style={css(`position:relative;width:88px;height:88px;border:2px dashed ${C.grigio};display:grid;place-items:center;color:${C.grigio};cursor:pointer`)}
                      >
                        <Icona nome="piu" size={26} />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          aria-label="Aggiungi foto"
                          style={css("position:absolute;inset:0;opacity:0;cursor:pointer")}
                          onChange={(e) => {
                            const fs = Array.from(e.target.files ?? []);
                            if (fs.length) setNuoveFoto([...nuoveFoto, ...fs].slice(0, 12));
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}
                </Campo>
                <CampoTesto
                  etichetta="Altre foto su un altro sito (facoltativo)"
                  value={linkFoto}
                  onChange={setLinkFoto}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                />
              </>
            )}

            {/* 5 · contatti */}
            {passo === 5 && !sonoHost && (
              <div style={css(`background:${C.sabbia};padding:14px;font-size:15px;line-height:1.45`)}>
                I contatti sono quelli di chi ha pubblicato l&apos;annuncio, e li può cambiare solo lui o lei. Tu puoi aggiornare stanze, foto e descrizione.
              </div>
            )}
            {passo === 5 && sonoHost && (
              <>
                <div style={css(`display:flex;gap:10px;background:${C.sabbia};padding:12px 14px;font-size:14px;line-height:1.45`)}>
                  <Icona nome="lucchetto" size={18} />
                  <span>I contatti li vedono <b>solo gli studenti UniBo</b> entrati con la mail istituzionale. Niente agenzie, niente sconosciuti.</span>
                </div>
                <CampoTesto etichetta="Il tuo nome" value={cNome} onChange={setCNome} autoComplete="given-name" maxLength={40} />
                <CampoTesto etichetta="Telefono" value={cTel} onChange={setCTel} type="tel" autoComplete="tel" inputMode="tel" placeholder="+39 …" />
                <CampoTesto etichetta="WhatsApp, se è un altro numero" value={cWa} onChange={setCWa} type="tel" inputMode="tel" />
                <CampoTesto etichetta="Email" value={cEmail} onChange={setCEmail} type="email" autoComplete="email" />
                <CampoTesto etichetta="Note per chi ti scrive" value={cNote} onChange={setCNote} maxLength={80} placeholder="Scrivetemi la sera" />
              </>
            )}

            {/* 6 · controlla */}
            {passo === 6 && (
              <Riepilogo
                titolo={titoloFinale}
                zona={zona}
                stanze={stanze}
                tot={totN}
                coinq={coinq}
                inviti={inviti.length}
                contratto={contratto || "Da definire"}
                agenzia={agenzia}
                caparra={caparra}
                foto={fotoEsistenti.length + nuoveFoto.length}
                contatti={[cTel, cWa, cEmail].filter((x) => x.trim()).length}
                vaiA={setPasso}
              />
            )}
          </div>
        )}
      </div>

      {/* barra in basso */}
      {!carico && passo > 0 && (
        <div style={css(`display:flex;gap:10px;padding:12px 20px calc(14px + env(safe-area-inset-bottom));border-top:2px solid ${C.ink};background:${C.crema}`)}>
          <button type="button" onClick={indietro} style={css(`${BOTTONE.contorno};height:52px;flex:none`)}>
            Indietro
          </button>
          {passo < PASSI.length - 1 ? (
            <button type="button" onClick={avanti} style={css(`${BOTTONE.scuro};flex:1;display:flex;align-items:center;justify-content:center;gap:8px`)}>
              Avanti
              <Icona nome="freccia" size={18} />
            </button>
          ) : (
            <button type="button" onClick={pubblica} disabled={invio} style={css(`${BOTTONE.pieno};flex:1`)}>
              {invio ? (modifica ? "Salvo…" : "Pubblico…") : modifica ? "Salva le modifiche" : "Pubblica"}
            </button>
          )}
        </div>
      )}

      <Foglio
        aperto={abitPer !== null}
        onChiudi={() => setAbitPer(null)}
        titolo="Abitudini del coinquilino"
      >
        {abitPer !== null && coinq[abitPer] && (
          <div style={css("display:flex;flex-direction:column;gap:16px")}>
            {ABIT_CATEGORIE.map((cat) => (
              <fieldset key={cat.titolo} style={css("border:0;margin:0;padding:0")}>
                <legend style={css("font-size:13px;font-weight:800;margin-bottom:8px;padding:0")}>{cat.titolo}</legend>
                <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                  {cat.voci.map((v) => {
                    const sel = coinq[abitPer].abitudini;
                    return (
                      <Chip
                        key={v}
                        on={sel.includes(v)}
                        onClick={() =>
                          setCoinq(
                            coinq.map((x, j) =>
                              j === abitPer ? { ...x, abitudini: sel.includes(v) ? sel.filter((y) => y !== v) : [...sel, v] } : x,
                            ),
                          )
                        }
                      >
                        {v}
                      </Chip>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <button type="button" onClick={() => setAbitPer(null)} style={css(`${BOTTONE.scuro};width:100%;height:48px`)}>
              Fatto
            </button>
          </div>
        )}
      </Foglio>
    </Guscio>
  );
}

// ---------- pezzi del modulo ----------

function Guscio({
  titolo,
  onChiudi,
  onIndietro,
  sotto,
  children,
}: {
  titolo: string;
  onChiudi: () => void;
  onIndietro?: () => void;
  sotto?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titolo}
      style={css(`position:absolute;inset:0;z-index:85;background:${C.crema};display:flex;flex-direction:column;animation:sbSlide .32s ${EASE} both`)}
    >
      <div style={css(`padding:calc(10px + env(safe-area-inset-top)) 8px 10px;border-bottom:2px solid ${C.ink}`)}>
        <div style={css("display:flex;align-items:center;gap:4px")}>
          {onIndietro ? (
            <button type="button" onClick={onIndietro} aria-label="Passo precedente" style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}>
              <Icona nome="indietro" />
            </button>
          ) : (
            <span style={css("width:44px")} />
          )}
          <h1 style={css("margin:0;flex:1;font-size:18px;font-weight:900;letter-spacing:-.03em;text-align:center")}>{titolo}</h1>
          <button type="button" onClick={onChiudi} aria-label="Chiudi senza salvare" style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}>
            <Icona nome="chiudi" />
          </button>
        </div>
      </div>
      {sotto}
      {children}
    </div>
  );
}

function SchedaStanza({
  numero,
  s,
  onCambia,
  onDuplica,
  onElimina,
}: {
  numero: number | null;
  s: StanzaForm;
  onCambia: (s: StanzaForm) => void;
  onDuplica: () => void;
  onElimina: (() => void) | null;
}) {
  const set = <K extends keyof StanzaForm>(k: K, v: StanzaForm[K]) => onCambia({ ...s, [k]: v });
  return (
    <div style={css(`border:2px solid ${C.ink};background:${C.carta};padding:14px;display:flex;flex-direction:column;gap:12px`)}>
      <div style={css("display:flex;align-items:center;gap:6px")}>
        <span style={css("flex:1;font-size:15px;font-weight:900")}>
          {numero ? `Stanza ${numero}` : "La stanza"}
          {s.stato !== "libera" && (
            <span style={css(`font-size:12px;font-weight:700;color:${C.grigio}`)}> · {s.stato === "occupata" ? "presa" : "in trattativa"}</span>
          )}
        </span>
        <button type="button" onClick={onDuplica} style={css(BOTTONE.piccolo)}>
          Duplica
        </button>
        {onElimina && (
          <button
            type="button"
            onClick={onElimina}
            aria-label={`Togli ${numero ? `la stanza ${numero}` : "la stanza"}`}
            style={css(`${BOTTONE.piccolo};width:44px;padding:0;display:grid;place-items:center;border-color:${C.rosso};color:${C.rosso}`)}
          >
            <Icona nome="cestino" size={16} />
          </button>
        )}
      </div>
      <Segmenti
        etichetta="Tipo di stanza"
        valore={s.tipo}
        opzioni={[
          { value: "singola", label: "Singola" },
          { value: "doppia", label: "Doppia" },
        ]}
        onChange={(v) => onCambia({ ...s, tipo: v, posti: v === "singola" ? 1 : s.posti })}
      />
      {s.tipo === "doppia" && (
        <Segmenti
          etichetta="Posti liberi nella doppia"
          valore={String(Math.min(2, s.posti)) as "1" | "2"}
          opzioni={[
            { value: "1", label: "1 posto libero" },
            { value: "2", label: "2 posti liberi" },
          ]}
          onChange={(v) => set("posti", Number(v))}
        />
      )}
      <CampoTesto
        etichetta={s.tipo === "doppia" && s.posti >= 2 ? "Affitto al mese, a persona (€)" : "Affitto al mese (€)"}
        value={s.prezzo}
        onChange={(v) => set("prezzo", v.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
      />
      <Campo etichetta="Spese (luce, gas, condominio…)">
        {() => (
          <Segmenti
            etichetta="Spese"
            valore={s.speseIncl ? "incl" : "parte"}
            opzioni={[
              { value: "incl", label: "Incluse" },
              { value: "parte", label: "A parte" },
            ]}
            onChange={(v) => set("speseIncl", v === "incl")}
          />
        )}
      </Campo>
      {!s.speseIncl && (
        <CampoTesto
          etichetta="Quanto, al mese circa (€)"
          value={s.spese}
          onChange={(v) => set("spese", v.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="Es. 65"
        />
      )}
      <Campo etichetta={s.speseIncl ? "Sono comprese" : "Le spese comprendono"}>
        {() => (
          <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
            {SPESE_VOCI.map((v) => (
              <Chip
                key={v}
                on={s.speseComprendono.includes(v)}
                onClick={() => set("speseComprendono", s.speseComprendono.includes(v) ? s.speseComprendono.filter((x) => x !== v) : [...s.speseComprendono, v])}
              >
                {v}
              </Chip>
            ))}
          </div>
        )}
      </Campo>
      <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
        <Campo etichetta="Libera dal">
          {(id) => <input id={id} type="date" value={s.dal} min={oggiISO()} onChange={(e) => set("dal", e.target.value)} style={css(CAMPO)} />}
        </Campo>
        <Campo etichetta="Fino al (se c'è)">
          {(id) => <input id={id} type="date" value={s.fino} min={s.dal} onChange={(e) => set("fino", e.target.value)} style={css(CAMPO)} />}
        </Campo>
      </div>
      <Campo etichetta="Si resta almeno">
        {(id) => (
          <select id={id} value={s.min} onChange={(e) => set("min", Number(e.target.value))} style={css(CAMPO)}>
            {[1, 3, 6, 9, 12, 18, 24].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mese" : "mesi"}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <CampoTesto
        etichetta="Una nota sulla stanza (facoltativo)"
        value={s.nota}
        onChange={(v) => set("nota", v)}
        maxLength={160}
        placeholder="Balcone, comunicante con un'altra stanza…"
      />
      {s.prezzo && (
        <div style={css(`font-size:13px;color:${C.grigio};font-weight:600`)}>
          Chi la guarda legge: {euro(Number(s.prezzo))}
          {s.speseIncl ? " spese incluse" : s.spese ? ` + ${s.spese} € di spese` : " + spese"}
        </div>
      )}
    </div>
  );
}

function Miniatura({ src, onTogli }: { src: string; onTogli: () => void }) {
  return (
    <div style={css("position:relative;width:88px;height:88px")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Foto della casa" loading="lazy" width={88} height={88} style={css(`width:88px;height:88px;object-fit:cover;border:2px solid ${C.linea}`)} />
      <button
        type="button"
        onClick={onTogli}
        aria-label="Togli questa foto"
        style={css(`position:absolute;right:-8px;top:-8px;width:32px;height:32px;border:2px solid ${C.ink};background:${C.crema};color:${C.ink};display:grid;place-items:center;cursor:pointer`)}
      >
        <Icona nome="chiudi" size={14} />
      </button>
    </div>
  );
}

function MiniaturaFile({ file, onTogli }: { file: File; onTogli: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <Miniatura src={url} onTogli={onTogli} /> : null;
}

function Riepilogo({
  titolo,
  zona,
  stanze,
  tot,
  coinq,
  inviti,
  contratto,
  agenzia,
  caparra,
  foto,
  contatti,
  vaiA,
}: {
  titolo: string;
  zona: string;
  stanze: StanzaForm[];
  tot: number;
  coinq: CoinqForm[];
  inviti: number;
  contratto: string;
  agenzia: boolean;
  caparra: string;
  foto: number;
  contatti: number;
  vaiA: (p: number) => void;
}) {
  const aperte = stanze.filter((s) => s.stato !== "occupata");
  const prezzi = aperte.map((s) => Number(s.prezzo)).filter(Boolean);
  const consigli = [
    !foto && { testo: "Aggiungi almeno una foto: senza, quasi nessuno scrive.", passo: 4 },
    !coinq.length && !inviti && { testo: "Descrivi chi ci abita: è il motivo per cui si usa SLEPBOLO.", passo: 3 },
  ].filter(Boolean) as { testo: string; passo: number }[];

  const riga = (etichetta: string, valore: string, passo: number) => (
    <button
      type="button"
      onClick={() => vaiA(passo)}
      style={css(`width:100%;display:flex;align-items:baseline;gap:12px;min-height:48px;padding:10px 0;border:0;border-bottom:1px solid ${C.linea};background:transparent;font-family:inherit;text-align:left;cursor:pointer;color:${C.ink}`)}
    >
      <span style={css(`flex:none;width:100px;font-size:13px;font-weight:700;color:${C.grigio}`)}>{etichetta}</span>
      <span style={css("flex:1;font-size:15px;font-weight:700;line-height:1.35")}>{valore}</span>
      <span style={css(`font-size:13px;font-weight:800;color:${C.grigio}`)}>Modifica</span>
    </button>
  );

  return (
    <div style={css("display:flex;flex-direction:column;gap:14px")}>
      <h2 style={css("margin:0;font-size:24px;font-weight:900;letter-spacing:-.035em;line-height:1.1")}>{titolo}</h2>
      {consigli.map((c) => (
        <button
          key={c.testo}
          type="button"
          onClick={() => vaiA(c.passo)}
          style={css(`border:2px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:12px 14px;font-family:inherit;font-size:14px;font-weight:700;line-height:1.4;text-align:left;cursor:pointer`)}
        >
          {c.testo}
        </button>
      ))}
      <div>
        {riga("Zona", zona || "—", 1)}
        {riga(
          "Stanze",
          `${aperte.length} ${aperte.length === 1 ? "libera" : "libere"} su ${tot} camere · ${
            prezzi.length ? (Math.min(...prezzi) === Math.max(...prezzi) ? euro(prezzi[0]) : `da ${euro(Math.min(...prezzi))}`) : "prezzo mancante"
          }`,
          2,
        )}
        {riga(
          "Chi ci abita",
          coinq.length || inviti
            ? [coinq.length ? `${coinq.length} descritti` : null, inviti ? `${inviti} invitati` : null].filter(Boolean).join(" · ")
            : "nessuno",
          3,
        )}
        {riga("Contratto", `${contratto}${agenzia ? " · tramite agenzia" : ""}${caparra ? ` · caparra ${caparra.toLowerCase()}` : ""}`, 4)}
        {riga("Foto", foto ? `${foto}` : "nessuna", 4)}
        {riga("Contatti", contatti ? `${contatti} ${contatti === 1 ? "recapito" : "recapiti"}, visibili solo agli studenti UniBo` : "mancano", 5)}
      </div>
      <p style={css(`margin:0;font-size:14px;line-height:1.45;color:${C.grigio}`)}>
        Pubblicando confermi che la stanza esiste, che le foto sono della casa vera e che il prezzo è quello reale.
      </p>
    </div>
  );
}
