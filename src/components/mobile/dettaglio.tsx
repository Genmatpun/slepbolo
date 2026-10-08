"use client";

import { useMemo, useState } from "react";
import type { MobileAnnuncio, MobileStanza } from "@/lib/annuncio-mobile";
import { SEDI_UNIBO, etichettaPreferenza, personaCoinquilino, tempiVersoSede } from "@/lib/constants";
import { giorniDa, quandoAggiornato } from "@/lib/types";
import { C, EASE, SFONDI_CASA, css, dataBreve, euro } from "./stile";
import { Freschezza, Icona, Sezione } from "./ui";
import { Contatti, Segnala } from "./contatti";
import { Quadratini, etichettaCamere, etichettaGenereCasa } from "./pezzi";

// ============================================================
// Dettaglio di una casa.
// ============================================================

function hash(id: string): number {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % 997;
  return n;
}
export const sfondoCasa = (id: string) => SFONDI_CASA[(hash(id) * 7) % SFONDI_CASA.length];

function postiStanza(s: MobileStanza): string {
  if (s.tipo === "Doppia") return s.posti >= 2 ? `${s.posti} posti in doppia` : "Posto letto in doppia";
  return "Singola";
}

function speseStanza(s: MobileStanza): string {
  const voci = s.speseComprendono.length ? ` (${s.speseComprendono.join(", ")})` : "";
  if (s.speseIncl) return `spese incluse${voci}`;
  if (s.spese) return `+ ${s.spese} € di spese${voci}`;
  return "spese escluse";
}

function disponibilita(s: MobileStanza): string {
  const oggi = new Date().toISOString().slice(0, 10);
  const dal = !s.dal || s.dal <= oggi ? "Libera da subito" : `Libera dal ${dataBreve(s.dal)}`;
  return s.fino ? `${dal} al ${dataBreve(s.fino)}` : dal;
}

