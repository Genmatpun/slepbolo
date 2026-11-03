"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { STATI_STANZA } from "@/lib/constants";
import { GIORNI_VALIDITA, annuncioScaduto, giorniAllaScadenza, giorniDa, quandoAggiornato, type StatoStanza } from "@/lib/types";
import { INCOLLA_ATTIVO } from "./pubblica";
import { BOTTONE, C, css, dataBreve, euro } from "./stile";
import { CampoTesto, Foglio, Freschezza, Icona, Segmenti } from "./ui";

// ============================================================
// Le mie case — il ciclo di vita di un annuncio.
//
// Qui chi affitta tiene l'annuncio vero: segna ogni stanza come libera,
// in trattativa o presa con un tocco, e conferma "è ancora libera".
// Un annuncio non confermato da 30 giorni sparisce dalla ricerca: resta
// qui, e un tocco lo rimette online.
//
// Chi ha pubblicato per conto di qualcuno può passargli l'annuncio:
// la persona accetta da qui e da quel momento lo gestisce lei.
// ============================================================

/** Un annuncio che qualcuno ti sta passando (funzione passaggi_in_arrivo). */
interface PassaggioInArrivo {
  apartment_id: string;
  titolo: string;
  zona: string;
  da_nome: string | null;
  scade: string;
}

const ESITI_PASSA: Record<string, string> = {
  non_trovato: "Non trovo nessun account con questa mail. Chiedi alla persona di registrarsi su SLEPBOLO e controlla di aver scritto la stessa mail.",
  gia_suo: "Questo annuncio è già suo.",
  non_autorizzato: "Solo chi ha pubblicato l'annuncio può passarlo.",
};

interface StanzaMia {
  id: string;
  tipo: string;
  posti_liberi: number;
  prezzo_mensile: number;
  stato: StatoStanza;
}

interface CasaMia {
  id: string;
  titolo: string;
  zona: string;
  attivo: boolean;
  confermato_il: string;
  aggiornato_il: string;
  sonoHost: boolean;
  rooms: StanzaMia[];
}

type RigaDb = Omit<CasaMia, "sonoHost" | "rooms"> & { rooms: StanzaMia[] | null };

const CAMPI = "id, titolo, zona, attivo, confermato_il, aggiornato_il, rooms(id, tipo, posti_liberi, prezzo_mensile, stato)";

const nomeStato = (s: StatoStanza) => STATI_STANZA.find((x) => x.value === s)?.label ?? s;

/** Da quanti giorni prima della scadenza l'annuncio chiede la conferma. */
const GIORNI_AVVISO = 7;

/** Un bottone disattivato deve sembrarlo. */
const spento = (si: boolean) => (si ? ";opacity:.5;cursor:default" : "");

/** Azione secondaria di una scheda: solo testo e icona, così non compete con lo stato e la conferma. */
const SECONDARIA = `min-height:44px;border:0;background:transparent;color:${C.ink};font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:0 8px;display:flex;align-items:center;gap:6px`;

