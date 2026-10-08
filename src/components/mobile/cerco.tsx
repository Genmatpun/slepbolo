"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { ANNI_CORSO, ZONE_BOLOGNA } from "@/lib/constants";
import { giorniDa, quandoAggiornato, type Cerco } from "@/lib/types";
import { BOTTONE, C, CAMPO, EASE, css, dataBreve, euro } from "./stile";
import { Campo, CampoTesto, Chip, Freschezza, Icona, Segmenti } from "./ui";
import { numeroWhatsApp } from "./contatti";

// ============================================================
// Bacheca "Cerco stanza".
// Un annuncio per persona; sparisce dopo 30 giorni senza conferma.
// ============================================================

const GIORNI_CERCO = 30;

const TIPI = [
  { value: "indifferente", label: "Qualsiasi" },
  { value: "singola", label: "Singola" },
  { value: "doppia", label: "Doppia" },
  { value: "posto_letto", label: "Posto letto" },
] as const;
type TipoCerco = (typeof TIPI)[number]["value"];

const sembraNumero = (s: string) => /^[+\d][\d\s.-]{7,}$/.test(s.trim());

// ---------- elenco ----------

export function BachecaCerco({
  loggato,
  mioId,
  onAccedi,
  onModificaMio,
}: {
  loggato: boolean;
  mioId: string | null;
  onAccedi: () => void;
  onModificaMio: () => void;
}) {
  const [voci, setVoci] = useState<Cerco[] | null>(null);
  const [errore, setErrore] = useState(false);

  const carica = useCallback(async () => {
    if (!loggato || !supabaseConfigurato()) return;
    const limite = new Date(Date.now() - GIORNI_CERCO * 86_400_000).toISOString();
    const { data, error } = await createClient()
      .from("cerco")
      .select("*")
      .eq("attivo", true)
      .gte("confermato_il", limite)
      .order("confermato_il", { ascending: false })
      .limit(100);
    if (error) return setErrore(true);
    setErrore(false);
    setVoci((data ?? []) as Cerco[]);
  }, [loggato]);

  useEffect(() => {
    carica();
  }, [carica]);

  if (!loggato) {
    return (
      <div style={css(`margin:4px 20px 0;border:2px solid ${C.ink};background:${C.carta};padding:20px`)}>
        <div style={css("font-size:19px;font-weight:900;letter-spacing:-.03em;line-height:1.15")}>Chi cerca stanza, in un posto solo.</div>
        <p style={css(`margin:8px 0 16px;font-size:14.5px;line-height:1.45;color:${C.testo}`)}>
          Se hai una stanza libera, qui trovi gli studenti che la cercano: età, corso, zona, budget. La bacheca la vedono solo gli studenti UniBo.
        </p>
        <button type="button" onClick={onAccedi} style={css(`${BOTTONE.pieno};width:100%;display:flex;align-items:center;gap:10px;text-align:left`)}>
          <Icona nome="lucchetto" />
          <span style={css("flex:1")}>Entra con la mail UniBo</span>
          <Icona nome="freccia" />
        </button>
      </div>
    );
  }

  if (errore) {
    return (
      <div style={css("margin:4px 20px 0;display:flex;align-items:center;gap:10px")}>
        <span style={css(`flex:1;font-size:14px;font-weight:700`)}>Non riesco a caricare la bacheca.</span>
        <button type="button" onClick={carica} style={css(BOTTONE.piccolo)}>
          Riprova
        </button>
      </div>
    );
  }

  if (voci === null) {
    return <div aria-busy="true" style={css(`padding:4px 20px;font-size:14px;color:${C.grigio}`)}>Carico la bacheca…</div>;
  }

  const mio = voci.find((v) => v.profile_id === mioId);

  return (
    <div>
      <div style={css("padding:0 20px 14px")}>
        <button
          type="button"
          onClick={onModificaMio}
          style={css(`width:100%;display:flex;align-items:center;gap:10px;border:2px solid ${C.ink};background:${mio ? C.carta : C.ink};color:${mio ? C.ink : C.crema};padding:12px 14px;font-family:inherit;font-size:14px;font-weight:800;text-align:left;cursor:pointer`)}
        >
          <Icona nome={mio ? "matita" : "piu"} size={18} />
          <span style={css("flex:1")}>{mio ? "Il tuo annuncio è online · modificalo" : "Cerchi stanza? Pubblica il tuo annuncio"}</span>
          <Icona nome="freccia" size={18} />
        </button>
      </div>

      {voci.length === 0 ? (
        <div style={css(`margin:0 20px;border:2px dashed ${C.linea};padding:22px 18px;font-size:14.5px;color:${C.grigio};line-height:1.45`)}>
          Per ora nessuno ha pubblicato. Se cerchi stanza, sii il primo: chi affitta passa da qui.
        </div>
      ) : (
        voci.map((v) => (
          <article key={v.id} style={css(`padding:16px 20px;border-top:1px solid ${C.linea}`)}>
            <div style={css("display:flex;align-items:baseline;gap:8px;flex-wrap:wrap")}>
              <h3 style={css("margin:0;font-size:17px;font-weight:900;letter-spacing:-.02em")}>
                {v.nome}
                {v.eta ? `, ${v.eta}` : ""}
              </h3>
              {v.lavoratore && (
                <span style={css(`border:1px solid ${C.ink};padding:2px 7px;font-size:11.5px;font-weight:800`)}>studente-lavoratore</span>
              )}
              {v.profile_id === mioId && <span style={css(`font-size:12px;font-weight:700;color:${C.grigio}`)}>· sei tu</span>}
            </div>
            {(v.corso || v.anno) && (
              <div style={css(`font-size:13.5px;color:${C.grigio};font-weight:600;margin-top:2px`)}>
                {[v.corso, v.anno].filter(Boolean).join(" · ")}
              </div>
            )}
            <p style={css(`margin:10px 0;font-size:15px;line-height:1.5;color:${C.testo};white-space:pre-line;overflow-wrap:anywhere`)}>{v.testo}</p>
            <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
              {v.budget_max ? <Etichetta>fino a {euro(v.budget_max)}</Etichetta> : null}
              {v.dal ? <Etichetta>dal {dataBreve(v.dal)}</Etichetta> : null}
              {v.tipo && v.tipo !== "indifferente" ? <Etichetta>{TIPI.find((t) => t.value === v.tipo)?.label}</Etichetta> : null}
              {v.zone.map((z) => (
                <Etichetta key={z}>{z}</Etichetta>
              ))}
            </div>
            <div style={css("display:flex;align-items:center;gap:10px;margin-top:12px")}>
              <Freschezza testo={quandoAggiornato(v.confermato_il)} giorni={giorniDa(v.confermato_il)} />
              {v.contatto && v.profile_id !== mioId ? (
                sembraNumero(v.contatto) ? (
                  <a
                    href={`https://wa.me/${numeroWhatsApp(v.contatto)}?text=${encodeURIComponent(`Ciao ${v.nome}! Ho visto il tuo annuncio su SLEPBOLO: ho una stanza che potrebbe interessarti.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={css(`${BOTTONE.piccolo};margin-left:auto;display:flex;align-items:center;gap:6px;text-decoration:none;background:${C.ink};color:${C.crema}`)}
                  >
                    <Icona nome="chat" size={16} />
                    Scrivigli
                  </a>
                ) : (
                  <span style={css("margin-left:auto;font-size:13.5px;font-weight:800")}>{v.contatto}</span>
                )
              ) : null}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function Etichetta({ children }: { children: React.ReactNode }) {
  return <span style={css(`border:1px solid ${C.linea};background:${C.carta};padding:4px 9px;font-size:12.5px;font-weight:700;color:${C.testo}`)}>{children}</span>;
}

// ---------- il mio annuncio ----------

export function IlMioCerco({ userId, onChiudi }: { userId: string; onChiudi: () => void }) {
  const [carico, setCarico] = useState(true);
  const [esiste, setEsiste] = useState(false);
  const [nome, setNome] = useState("");
  const [eta, setEta] = useState("");
  const [corso, setCorso] = useState("");
  const [anno, setAnno] = useState("");
  const [genere, setGenere] = useState<string | null>(null);
  const [lavoratore, setLavoratore] = useState(false);
  const [testo, setTesto] = useState("");
  const [zone, setZone] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [dal, setDal] = useState("");
  const [tipo, setTipo] = useState<TipoCerco>("indifferente");
  const [contatto, setContatto] = useState("");
  const [fase, setFase] = useState<"" | "invio" | "fatto" | "errore">("");
  const [msgErrore, setMsgErrore] = useState("");

  useEffect(() => {
    if (!supabaseConfigurato()) return setCarico(false);
    const supabase = createClient();
    Promise.all([
      supabase.from("cerco").select("*").eq("profile_id", userId).maybeSingle(),
      supabase
        .from("profiles")
        .select("nome, eta, corso_laurea, anno, genere, studente_lavoratore, zone_preferite, budget_max, cerco_dal, bio")
        .eq("id", userId)
        .single(),
    ]).then(([c, p]) => {
      const mio = c.data as Cerco | null;
      const prof = p.data;
      if (mio) {
        setEsiste(true);
        setNome(mio.nome);
        setEta(mio.eta ? String(mio.eta) : "");
        setCorso(mio.corso ?? "");
        setAnno(mio.anno ?? "");
        setGenere(mio.genere);
        setLavoratore(mio.lavoratore);
        setTesto(mio.testo);
        setZone(mio.zone);
        setBudget(mio.budget_max ? String(mio.budget_max) : "");
        setDal(mio.dal ?? "");
        setTipo((mio.tipo as TipoCerco) ?? "indifferente");
        setContatto(mio.contatto ?? "");
      } else if (prof) {
        // primo annuncio: parto dal profilo, con il solo nome di battesimo
        setNome((prof.nome ?? "").split(" ")[0]);
        setEta(prof.eta ? String(prof.eta) : "");
        setCorso(prof.corso_laurea ?? "");
        setAnno(prof.anno ?? "");
        setGenere(prof.genere ?? null);
        setLavoratore(!!prof.studente_lavoratore);
        setZone((prof.zone_preferite as string[]) ?? []);
        setBudget(prof.budget_max ? String(prof.budget_max) : "");
        setDal(prof.cerco_dal ?? "");
        setTesto(prof.bio ?? "");
      }
      setCarico(false);
    });
  }, [userId]);

  async function salva(extra: Record<string, unknown> = {}) {
    if (testo.trim().length < 10) {
      setMsgErrore("Scrivi almeno una frase su di te e su cosa cerchi.");
      setFase("errore");
      return;
    }
    if (!nome.trim()) {
      setMsgErrore("Serve almeno il nome.");
      setFase("errore");
      return;
    }
    setFase("invio");
    const riga = {
      profile_id: userId,
      nome: nome.trim().slice(0, 40),
      eta: eta ? Number(eta) : null,
      genere,
      corso: corso.trim() || null,
      anno: anno || null,
      lavoratore,
      testo: testo.trim().slice(0, 600),
      zone,
      budget_max: budget ? Number(budget) : null,
      dal: dal || null,
      tipo,
      contatto: contatto.trim() || null,
      attivo: true,
      confermato_il: new Date().toISOString(),
      ...extra,
    };
    const { error } = await createClient().from("cerco").upsert(riga, { onConflict: "profile_id" });
    if (error) {
      setMsgErrore("Non sono riuscito a salvare. Controlla la connessione e riprova.");
      setFase("errore");
      return;
    }
    setEsiste(true);
    setFase("fatto");
  }

  async function togli() {
    setFase("invio");
    const { error } = await createClient().from("cerco").delete().eq("profile_id", userId);
    if (error) {
      setMsgErrore("Non sono riuscito a togliere l'annuncio. Riprova.");
      setFase("errore");
      return;
    }
    onChiudi();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Il tuo annuncio Cerco stanza"
      style={css(`position:absolute;inset:0;z-index:80;background:${C.crema};display:flex;flex-direction:column;animation:sbSlide .32s ${EASE} both`)}
    >
      <div style={css(`display:flex;align-items:center;gap:8px;padding:calc(12px + env(safe-area-inset-top)) 12px 12px;border-bottom:2px solid ${C.ink}`)}>
        <button type="button" onClick={onChiudi} aria-label="Chiudi" style={css(`width:44px;height:44px;border:0;background:transparent;color:${C.ink};display:grid;place-items:center;cursor:pointer`)}>
          <Icona nome="indietro" />
        </button>
        <h1 style={css("margin:0;font-size:19px;font-weight:900;letter-spacing:-.03em")}>Cerco stanza</h1>
      </div>

      {carico ? (
        <div aria-busy="true" style={css(`padding:20px;font-size:14px;color:${C.grigio}`)}>Carico…</div>
      ) : (
        <div className="sb-noscroll" style={css("flex:1;overflow:auto;padding:18px 20px 40px;display:flex;flex-direction:column;gap:14px")}>
          <p style={css(`margin:0;font-size:14.5px;line-height:1.45;color:${C.testo}`)}>
            Lo vedono solo gli studenti UniBo. Di te compare solo quello che scrivi qui: il profilo resta privato.
          </p>

          <Campo etichetta="Cosa cerchi, in due righe" aiuto={`${testo.length}/600`}>
            {(id, d) => (
              <textarea
                id={id}
                aria-describedby={d}
                rows={4}
                maxLength={600}
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="Es. Cerco una singola da novembre, studio Ingegneria, sono tranquillo e cucino spesso. Due anni da fuorisede alle spalle."
                style={css(`${CAMPO};height:auto;padding:10px 12px;resize:vertical;min-height:110px;line-height:1.45`)}
              />
            )}
          </Campo>

          <div style={css("display:grid;grid-template-columns:1fr 90px;gap:10px")}>
            <CampoTesto etichetta="Nome che vedranno" value={nome} onChange={setNome} maxLength={40} />
            <CampoTesto etichetta="Età" value={eta} onChange={(v) => setEta(v.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
          </div>
          <CampoTesto etichetta="Corso" value={corso} onChange={setCorso} maxLength={80} />
          <Campo etichetta="Anno">
            {(id) => (
              <select id={id} value={anno} onChange={(e) => setAnno(e.target.value)} style={css(CAMPO)}>
                <option value="">— non dirlo —</option>
                {ANNI_CORSO.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <label style={css(`display:flex;align-items:center;gap:12px;min-height:48px;border:2px solid ${lavoratore ? C.rosso : C.linea};padding:0 14px;cursor:pointer;font-size:15px;font-weight:700`)}>
            <input type="checkbox" checked={lavoratore} onChange={(e) => setLavoratore(e.target.checked)} style={css(`width:20px;height:20px;accent-color:${C.rosso}`)} />
            Sono anche studente-lavoratore
          </label>

          <Campo etichetta="Che stanza">
            {() => <Segmenti etichetta="Tipo di stanza" valore={tipo} opzioni={TIPI} onChange={setTipo} />}
          </Campo>
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
            <CampoTesto etichetta="Budget max (€)" value={budget} onChange={(v) => setBudget(v.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" />
            <Campo etichetta="Dal">
              {(id) => <input id={id} type="date" value={dal} onChange={(e) => setDal(e.target.value)} style={css(CAMPO)} />}
            </Campo>
          </div>
          <Campo etichetta="Zone">
            {() => (
              <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                {ZONE_BOLOGNA.map((z) => (
                  <Chip key={z} on={zone.includes(z)} onClick={() => setZone(zone.includes(z) ? zone.filter((x) => x !== z) : [...zone, z])}>
                    {z}
                  </Chip>
                ))}
              </div>
            )}
          </Campo>
          <CampoTesto
            etichetta="Come ti contattano"
            aiuto="Un numero WhatsApp, o un nome utente Telegram o Instagram."
            value={contatto}
            onChange={setContatto}
            maxLength={120}
            autoComplete="tel"
          />

          <div role="status" aria-live="polite">
            {fase === "errore" && <div style={css(`font-size:14px;font-weight:700;color:${C.rosso}`)}>{msgErrore}</div>}
            {fase === "fatto" && <div style={css(`font-size:14px;font-weight:700;color:${C.verde}`)}>Fatto: il tuo annuncio è online per 30 giorni.</div>}
          </div>

          <button type="button" onClick={() => salva()} disabled={fase === "invio"} style={css(`${BOTTONE.pieno};width:100%;height:54px`)}>
            {fase === "invio" ? "Un attimo…" : esiste ? "Aggiorna e tieni online" : "Pubblica"}
          </button>
          {esiste && (
            <button type="button" onClick={togli} disabled={fase === "invio"} style={css(`${BOTTONE.contorno};width:100%`)}>
              Ho trovato casa: togli l&apos;annuncio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
