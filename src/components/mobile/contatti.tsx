"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { MOTIVI_SEGNALAZIONE } from "@/lib/constants";
import type { MobileAnnuncio } from "@/lib/annuncio-mobile";
import type { AnnuncioPrivato } from "@/lib/types";
import { BOTTONE, C, css } from "./stile";
import { Foglio, Icona } from "./ui";

// ============================================================
// Contatti dell'host.
//
// I recapiti non arrivano con la pagina: si chiedono qui, solo quando
// serve, alla tabella annunci_privati. Il database li dà soltanto a chi
// è entrato con la mail @studio.unibo.it (regola "leggo i contatti").
// ============================================================

/** Numero in formato wa.me: solo cifre, con prefisso internazionale. */
export function numeroWhatsApp(raw: string): string {
  let n = raw.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (/^3\d{8,9}$/.test(n)) n = "39" + n; // cellulare italiano senza prefisso
  return n.replace(/\D/g, "");
}

function messaggioWhatsApp(a: MobileAnnuncio): string {
  return `Ciao! Ho visto la tua stanza in ${a.zona} su SLEPBOLO (${a.prezzo} €/mese). È ancora libera?`;
}

type Stato =
  | { tipo: "ospite" }
  | { tipo: "carico" }
  | { tipo: "ok"; dati: AnnuncioPrivato }
  | { tipo: "vuoto" }
  | { tipo: "errore" };