export function Dettaglio({
  a,
  salvata,
  onSalva,
  onChiudi,
  loggato,
  onAccedi,
  sedeUtente,
  onAvviso,
}: {
  a: MobileAnnuncio;
  salvata: boolean;
  onSalva: () => void;
  onChiudi: () => void;
  loggato: boolean;
  onAccedi: () => void;
  sedeUtente: string | null;
  onAvviso: (testo: string) => void;
}) {
  const [descrizioneAperta, setDescrizioneAperta] = useState(false);

  const distanze = useMemo(() => {
    const tutte = SEDI_UNIBO.map((s) => ({ ...s, ...tempiVersoSede(a, s) })).sort((x, y) => x.km - y.km);
    // la sede dell'utente sempre in cima, poi le due più vicine
    const mia = sedeUtente ? tutte.find((s) => s.nome === sedeUtente || s.key === sedeUtente) : undefined;
    const altre = tutte.filter((s) => s !== mia).slice(0, mia ? 2 : 3);
    return mia ? [mia, ...altre] : altre;
  }, [a, sedeUtente]);

  const aperte = a.stanze.filter((s) => s.stato !== "occupata");
  const prese = a.stanze.filter((s) => s.stato === "occupata");
  const prezziDiversi = new Set(aperte.map((s) => s.prezzo)).size > 1;
  // stanze identiche (stesso tipo, prezzo, date…) si mostrano una volta sola, con il numero
  const gruppi = useMemo(() => {
    const mappa = new Map<string, { s: MobileStanza; n: number }>();
    for (const s of aperte) {
      const chiave = JSON.stringify([s.tipo, s.posti, s.prezzo, s.speseIncl, s.spese, s.speseComprendono, s.dal, s.fino, s.min, s.nota, s.stato]);
      const g = mappa.get(chiave);
      if (g) g.n += 1;
      else mappa.set(chiave, { s, n: 1 });
    }
    return [...mappa.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.stanze]);
  const soloTrattativa = aperte.length > 0 && aperte.every((s) => s.stato === "in_trattativa");
  const genereCasa = etichettaGenereCasa(a.genere);
  const lunga = a.descrizione.length > 320;

  async function condividi() {
    const url = `${window.location.origin}/app?casa=${a.id}&da=condivisione`;
    const testo = `${a.tipo} in ${a.zona}, ${a.prezzo} €/mese — su SLEPBOLO vedi chi ci abita già.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: a.titolo, text: testo, url });
        return;
      }
      await navigator.clipboard.writeText(`${testo} ${url}`);
      onAvviso("Link copiato: incollalo dove vuoi");
    } catch {
      // l'utente ha chiuso la condivisione: niente da fare
    }
  }

  const tondo = `width:44px;height:44px;border:0;background:${C.crema};color:${C.ink};display:grid;place-items:center;cursor:pointer`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={a.titolo}
      style={css(`position:absolute;inset:0;background:${C.crema};z-index:70;display:flex;flex-direction:column;animation:sbSlide .34s ${EASE} both`)}
    >
      <div className="sb-noscroll" style={css("flex:1;overflow:auto")}>
        {/* foto */}
        <div style={css("position:relative;height:270px")}>
          {a.foto.length ? (
            <div className="sb-noscroll" style={css("display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory")}>
              {a.foto.map((u, k) => (
                <div
                  key={k}
                  role="img"
                  aria-label={`Foto ${k + 1} di ${a.foto.length}`}
                  style={css(`flex:0 0 100%;width:100%;height:100%;scroll-snap-align:center;background:${C.ink} url('${u}') center/cover no-repeat`)}
                />
              ))}
            </div>
          ) : (
            <div style={css(`height:100%;display:grid;place-items:center;background:${sfondoCasa(a.id)}`)}>
              <span aria-hidden style={css("font-size:96px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.2)")}>
                {a.zona.slice(0, 3).toUpperCase()}
              </span>
            </div>
          )}
          <div style={css("position:absolute;left:16px;right:16px;top:calc(16px + env(safe-area-inset-top));display:flex;gap:8px")}>
            <button type="button" onClick={onChiudi} aria-label="Torna indietro" style={css(tondo)}>
              <Icona nome="indietro" />
            </button>
            <span style={css("flex:1")} />
            <button type="button" onClick={condividi} aria-label="Condividi questa casa" style={css(tondo)}>
              <Icona nome="condividi" />
            </button>
            <button
              type="button"
              onClick={onSalva}
              aria-pressed={salvata}
              style={css(
                `height:44px;padding:0 14px;border:0;background:${salvata ? C.verde : C.crema};color:${salvata ? C.crema : C.ink};font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .2s`,
              )}
            >
              {salvata ? <Icona nome="check" size={18} /> : null}
              {salvata ? "Salvata" : "Salva"}
            </button>
          </div>
          {a.foto.length > 1 && (
            <span style={css(`position:absolute;right:16px;bottom:16px;background:rgba(27,24,21,.78);color:${C.crema};padding:6px 10px;font-size:12px;font-weight:800`)}>
              {a.foto.length} foto · scorri
            </span>
          )}
          <span style={css(`position:absolute;left:16px;bottom:16px;background:${C.crema};padding:6px 11px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase`)}>
            {a.zona}
          </span>
        </div>

        <div style={css("padding:20px 20px 0")}>
          <h1 style={css("margin:0;font-size:29px;font-weight:900;letter-spacing:-.04em;line-height:1.05;text-wrap:balance")}>{a.titolo}</h1>
          <div style={css("margin-top:8px")}>
            <Freschezza testo={quandoAggiornato(a.aggiornato)} giorni={giorniDa(a.aggiornato)} />
          </div>

          {soloTrattativa && (
            <div role="note" style={css(`margin-top:14px;border:2px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:12px 14px;font-size:14px;font-weight:700;line-height:1.4`)}>
              Qualcuno la sta già trattando. Puoi scrivere lo stesso: se salta, sei il primo della lista.
            </div>
          )}

          <div style={css(`display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 10px;margin-top:14px;border-top:2px solid ${C.ink};border-bottom:2px solid ${C.ink};padding:12px 0`)}>
            <span style={css("font-size:34px;font-weight:900;letter-spacing:-.04em")}>
              {prezziDiversi ? "da " : ""}
              {euro(a.prezzo)}
            </span>
            <span style={css(`font-size:14px;font-weight:700;color:${C.grigio}`)}>al mese · {a.spese}</span>
          </div>

          <div style={css("display:flex;align-items:center;gap:10px;padding:16px 0 4px")}>
            <Quadratini a={a} size={14} />
            <span style={css("font-size:14px;font-weight:700")}>{etichettaCamere(a)}</span>
          </div>

          {/* cose che si chiedono per prime */}
          <dl style={css(`margin:14px 0 0;display:grid;grid-template-columns:auto 1fr;gap:8px 14px;font-size:14px`)}>
            {genereCasa && (
              <>
                <dt style={css(`color:${C.grigio};font-weight:600`)}>Casa</dt>
                <dd style={css("margin:0;font-weight:800")}>{genereCasa}</dd>
              </>
            )}
            <dt style={css(`color:${C.grigio};font-weight:600`)}>Contratto</dt>
            <dd style={css("margin:0;font-weight:800")}>
              {a.contratto}
              {a.agenzia ? <span style={css(`font-weight:700;color:${C.arancioTesto}`)}> · tramite agenzia</span> : null}
            </dd>
            {a.caparra && (
              <>
                <dt style={css(`color:${C.grigio};font-weight:600`)}>Caparra</dt>
                <dd style={css("margin:0;font-weight:800")}>{a.caparra}</dd>
              </>
            )}
            {(a.piano || a.bagni) && (
              <>
                <dt style={css(`color:${C.grigio};font-weight:600`)}>Spazi</dt>
                <dd style={css("margin:0;font-weight:800")}>
                  {[
                    // "3" o "3°" → "3° piano"; un testo libero ("Villetta con giardino") resta com'è
                    a.piano ? (/^\d+\s*°?$/.test(a.piano.trim()) ? `${a.piano.trim().replace(/°?$/, "°")} piano` : a.piano) : null,
                    a.bagni ? `${a.bagni} ${a.bagni === 1 ? "bagno" : "bagni"}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* stanze */}
        <div style={css("padding:0 20px")}>
          <Sezione titolo={aperte.length === 1 ? "La stanza" : "Le stanze"} />
          <div style={css("display:flex;flex-direction:column;gap:10px")}>
            {gruppi.map(({ s, n }) => (
              <div key={s.id} style={css(`border:2px solid ${C.ink};background:${C.carta};padding:14px`)}>
                <div style={css("display:flex;align-items:baseline;gap:10px")}>
                  <span style={css("font-size:16px;font-weight:900;letter-spacing:-.02em")}>
                    {n > 1 ? `${n} × ` : ""}
                    {postiStanza(s)}
                  </span>
                  {s.stato === "in_trattativa" && (
                    <span style={css(`border:1px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:2px 7px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em`)}>
                      In trattativa
                    </span>
                  )}
                  <span style={css("margin-left:auto;font-size:18px;font-weight:900")}>
                    {euro(s.prezzo)}
                    {s.tipo === "Doppia" && s.posti >= 2 ? (
                      <span style={css(`font-size:12px;color:${C.grigio}`)}> a posto</span>
                    ) : n > 1 ? (
                      <span style={css(`font-size:12px;color:${C.grigio}`)}> ciascuna</span>
                    ) : null}
                  </span>
                </div>
                <div style={css(`margin-top:6px;font-size:14px;color:${C.testo};line-height:1.45`)}>
                  {speseStanza(s)}
                  <br />
                  {disponibilita(s)} · minimo {s.min} {s.min === 1 ? "mese" : "mesi"}
                  {s.nota ? (
                    <>
                      <br />
                      <span style={css(`color:${C.grigio}`)}>{s.nota}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {prese.length > 0 && (
              <div style={css(`font-size:13px;color:${C.grigio};font-weight:600`)}>
                {prese.length === 1 ? "Un'altra stanza è già stata presa." : `Altre ${prese.length} stanze sono già state prese.`}
              </div>
            )}
          </div>
        </div>

        {/* chi ci abita */}
        <div style={css("padding:0 20px")}>
          <Sezione titolo="Chi ci abita già" />
          {a.coinq.length === 0 ? (
            <div style={css(`font-size:14px;color:${C.grigio}`)}>Chi pubblica non ha ancora descritto i coinquilini.</div>
          ) : (
            a.coinq.map((p, k) => {
              const per = personaCoinquilino(p.g);
              return (
                <div key={k} style={css(`display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid ${C.linea}`)}>
                  <span aria-hidden style={css(`width:42px;height:42px;flex:none;display:grid;place-items:center;background:${C.sabbia};font-size:22px`)}>
                    {per.emoji}
                  </span>
                  <div style={css("flex:1;min-width:0")}>
                    <div style={css("font-size:15px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:7px;flex-wrap:wrap")}>
                      <span>
                        {per.label}
                        {p.e ? `, ${p.e} anni` : ""}
                      </span>
                      {p.pending ? (
                        <span style={css(`border:1px solid ${C.ambra};background:${C.ambraFondo};color:${C.ambraTesto};padding:2px 6px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase`)}>
                          Deve confermare
                        </span>
                      ) : null}
                    </div>
                    {p.c ? <div style={css(`font-size:13px;color:${C.grigio};font-weight:600`)}>{p.c}</div> : null}
                    {p.ab.length > 0 && (
                      <div style={css("display:flex;flex-wrap:wrap;gap:5px;margin-top:7px")}>
                        {p.ab.map((x, j) => (
                          <span key={j} style={css(`border:1px solid ${C.linea};background:${C.crema};color:${C.grigio};padding:3px 8px;font-size:12px;font-weight:700`)}>
                            {x}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {a.preferenze.length > 0 && (
            <div style={css("margin-top:14px")}>
              <div style={css(`font-size:13px;font-weight:800;margin-bottom:8px`)}>Cercano</div>
              <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                {a.preferenze.map((p) => (
                  <span key={p} style={css(`border:1px solid ${C.ink};padding:5px 10px;font-size:12.5px;font-weight:700`)}>
                    {etichettaPreferenza(p)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* distanze */}
        <div style={css("padding:0 20px")}>
          <Sezione titolo="Quanto ci metti a lezione" />
          {distanze.map((d, i) => (
            <div key={d.key} style={css(`display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid ${C.linea}`)}>
              <span style={css("font-size:14px;font-weight:700;letter-spacing:-.01em;flex:1;min-width:0")}>
                {d.nome}
                {i === 0 && sedeUtente && (d.nome === sedeUtente || d.key === sedeUtente) ? (
                  <span style={css(`color:${C.grigio};font-weight:600`)}> · la tua sede</span>
                ) : null}
              </span>
              <span style={css("font-size:13px;font-weight:800;white-space:nowrap")}>~{d.bici}′ in bici</span>
              <span style={css(`font-size:13px;color:${C.grigio};font-weight:600;white-space:nowrap`)}>~{d.piedi}′ a piedi</span>
            </div>
          ))}
          <div style={css(`font-size:12px;color:${C.grigio};margin-top:8px`)}>
            Tempi stimati dalla zona, non dall&apos;indirizzo preciso.
          </div>
          {a.vicinoA && (
            <div style={css(`margin-top:12px;font-size:14px;line-height:1.45`)}>
              <b>Vicino:</b> {a.vicinoA}
            </div>
          )}
        </div>

        {/* servizi e descrizione */}
        {a.servizi.length > 0 && (
          <div style={css("padding:0 20px")}>
            <Sezione titolo="In casa" />
            <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
              {a.servizi.map((s, k) => (
                <span key={k} style={css(`border:1px solid ${C.linea};background:${C.carta};padding:6px 10px;font-size:13px;font-weight:700;color:${C.testo}`)}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {a.descrizione && (
          <div style={css("padding:0 20px")}>
            <Sezione titolo="Cosa dice chi pubblica" />
            <p
              style={css(
                `margin:0;font-size:15px;line-height:1.55;color:${C.testo};white-space:pre-line;overflow-wrap:anywhere;${lunga && !descrizioneAperta ? "display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden" : ""}`,
              )}
            >
              {a.descrizione}
            </p>
            {lunga && (
              <button
                type="button"
                onClick={() => setDescrizioneAperta((v) => !v)}
                style={css(`min-height:44px;border:0;background:transparent;color:${C.ink};font-family:inherit;font-size:14px;font-weight:800;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px`)}
              >
                {descrizioneAperta ? "Mostra meno" : "Leggi tutto"}
              </button>
            )}
          </div>
        )}

        {a.linkFoto && (
          <div style={css("padding:16px 20px 0")}>
            <a
              href={a.linkFoto}
              target="_blank"
              rel="noopener noreferrer nofollow"
              style={css(`min-height:44px;display:inline-flex;align-items:center;gap:8px;color:${C.ink};font-size:14px;font-weight:800`)}
            >
              <Icona nome="esterno" size={18} />
              Altre foto su {(() => {
                try {
                  return new URL(a.linkFoto).hostname.replace(/^www\./, "");
                } catch {
                  return "un altro sito";
                }
              })()}
            </a>
          </div>
        )}

        <div style={css("padding:12px 20px 28px")}>
          <Segnala apartmentId={a.id} loggato={loggato} onAccedi={onAccedi} />
        </div>
      </div>

      <Contatti annuncio={a} loggato={loggato} onAccedi={onAccedi} />
    </div>
  );
}
