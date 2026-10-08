"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { STATI_STANZA } from "@/lib/constants";
import { annuncioScaduto, giorniAllaScadenza, giorniDa, quandoAggiornato, type StatoStanza } from "@/lib/types";
import { BOTTONE, C, css, euro } from "./stile";
import { Foglio, Freschezza, Icona, Segmenti } from "./ui";

// ============================================================
// Le mie case — il ciclo di vita di un annuncio.
//
// Qui chi affitta tiene l'annuncio vero: segna ogni stanza come libera,
// in trattativa o presa con un tocco, e conferma "è ancora libera".
// Un annuncio non confermato da 14 giorni sparisce dalla ricerca: resta
// qui, e un tocco lo rimette online.
// ============================================================

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

  const carica = useCallback(async () => {
    if (!supabaseConfigurato()) return setCase([]);
    const supabase = createClient();
    const [host, membro] = await Promise.all([
      supabase.from("apartments").select(CAMPI).eq("host_id", userId).order("created_at", { ascending: false }),
      supabase.from("housemates").select(`apartments(${CAMPI})`).eq("profile_id", userId).eq("stato", "confermato"),
    ]);
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

  /** Esegue un'azione sul database e aggiorna l'elenco, con un messaggio chiaro se fallisce. */
  async function esegui(chiave: string, azione: () => PromiseLike<{ error: unknown }>, messaggio: string) {
    setInCorso(chiave);
    const { error } = await azione();
    setInCorso(null);
    if (error) {
      setErrore(messaggio);
      return false;
    }
    setErrore(null);
    await carica();
    onCambiato();
    return true;
  }

  const ora = () => new Date().toISOString();

  function cambiaStato(casa: CasaMia, stanza: StanzaMia, stato: StatoStanza) {
    if (stanza.stato === stato) return;
    // aggiornamento immediato a schermo, poi il database
    setCase((cs) =>
      cs?.map((c) =>
        c.id !== casa.id ? c : { ...c, rooms: c.rooms.map((r) => (r.id === stanza.id ? { ...r, stato } : r)) },
      ) ?? cs,
    );
    const supabase = createClient();
    esegui(
      stanza.id,
      async () => {
        const r = await supabase.from("rooms").update({ stato }).eq("id", stanza.id);
        if (r.error) return r;
        // cambiare lo stato vuol dire che l'annuncio è seguito: vale come conferma
        return supabase.from("apartments").update({ confermato_il: ora() }).eq("id", casa.id);
      },
      "Non sono riuscito a cambiare lo stato della stanza. Riprova.",
    );
  }

  function conferma(casa: CasaMia) {
    const supabase = createClient();
    esegui(
      casa.id,
      () => supabase.from("apartments").update({ confermato_il: ora(), attivo: true }).eq("id", casa.id),
      "Non sono riuscito a confermare l'annuncio. Riprova.",
    );
  }

  function nascondi(casa: CasaMia) {
    const supabase = createClient();
    esegui(
      casa.id,
      () => supabase.from("apartments").update({ attivo: !casa.attivo }).eq("id", casa.id),
      "Non sono riuscito a cambiare la visibilità. Riprova.",
    );
  }

  async function elimina(casa: CasaMia) {
    const supabase = createClient();
    const ok = await esegui(
      casa.id,
      () => supabase.from("apartments").delete().eq("id", casa.id),
      "Non sono riuscito a eliminare l'annuncio. Riprova.",
    );
    if (ok) setDaEliminare(null);
  }

  async function lascia(casa: CasaMia) {
    const supabase = createClient();
    const ok = await esegui(
      casa.id,
      () => supabase.from("housemates").delete().eq("apartment_id", casa.id).eq("profile_id", userId),
      "Non sono riuscito a toglierti dall'annuncio. Riprova.",
    );
    if (ok) setDaLasciare(null);
  }

  if (case_ === null && !errore) {
    return <div aria-busy="true" style={css(`height:60px;font-size:14px;color:${C.grigio};font-weight:600`)}>Carico le tue case…</div>;
  }

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
              Pubblicala in due minuti. Se hai già il messaggio di WhatsApp, incollalo.
            </span>
          </span>
          <Icona nome="freccia" />
        </button>
      )}

      {case_?.map((c) => {
        const scaduto = annuncioScaduto(c);
        const restano = giorniAllaScadenza(c);
        const daConfermare = !scaduto && restano <= 4;
        const fuori = !c.attivo || scaduto;
        return (
          <article key={c.id} style={css(`border:2px solid ${fuori ? C.linea : C.ink};background:${C.carta}`)}>
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
            {(scaduto || !c.attivo || daConfermare) && (
              <div
                style={css(
                  `margin:0 14px 10px;padding:10px 12px;font-size:13.5px;font-weight:700;line-height:1.4;${scaduto || !c.attivo ? `background:${C.sabbia};color:${C.ink}` : `background:${C.ambraFondo};color:${C.ambraTesto}`}`,
                )}
              >
                {!c.attivo
                  ? "Nascosto: nessuno lo vede nella ricerca."
                  : scaduto
                    ? "Non confermato da più di 14 giorni: è sparito dalla ricerca. Se è ancora libera, confermalo."
                    : restano === 0
                      ? "Sparisce dalla ricerca oggi se non lo confermi."
                      : `Sparisce dalla ricerca tra ${restano} ${restano === 1 ? "giorno" : "giorni"} se non lo confermi.`}
              </div>
            )}

            {/* stanze: un selettore per ognuna */}
            {c.rooms.length > 0 && (
              <div style={css("padding:0 14px 12px;display:flex;flex-direction:column;gap:10px")}>
                {c.rooms.map((r, i) => (
                  <div key={r.id}>
                    <div style={css(`font-size:13px;font-weight:700;color:${C.grigio};margin-bottom:6px`)}>
                      {c.rooms.length > 1 ? `Stanza ${i + 1} · ` : ""}
                      {r.tipo === "doppia" ? (r.posti_liberi >= 2 ? `${r.posti_liberi} posti in doppia` : "Posto in doppia") : "Singola"} ·{" "}
                      {euro(r.prezzo_mensile)}
                    </div>
                    <Segmenti
                      etichetta={`Stato della stanza ${i + 1}`}
                      valore={r.stato}
                      opzioni={STATI_STANZA}
                      onChange={(v) => cambiaStato(c, r, v)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* azioni */}
            <div style={css(`display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 14px;border-top:1px solid ${C.linea}`)}>
              <button
                type="button"
                disabled={inCorso === c.id}
                onClick={() => conferma(c)}
                style={css(`${BOTTONE.pieno};height:44px;flex:1 1 100%;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px`)}
              >
                <Icona nome="check" size={18} />
                {inCorso === c.id ? "Un attimo…" : fuori ? "È ancora libera: rimettila online" : "È ancora libera"}
              </button>
              <button type="button" onClick={() => onModifica(c.id)} style={css(`${BOTTONE.piccolo};flex:1;display:flex;align-items:center;justify-content:center;gap:6px`)}>
                <Icona nome="matita" size={16} />
                Modifica
              </button>
              {c.attivo && !scaduto && (
                <button type="button" onClick={() => nascondi(c)} style={css(`${BOTTONE.piccolo};flex:1`)}>
                  Nascondi
                </button>
              )}
              {c.sonoHost ? (
                <button
                  type="button"
                  onClick={() => setDaEliminare(c)}
                  aria-label={`Elimina ${c.titolo}`}
                  style={css(`${BOTTONE.piccolo};width:44px;padding:0;display:grid;place-items:center;border-color:${C.rosso};color:${C.rosso}`)}
                >
                  <Icona nome="cestino" size={18} />
                </button>
              ) : (
                <button type="button" onClick={() => setDaLasciare(c)} style={css(`${BOTTONE.piccolo};flex:1 1 100%;border-color:${C.rosso};color:${C.rosso}`)}>
                  Non abito più qui
                </button>
              )}
            </div>
          </article>
        );
      })}

      <Foglio aperto={!!daEliminare} onChiudi={() => setDaEliminare(null)} titolo="Eliminare l'annuncio?">
        <p style={css(`margin:0 0 6px;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Se la stanza è stata presa non serve eliminarlo: segnala la stanza come <b>Presa</b> e l&apos;annuncio sparisce dalla ricerca, ma resta qui pronto per la prossima volta.
        </p>
        <p style={css(`margin:0 0 16px;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Eliminando cancelli anche foto, stanze e coinquilini collegati. Non si può annullare.
        </p>
        <button type="button" onClick={() => daEliminare && elimina(daEliminare)} disabled={!!inCorso} style={css(`${BOTTONE.pieno};width:100%`)}>
          {inCorso ? "Elimino…" : "Sì, elimina per sempre"}
        </button>
        <button type="button" onClick={() => setDaEliminare(null)} style={css(`${BOTTONE.contorno};width:100%;margin-top:8px`)}>
          Lascialo com&apos;è
        </button>
      </Foglio>

      <Foglio aperto={!!daLasciare} onChiudi={() => setDaLasciare(null)} titolo="Non abiti più qui?">
        <p style={css(`margin:0 0 16px;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          Non comparirai più tra i coinquilini di questa casa. Chi l&apos;ha pubblicata può aggiungerti di nuovo, se serve.
        </p>
        <button type="button" onClick={() => daLasciare && lascia(daLasciare)} disabled={!!inCorso} style={css(`${BOTTONE.pieno};width:100%`)}>
          {inCorso ? "Un attimo…" : "Sì, toglimi"}
        </button>
        <button type="button" onClick={() => setDaLasciare(null)} style={css(`${BOTTONE.contorno};width:100%;margin-top:8px`)}>
          Annulla
        </button>
      </Foglio>
    </div>
  );
}