export function Contatti({
  annuncio,
  loggato,
  onAccedi,
}: {
  annuncio: MobileAnnuncio;
  loggato: boolean;
  onAccedi: () => void;
}) {
  const [stato, setStato] = useState<Stato>(loggato ? { tipo: "carico" } : { tipo: "ospite" });
  const [consigli, setConsigli] = useState(false);
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    if (!loggato) {
      setStato({ tipo: "ospite" });
      return;
    }
    if (!supabaseConfigurato()) {
      setStato({ tipo: "vuoto" });
      return;
    }
    let vivo = true;
    setStato({ tipo: "carico" });
    createClient()
      .from("annunci_privati")
      .select("*")
      .eq("apartment_id", annuncio.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) return setStato({ tipo: "errore" });
        const d = data as AnnuncioPrivato | null;
        if (!d || (!d.contatto_telefono && !d.contatto_whatsapp && !d.contatto_email)) {
          return setStato({ tipo: "vuoto" });
        }
        setStato({ tipo: "ok", dati: d });
      });
    return () => {
      vivo = false;
    };
  }, [annuncio.id, loggato, tentativo]);

  const intestazione = (testo: string) => (
    <div style={css(`font-size:13px;font-weight:800;color:${C.ink};margin-bottom:10px;display:flex;align-items:center;gap:8px`)}>
      {testo}
    </div>
  );

  return (
    <div style={css(`padding:12px 20px calc(16px + env(safe-area-inset-bottom));background:${C.crema};border-top:2px solid ${C.ink}`)}>
      {stato.tipo === "ospite" && (
        <>
          {intestazione("Per contattare chi affitta, entra con la mail UniBo")}
          <button type="button" onClick={onAccedi} style={css(`${BOTTONE.pieno};width:100%;display:flex;align-items:center;gap:10px;text-align:left`)}>
            <Icona nome="lucchetto" />
            <span style={css("flex:1")}>Entra e vedi i contatti</span>
            <Icona nome="freccia" />
          </button>
          <div style={css(`font-size:12.5px;color:${C.grigio};margin-top:8px;line-height:1.4`)}>
            I numeri li vedono solo gli studenti UniBo: così chi pubblica non viene contattato da agenzie e sconosciuti.
          </div>
        </>
      )}

      {stato.tipo === "carico" && (
        <div aria-busy="true" style={css(`height:52px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:${C.grigio}`)}>
          <span style={css(`width:16px;height:16px;border:2px solid ${C.linea};border-top-color:${C.rosso};border-radius:99px;animation:sbSpin .8s linear infinite`)} />
          Carico i contatti…
        </div>
      )}

      {stato.tipo === "errore" && (
        <div style={css("display:flex;align-items:center;gap:10px")}>
          <span style={css(`flex:1;font-size:14px;font-weight:700;color:${C.ink}`)}>Non riesco a caricare i contatti. Controlla la connessione.</span>
          <button type="button" onClick={() => setTentativo((t) => t + 1)} style={css(BOTTONE.piccolo)}>
            Riprova
          </button>
        </div>
      )}

      {stato.tipo === "vuoto" && (
        <div style={css(`font-size:14px;color:${C.grigio};font-weight:600;min-height:44px;display:flex;align-items:center`)}>
          Chi ha pubblicato non ha lasciato recapiti.
        </div>
      )}

      {stato.tipo === "ok" && (
        <>
          {intestazione(
            `Contatta ${stato.dati.contatto_nome || "chi affitta"}${stato.dati.contatto_note ? ` · ${stato.dati.contatto_note}` : ""}`,
          )}
          {stato.dati.via ? (
            <div style={css(`font-size:13px;color:${C.grigio};font-weight:600;margin:-4px 0 10px`)}>Indirizzo: {stato.dati.via}</div>
          ) : null}
          <div style={css("display:flex;gap:8px")}>
            {(stato.dati.contatto_whatsapp || stato.dati.contatto_telefono) && (
              <a
                href={`https://wa.me/${numeroWhatsApp(stato.dati.contatto_whatsapp || stato.dati.contatto_telefono || "")}?text=${encodeURIComponent(messaggioWhatsApp(annuncio))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={css(`${BOTTONE.pieno};flex:1.4;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none`)}
              >
                <Icona nome="chat" size={18} />
                WhatsApp
              </a>
            )}
            {stato.dati.contatto_telefono && (
              <a
                href={`tel:${stato.dati.contatto_telefono.replace(/\s/g, "")}`}
                style={css(`${BOTTONE.scuro};flex:1;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none`)}
              >
                <Icona nome="telefono" size={18} />
                Chiama
              </a>
            )}
            {stato.dati.contatto_email && (
              <a
                href={`mailto:${stato.dati.contatto_email}?subject=${encodeURIComponent(`Stanza in ${annuncio.zona} (SLEPBOLO)`)}`}
                aria-label="Scrivi una email"
                style={css(`${BOTTONE.contorno};height:52px;flex:none;width:52px;padding:0;display:grid;place-items:center;text-decoration:none`)}
              >
                <Icona nome="mail" />
              </a>
            )}
          </div>
          <div style={css(`font-size:12.5px;color:${C.grigio};margin-top:8px`)}>
            Il messaggio WhatsApp è già scritto: puoi cambiarlo prima di inviarlo.
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setConsigli(true)}
        style={css(`margin-top:10px;min-height:44px;border:0;background:transparent;color:${C.ink};font-family:inherit;font-size:13px;font-weight:800;display:flex;align-items:center;gap:8px;padding:0;cursor:pointer`)}
      >
        <Icona nome="scudo" size={18} />
        Prima di pagare: 4 cose da controllare
      </button>

      <Foglio aperto={consigli} onChiudi={() => setConsigli(false)} titolo="Prima di versare qualsiasi cifra">
        <ol style={css(`margin:0;padding-left:20px;display:flex;flex-direction:column;gap:12px;font-size:15px;line-height:1.45;color:${C.testo}`)}>
          <li><b>Vedi la casa di persona</b>, o almeno in videochiamata dal vivo, prima di dare soldi.</li>
          <li><b>Niente caparra prima della visita.</b> Chi la chiede per &laquo;bloccarti la stanza&raquo; è il segnale di truffa più comune.</li>
          <li><b>Diffida di chi è sempre all&apos;estero</b> e manda le chiavi per posta.</li>
          <li><b>Chiedi il contratto registrato.</b> È un tuo diritto: senza registrazione non hai tutele, e la tua famiglia non può detrarre l&apos;affitto dalle tasse.</li>
        </ol>
        <div style={css(`margin-top:16px;font-size:13.5px;color:${C.grigio};line-height:1.4`)}>
          Se qualcosa non torna, segnala l&apos;annuncio: lo controlliamo e, se serve, lo togliamo.
        </div>
      </Foglio>
    </div>
  );
}

// ============================================================
// Segnala un annuncio
// ============================================================

export function Segnala({
  apartmentId,
  loggato,
  onAccedi,
}: {
  apartmentId: string;
  loggato: boolean;
  onAccedi: () => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [motivo, setMotivo] = useState<string>("");
  const [dettaglio, setDettaglio] = useState("");
  const [fase, setFase] = useState<"scelta" | "invio" | "fatto" | "errore">("scelta");

  async function invia() {
    if (!motivo || !supabaseConfigurato()) return;
    setFase("invio");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("reports").insert({
      apartment_id: apartmentId,
      reporter_id: user?.id ?? null,
      motivo,
      dettaglio: dettaglio.trim() || null,
    });
    setFase(error ? "errore" : "fatto");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (loggato ? setAperto(true) : onAccedi())}
        style={css(`min-height:44px;border:0;background:transparent;color:${C.grigio};font-family:inherit;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px`)}
      >
        <Icona nome="bandiera" size={16} />
        Segnala questo annuncio
      </button>

      <Foglio
        aperto={aperto}
        onChiudi={() => {
          setAperto(false);
          setFase("scelta");
          setMotivo("");
          setDettaglio("");
        }}
        titolo={fase === "fatto" ? "Grazie, lo controlliamo" : "Cosa non va?"}
      >
        {fase === "fatto" ? (
          <p style={css(`margin:0;font-size:15px;line-height:1.45;color:${C.testo}`)}>
            La segnalazione è arrivata. Se l&apos;annuncio non è corretto lo togliamo dalla ricerca.
          </p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Motivo della segnalazione" style={css("display:flex;flex-direction:column;gap:8px")}>
              {MOTIVI_SEGNALAZIONE.map((m) => {
                const on = motivo === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMotivo(m.value)}
                    style={css(
                      `min-height:48px;text-align:left;border:2px solid ${on ? C.rosso : C.linea};background:${on ? "rgba(162,0,29,.06)" : C.carta};color:${C.ink};font-family:inherit;font-size:15px;font-weight:700;padding:10px 14px;cursor:pointer`,
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <label style={css(`display:block;margin-top:14px;font-size:13px;font-weight:800;color:${C.ink}`)}>
              Vuoi aggiungere qualcosa? (facoltativo)
              <textarea
                value={dettaglio}
                onChange={(e) => setDettaglio(e.target.value)}
                maxLength={500}
                rows={3}
                style={css(`margin-top:6px;width:100%;border:2px solid ${C.linea};background:${C.carta};padding:10px 12px;font-family:inherit;font-size:16px;color:${C.ink};resize:vertical`)}
              />
            </label>
            {fase === "errore" && (
              <div role="alert" style={css(`margin-top:10px;font-size:14px;font-weight:700;color:${C.rosso}`)}>
                Non sono riuscito a inviarla. Riprova tra poco.
              </div>
            )}
            <button
              type="button"
              disabled={!motivo || fase === "invio"}
              onClick={invia}
              style={css(`${BOTTONE.pieno};width:100%;margin-top:16px;opacity:${!motivo ? 0.5 : 1}`)}
            >
              {fase === "invio" ? "Invio…" : "Invia segnalazione"}
            </button>
          </>
        )}
      </Foglio>
    </>
  );
}