export function LeMieCase({
  userId,
  onModifica,
  onPubblica,
  onCambiato,
}: {
  userId: string;
  onModifica: (id: string) => void;
  onPubblica: () => void;
  /** Avvisa l'app che i dati pubblici sono cambiati (per ricaricarli). */
  onCambiato: () => void;
}) {
  const [case_, setCase] = useState<CasaMia[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [daEliminare, setDaEliminare] = useState<CasaMia | null>(null);
  const [daLasciare, setDaLasciare] = useState<CasaMia | null>(null);
  /** errore dentro il foglio di conferma: dietro al foglio non si vedrebbe */
  const [erroreFoglio, setErroreFoglio] = useState<string | null>(null);
  /** com'è andata l'ultima azione, detto accanto a dove si è toccato (id di una stanza o di una casa) */
  const [esito, setEsito] = useState<{ dove: string; tono: "ok" | "errore"; testo: string } | null>(null);
  // stanze il cui stato si sta salvando: un secondo tocco aspetta il primo
  const inVolo = useRef(new Set<string>());
  const [salvando, setSalvando] = useState<string[]>([]);
  // passare un annuncio a un altro account
  const [inArrivo, setInArrivo] = useState<PassaggioInArrivo[]>([]);
  /** annunci miei in attesa che qualcuno li accetti: id annuncio -> mail */
  const [inUscita, setInUscita] = useState<Map<string, string>>(new Map());
  const [daPassare, setDaPassare] = useState<CasaMia | null>(null);
  const [mailPassa, setMailPassa] = useState("");

  const carica = useCallback(async () => {
    if (!supabaseConfigurato()) return setCase([]);
    const supabase = createClient();
    const [host, membro, arrivo, uscita] = await Promise.all([
      supabase.from("apartments").select(CAMPI).eq("host_id", userId).order("created_at", { ascending: false }),
      supabase.from("housemates").select(`apartments(${CAMPI})`).eq("profile_id", userId).eq("stato", "confermato"),
      supabase.rpc("passaggi_in_arrivo"),
      supabase.from("passaggi_annuncio").select("apartment_id, email_a, scade").eq("da", userId),
    ]);
    // i passaggi sono un di più: se non rispondono, il resto funziona lo stesso
    setInArrivo(arrivo.error ? [] : ((arrivo.data ?? []) as PassaggioInArrivo[]));
    const adesso = Date.now();
    setInUscita(
      new Map(
        ((uscita.error ? [] : uscita.data) ?? [])
          .filter((p) => new Date(p.scade as string).getTime() > adesso)
          .map((p) => [p.apartment_id as string, p.email_a as string]),
      ),
    );
    if (host.error) {
      setErrore("Non riesco a caricare le tue case. Controlla la connessione e riprova.");
      return;
    }
    const mappa = new Map<string, CasaMia>();
    for (const a of (host.data ?? []) as unknown as RigaDb[]) {
      mappa.set(a.id, { ...a, rooms: a.rooms ?? [], sonoHost: true });
    }
    for (const h of (membro.data ?? []) as unknown as { apartments: RigaDb | RigaDb[] | null }[]) {
      const a = Array.isArray(h.apartments) ? h.apartments[0] : h.apartments;
      if (a && !mappa.has(a.id)) mappa.set(a.id, { ...a, rooms: a.rooms ?? [], sonoHost: false });
    }
    setErrore(null);
    setCase([...mappa.values()]);
  }, [userId]);

  useEffect(() => {
    carica();
  }, [carica]);

  /** Esegue un'azione sul database e aggiorna l'elenco. Restituisce true se è andata bene: il messaggio lo mette chi chiama. */
  async function esegui(chiave: string, azione: () => PromiseLike<{ error: unknown }>) {
    setInCorso(chiave);
    setEsito(null);
    let fallita = false;
    try {
      fallita = !!(await azione()).error;
    } catch {
      fallita = true;
    }
    setInCorso(null);
    if (fallita) return false;
    setErrore(null);
    await carica();
    onCambiato();
    return true;
  }

  const ora = () => new Date().toISOString();

  async function cambiaStato(casa: CasaMia, stanza: StanzaMia, stato: StatoStanza) {
    if (stanza.stato === stato || inVolo.current.has(stanza.id)) return;
    const prima = stanza.stato;
    const metti = (s: StatoStanza) =>
      setCase((cs) =>
        cs?.map((c) =>
          c.id !== casa.id ? c : { ...c, rooms: c.rooms.map((r) => (r.id === stanza.id ? { ...r, stato: s } : r)) },
        ) ?? cs,
      );
    inVolo.current.add(stanza.id);
    setSalvando((x) => [...x, stanza.id]);
    setEsito(null);
    // aggiornamento immediato a schermo, poi il database
    metti(stato);
    const supabase = createClient();
    let fallita = false;
    try {
      fallita = !!(await supabase.from("rooms").update({ stato }).eq("id", stanza.id)).error;
    } catch {
      fallita = true;
    }
    let confermata = false;
    if (!fallita) {
      // cambiare lo stato vuol dire che l'annuncio è seguito: vale come conferma.
      // Se questa parte non riesce lo stato è salvato lo stesso: non si torna indietro.
      try {
        confermata = !(await supabase.from("apartments").update({ confermato_il: ora() }).eq("id", casa.id)).error;
      } catch {
        // la conferma si rifà al prossimo tocco
      }
    }
    inVolo.current.delete(stanza.id);
    setSalvando((x) => x.filter((id) => id !== stanza.id));

    if (fallita) {
      // non è stato salvato: a schermo torna com'era, e lo dico
      metti(prima);
      setEsito({
        dove: stanza.id,
        tono: "errore",
        testo: `Non sono riuscito a salvare: la stanza resta «${nomeStato(prima)}». Controlla la connessione e riprova.`,
      });
      return;
    }

    // cosa vuol dire per chi cerca: in ricerca ci sta un annuncio visibile, confermato e con una stanza non presa
    const tuttePrese = casa.rooms.every((r) => (r.id === stanza.id ? stato : r.stato) === "occupata");
    const inRicerca = casa.attivo && (confermata || !annuncioScaduto(casa));
    const rimetti = " L'annuncio però non è nella ricerca: per rimetterlo online tocca «Rimettila online: è ancora libera» qui sotto.";
    setEsito({
      dove: stanza.id,
      tono: "ok",
      testo:
        stato === "occupata"
          ? tuttePrese
            ? "Segnata come presa. Con tutte le stanze prese l'annuncio non compare nella ricerca: resta qui, pronto per la prossima volta."
            : `Segnata come presa.${inRicerca ? " L'annuncio resta nella ricerca per le altre stanze." : ""}`
          : stato === "in_trattativa"
            ? `Segnata in trattativa.${inRicerca ? " Resta nella ricerca, e chi la apre vede che qualcuno la sta già trattando." : rimetti}`
            : inRicerca
              ? "Segnata come libera: è nella ricerca."
              : `Segnata come libera.${rimetti}`,
    });
    // se un'altra stanza si sta ancora salvando, l'elenco lo ricarica lei quando finisce
    if (!inVolo.current.size) await carica();
    onCambiato();
  }

  async function conferma(casa: CasaMia, eraFuori: boolean) {
    const supabase = createClient();
    const ok = await esegui(casa.id, () => supabase.from("apartments").update({ confermato_il: ora(), attivo: true }).eq("id", casa.id));
    setEsito(
      ok
        ? {
            dove: casa.id,
            tono: "ok",
            testo: `${eraFuori ? "Di nuovo online" : "Confermato"}: resta nella ricerca per ${GIORNI_VALIDITA} giorni.`,
          }
        : { dove: casa.id, tono: "errore", testo: "Non sono riuscito a confermare l'annuncio. Controlla la connessione e riprova." },
    );
  }

  async function nascondi(casa: CasaMia) {
    const supabase = createClient();
    const ok = await esegui(casa.id, () => supabase.from("apartments").update({ attivo: !casa.attivo }).eq("id", casa.id));
    if (!ok) setEsito({ dove: casa.id, tono: "errore", testo: "Non sono riuscito a nascondere l'annuncio. Controlla la connessione e riprova." });
  }

  async function elimina(casa: CasaMia) {
    const supabase = createClient();
    setErroreFoglio(null);
    const ok = await esegui(casa.id, () => supabase.from("apartments").delete().eq("id", casa.id));
    if (ok) setDaEliminare(null);
    else setErroreFoglio("Non sono riuscito a eliminare l'annuncio: è ancora al suo posto. Controlla la connessione e riprova.");
  }

  async function lascia(casa: CasaMia) {
    const supabase = createClient();
    setErroreFoglio(null);
    const ok = await esegui(casa.id, () => supabase.from("housemates").delete().eq("apartment_id", casa.id).eq("profile_id", userId));
    if (ok) setDaLasciare(null);
    else setErroreFoglio("Non sono riuscito a toglierti dall'annuncio. Controlla la connessione e riprova.");
  }

  async function passa(casa: CasaMia) {
    const mail = mailPassa.trim().toLowerCase();
    setErroreFoglio(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setErroreFoglio("Scrivi la mail con cui la persona si è registrata.");
      return;
    }
    setInCorso(casa.id);
    let risposta: string | null = null;
    try {
      const { data, error } = await createClient().rpc("passa_annuncio", { p_apartment: casa.id, p_email: mail });
      if (!error) risposta = data as string;
    } catch {
      // risposta resta null: lo dico sotto
    }
    setInCorso(null);
    if (risposta !== "ok") {
      setErroreFoglio(
        (risposta && ESITI_PASSA[risposta]) ?? "Non sono riuscito a passare l'annuncio. Controlla la connessione e riprova.",
      );
      return;
    }
    setDaPassare(null);
    await carica();
    setEsito({
      dove: casa.id,
      tono: "ok",
      testo: `Fatto. Quando ${mail} accetta dal suo profilo, l'annuncio diventa suo. Fino ad allora lo gestisci tu.`,
    });
  }

  async function annullaPassaggio(casa: CasaMia) {
    const ok = await esegui(casa.id, () => createClient().from("passaggi_annuncio").delete().eq("apartment_id", casa.id));
    setEsito(
      ok
        ? { dove: casa.id, tono: "ok", testo: "Passaggio annullato: l'annuncio resta tuo." }
        : { dove: casa.id, tono: "errore", testo: "Non sono riuscito ad annullare. Controlla la connessione e riprova." },
    );
  }

  async function rispondiPassaggio(p: PassaggioInArrivo, accetta: boolean) {
    setInCorso(p.apartment_id);
    setEsito(null);
    let risposta: string | null = null;
    try {
      const { data, error } = await createClient().rpc("rispondi_passaggio", { p_apartment: p.apartment_id, p_accetta: accetta });
      if (!error) risposta = data as string;
    } catch {
      // risposta resta null
    }
    setInCorso(null);
    await carica();
    if (risposta === "accettato") {
      onCambiato();
      setEsito({ dove: p.apartment_id, tono: "ok", testo: "Ora l'annuncio è tuo: lo trovi qui sotto e lo gestisci tu." });
    } else if (risposta !== "rifiutato") {
      setEsito({
        dove: "arrivo",
        tono: "errore",
        testo: risposta === "non_valido" ? "Questo passaggio non è più valido: è scaduto o è stato annullato." : "Non sono riuscito a rispondere. Controlla la connessione e riprova.",
      });
    }
  }

  if (case_ === null && !errore) {
    return <div aria-busy="true" style={css(`height:60px;font-size:14px;color:${C.grigio};font-weight:600`)}>Carico le tue case…</div>;
  }

  /** Il messaggio sull'ultima azione, nel punto in cui si è toccato. Il contenitore c'è sempre, così viene letto anche a voce. */
  const mostraEsito = (dove: string) => (
    <div role="status" aria-live="polite">
      {esito?.dove === dove && (
        <div style={css(`display:flex;gap:6px;margin-top:8px;font-size:13.5px;font-weight:700;line-height:1.4;color:${esito.tono === "errore" ? C.rosso : C.verde}`)}>
          {esito.tono === "ok" && (
            <span style={css("flex:none;padding-top:1px")}>
              <Icona nome="check" size={16} />
            </span>
          )}
          <span>{esito.testo}</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={css("display:flex;flex-direction:column;gap:12px")}>
      {errore && (
        <div role="alert" style={css(`border:2px solid ${C.rosso};background:${C.carta};padding:12px 14px;display:flex;align-items:center;gap:10px`)}>
          <span style={css(`flex:1;font-size:14px;font-weight:700;color:${C.rosso}`)}>{errore}</span>
          <button type="button" onClick={carica} style={css(BOTTONE.piccolo)}>
            Riprova
          </button>
        </div>
      )}

      {/* annunci che qualcuno ti sta passando: solo se ce ne sono */}
      {inArrivo.length > 0 && (
        <div style={css(`border:2px solid ${C.rosso};background:${C.carta}`)}>
          <div style={css(`padding:10px 14px;background:${C.rosso};color:${C.crema};font-size:14px;font-weight:800`)}>
            {inArrivo.length === 1 ? "Ti hanno passato un annuncio" : `Ti hanno passato ${inArrivo.length} annunci`}
          </div>
          {inArrivo.map((p) => {
            const occupato = inCorso === p.apartment_id;
            return (
              <div key={p.apartment_id} style={css(`padding:14px;border-top:1px solid ${C.linea}`)}>
                <div style={css("font-size:16px;font-weight:900;letter-spacing:-.02em")}>{p.titolo}</div>
                <div style={css(`font-size:14px;color:${C.testo};margin-top:4px;line-height:1.4`)}>
                  {p.zona} · {p.da_nome ? `${p.da_nome} l'ha pubblicato per te` : "È stato pubblicato per te"}. Se accetti diventa tuo: lo modifichi, segni le
                  stanze come prese e lo togli quando vuoi.
                </div>
                <div style={css("display:flex;gap:8px;margin-top:11px")}>
                  <button type="button" onClick={() => rispondiPassaggio(p, true)} disabled={occupato} style={css(`${BOTTONE.scuro};height:46px;flex:1${spento(occupato)}`)}>
                    {occupato ? "Un attimo…" : "Sì, è la mia casa"}
                  </button>
                  <button type="button" onClick={() => rispondiPassaggio(p, false)} disabled={occupato} style={css(`${BOTTONE.contorno};height:46px;flex:1${spento(occupato)}`)}>
                    No
                  </button>
                </div>
              </div>
            );
          })}
          <div style={css("padding:0 14px")}>{mostraEsito("arrivo")}</div>
        </div>
      )}

      {case_?.length === 0 && (
        <button
          type="button"
          onClick={onPubblica}
          style={css(`display:flex;align-items:center;gap:12px;border:2px solid ${C.ink};background:${C.ink};color:${C.crema};padding:14px 16px;font-family:inherit;text-align:left;cursor:pointer`)}
        >
          <Icona nome="piu" size={22} />
          <span style={css("flex:1")}>
            <span style={css("display:block;font-size:15px;font-weight:800")}>Hai una stanza libera?</span>
            <span style={css("display:block;font-size:13px;color:rgba(250,243,231,.82)")}>
              Pubblicala in due minuti.{INCOLLA_ATTIVO ? " Se hai già il messaggio di WhatsApp, incollalo." : ""}
            </span>
          </span>
          <Icona nome="freccia" />
        </button>
      )}

      {case_?.map((c) => {
        const scaduto = annuncioScaduto(c);
        const restano = giorniAllaScadenza(c);
        // la conferma si chiede solo nell'ultima settimana: prima, un bottone rosso su ogni casa copre quella che scade davvero
        const daConfermare = !scaduto && restano <= GIORNI_AVVISO;
        const fuori = !c.attivo || scaduto;
        // senza una stanza libera o in trattativa l'annuncio non è in ricerca: confermarlo non serve
        const senzaStanze = c.rooms.length === 0;
        const tuttePrese = !senzaStanze && c.rooms.every((r) => r.stato === "occupata");
        const confermabile = !senzaStanze && !tuttePrese;
        const occupato = inCorso === c.id;
        const avviso = senzaStanze
          ? "Mancano le stanze: aggiungile da «Modifica», altrimenti l'annuncio non compare nella ricerca."
          : tuttePrese
            ? "Tutte le stanze sono prese: l'annuncio non compare nella ricerca. Quando se ne libera una, segnala «Libera»."
            : !c.attivo
              ? "Nascosto: nessuno lo vede nella ricerca."
              : scaduto
                ? `Non confermato da più di ${GIORNI_VALIDITA} giorni: è sparito dalla ricerca. Se è ancora libera, confermalo.`
                : daConfermare
                  ? restano === 0
                    ? "Sparisce dalla ricerca oggi se non lo confermi."
                    : `Sparisce dalla ricerca tra ${restano} ${restano === 1 ? "giorno" : "giorni"} se non lo confermi.`
                  : null;
        const avvisoUrgente = confermabile && c.attivo && !scaduto;
        return (
          <article key={c.id} style={css(`border:2px solid ${fuori || !confermabile ? C.linea : C.ink};background:${C.carta}`)}>
            <div style={css("padding:12px 14px 10px")}>
              <div style={css("display:flex;align-items:baseline;gap:10px")}>
                <h3 style={css("margin:0;flex:1;min-width:0;font-size:15px;font-weight:900;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                  {c.titolo}
                </h3>
                {!c.sonoHost && <span style={css(`font-size:12px;font-weight:700;color:${C.grigio}`)}>ci abiti</span>}
              </div>
              <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:4px")}>
                <span style={css(`font-size:13px;color:${C.grigio};font-weight:600`)}>{c.zona}</span>
                <Freschezza testo={quandoAggiornato(c.aggiornato_il)} giorni={giorniDa(c.aggiornato_il)} />
              </div>
            </div>

            {/* stato di visibilità (host e coinquilini confermati gestiscono la casa insieme) */}
            {avviso && (
              <div
                style={css(
                  `margin:0 14px 10px;padding:10px 12px;font-size:13.5px;font-weight:700;line-height:1.4;${avvisoUrgente || senzaStanze ? `background:${C.ambraFondo};color:${C.ambraTesto}` : `background:${C.sabbia};color:${C.ink}`}`,
                )}
              >
                {avviso}
              </div>
            )}

            {/* stanze: un selettore per ognuna */}
            {c.rooms.length > 0 && (
              <div style={css("padding:0 14px 12px;display:flex;flex-direction:column;gap:10px")}>
                {c.rooms.map((r, i) => (
                  <div key={r.id}>
                    <div style={css(`display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:700;color:${C.grigio};margin-bottom:6px`)}>
                      <span style={css("flex:1")}>
                        {c.rooms.length > 1 ? `Stanza ${i + 1} · ` : ""}
                        {r.tipo === "doppia" ? (r.posti_liberi >= 2 ? `${r.posti_liberi} posti in doppia` : "Posto in doppia") : "Singola"} ·{" "}
                        {euro(r.prezzo_mensile)}
                      </span>
                      {salvando.includes(r.id) && <span>Salvo…</span>}
                    </div>
                    <Segmenti
                      etichetta={`Stato della stanza ${i + 1}`}
                      valore={r.stato}
                      opzioni={STATI_STANZA}
                      onChange={(v) => cambiaStato(c, r, v)}
                    />
                    {mostraEsito(r.id)}
                  </div>
                ))}
              </div>
            )}

            {/* l'azione che conta: confermare che la stanza c'è ancora. In evidenza solo quando serve */}
            <div style={css(`padding:0 14px ${confermabile || esito?.dove === c.id ? "12px" : "0"}`)}>
              {confermabile && (fuori || daConfermare) && (
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() => conferma(c, fuori)}
                  style={css(`${BOTTONE.pieno};height:48px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px${spento(occupato)}`)}
                >
                  <Icona nome="check" size={18} />
                  {occupato ? "Un attimo…" : fuori ? "Rimettila online: è ancora libera" : "Confermo: è ancora libera"}
                </button>
              )}
              {confermabile && !fuori && !daConfermare && (
                <div style={css(`display:flex;flex-wrap:wrap;align-items:center;gap:0 10px;font-size:13.5px;font-weight:700;color:${C.verde}`)}>
                  <span style={css("display:inline-flex;align-items:center;gap:6px;min-height:44px")}>
                    <Icona nome="check" size={16} />
                    Online fino al {dataBreve(new Date(new Date(c.confermato_il).getTime() + GIORNI_VALIDITA * 86_400_000).toISOString())}
                  </span>
                  <button
                    type="button"
                    disabled={occupato}
                    onClick={() => conferma(c, false)}
                    style={css(`${SECONDARIA};padding:0;color:${C.ink};text-decoration:underline;text-underline-offset:3px${spento(occupato)}`)}
                  >
                    {occupato ? "Un attimo…" : "Conferma adesso"}
                  </button>
                </div>
              )}
              {mostraEsito(c.id)}
            </div>

            {/* passaggio in attesa: l'annuncio è ancora tuo finché l'altra persona non accetta */}
            {c.sonoHost && inUscita.has(c.id) && (
              <div style={css(`margin:0 14px 12px;padding:10px 12px;background:${C.sabbia};display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px`)}>
                <span style={css(`flex:1;min-width:180px;font-size:13.5px;font-weight:700;line-height:1.4;color:${C.ink};overflow-wrap:anywhere`)}>
                  In attesa che {inUscita.get(c.id)} accetti
                </span>
                <button type="button" disabled={occupato} onClick={() => annullaPassaggio(c)} style={css(`${SECONDARIA};padding:0${spento(occupato)}`)}>
                  Annulla
                </button>
              </div>
            )}

            {/* il resto: sempre a portata, ma in secondo piano */}
            <div style={css(`display:flex;flex-wrap:wrap;align-items:center;gap:0 4px;padding:2px 6px;border-top:1px solid ${C.linea}`)}>
              <button type="button" disabled={occupato} onClick={() => onModifica(c.id)} style={css(`${SECONDARIA}${spento(occupato)}`)}>
                <Icona nome="matita" size={16} />
                Modifica
              </button>
              {c.attivo && !scaduto && confermabile && (
                <button type="button" disabled={occupato} onClick={() => nascondi(c)} style={css(`${SECONDARIA}${spento(occupato)}`)}>
                  <Icona nome="occhio" size={16} />
                  Nascondi
                </button>
              )}
              {c.sonoHost && (
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() => {
                    setErroreFoglio(null);
                    setMailPassa(inUscita.get(c.id) ?? "");
                    setDaPassare(c);
                  }}
                  style={css(`${SECONDARIA}${spento(occupato)}`)}
                >
                  <Icona nome="persona" size={16} />
                  Passa a chi affitta
                </button>
              )}
              {c.sonoHost ? (
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() => {
                    setErroreFoglio(null);
                    setDaEliminare(c);
                  }}
                  style={css(`${SECONDARIA};margin-left:auto;color:${C.rosso}${spento(occupato)}`)}
                >
                  <Icona nome="cestino" size={16} />
                  Elimina
                </button>
              ) : (
                <button
                  type="button"
                  disabled={occupato}
                  onClick={() => {
                    setErroreFoglio(null);
                    setDaLasciare(c);
                  }}
                  style={css(`${SECONDARIA};margin-left:auto;color:${C.rosso}${spento(occupato)}`)}
                >
                  Non abito più qui
                </button>
              )}
            </div>
          </article>
        );
      })}

      <Foglio
        aperto={!!daEliminare}
        onChiudi={() => setDaEliminare(null)}
        titolo="Eliminare l'annuncio?"
        piede={
          <>
            <div role="alert">
              {erroreFoglio && <div style={css(`margin-bottom:10px;font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>{erroreFoglio}</div>}
            </div>
            <button type="button" onClick={() => daEliminare && elimina(daEliminare)} disabled={!!inCorso} style={css(`${BOTTONE.pieno};width:100%${spento(!!inCorso)}`)}>
              {inCorso ? "Elimino…" : "Sì, elimina per sempre"}
            </button>
            <button type="button" onClick={() => setDaEliminare(null)} disabled={!!inCorso} style={css(`${BOTTONE.contorno};width:100%;margin-top:8px${spento(!!inCorso)}`)}>
              Lascialo com&apos;è
            </button>
          </>
        }
      >
        <p style={css(`margin:0 0 6px;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Se la stanza è stata presa non serve eliminarlo: segnala la stanza come <b>Presa</b> e l&apos;annuncio sparisce dalla ricerca, ma resta qui pronto per la prossima volta.
        </p>
        <p style={css(`margin:0;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Eliminando cancelli anche foto, stanze e coinquilini collegati. Non si può annullare.
        </p>
      </Foglio>

      <Foglio
        aperto={!!daPassare}
        onChiudi={() => setDaPassare(null)}
        titolo="Passa l'annuncio"
        piede={
          <>
            <div role="alert">
              {erroreFoglio && <div style={css(`margin-bottom:10px;font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>{erroreFoglio}</div>}
            </div>
            <button type="button" onClick={() => daPassare && passa(daPassare)} disabled={!!inCorso} style={css(`${BOTTONE.pieno};width:100%${spento(!!inCorso)}`)}>
              {inCorso ? "Un attimo…" : "Passa l'annuncio"}
            </button>
            <button type="button" onClick={() => setDaPassare(null)} disabled={!!inCorso} style={css(`${BOTTONE.contorno};width:100%;margin-top:8px${spento(!!inCorso)}`)}>
              Lascialo a me
            </button>
          </>
        }
      >
        <p style={css(`margin:0 0 14px;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Hai pubblicato la casa per conto di qualcuno? Scrivi la mail con cui si è registrato: gli arriva una richiesta nel profilo. Se accetta entro 7 giorni,
          l&apos;annuncio diventa suo e lo gestisce lui. Tu non potrai più modificarlo.
        </p>
        <CampoTesto
          etichetta="Mail della persona"
          value={mailPassa}
          onChange={setMailPassa}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="la mail del suo account SLEPBOLO"
        />
      </Foglio>

      <Foglio
        aperto={!!daLasciare}
        onChiudi={() => setDaLasciare(null)}
        titolo="Non abiti più qui?"
        piede={
          <>
            <div role="alert">
              {erroreFoglio && <div style={css(`margin-bottom:10px;font-size:14px;font-weight:700;line-height:1.4;color:${C.rosso}`)}>{erroreFoglio}</div>}
            </div>
            <button type="button" onClick={() => daLasciare && lascia(daLasciare)} disabled={!!inCorso} style={css(`${BOTTONE.pieno};width:100%${spento(!!inCorso)}`)}>
              {inCorso ? "Un attimo…" : "Sì, toglimi dall'annuncio"}
            </button>
            <button type="button" onClick={() => setDaLasciare(null)} disabled={!!inCorso} style={css(`${BOTTONE.contorno};width:100%;margin-top:8px${spento(!!inCorso)}`)}>
              Resto tra i coinquilini
            </button>
          </>
        }
      >
        <p style={css(`margin:0;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Non comparirai più tra i coinquilini di questa casa. Chi l&apos;ha pubblicata può aggiungerti di nuovo, se serve.
        </p>
      </Foglio>
    </div>
  );
}
