"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import {
  ABIT_CATEGORIE,
  ANNI_CORSO,
  GENERI_COINQUILINO,
  LINGUE,
  SEDI_UNIBO,
  ZONE_BOLOGNA,
  personaCoinquilino,
} from "@/lib/constants";
import { BOTTONE, C, CAMPO, EASE, css } from "./stile";
import { Campo, CampoTesto, Chip, Foglio, Icona, Sezione } from "./ui";
import { LeMieCase } from "./le-mie-case";

export interface Utente {
  id: string;
  email: string;
  nome: string;
  cognome: string;
}

/** Preferenze che filtrano Scopri. */
export interface Preferenze {
  budget: number | null;
  zone: string[];
  sede: string | null;
}

interface Invito {
  id: string;
  titolo: string;
  zona: string;
  genere: string;
  eta: number | null;
  scadenza: string;
}

const BUDGET_MIN = 250;
const BUDGET_MAX = 900;

export function ProfiloTab({
  user,
  onLogout,
  onSaved,
  onPubblica,
  onModifica,
  onCambiato,
  onCerco,
}: {
  user: Utente;
  onLogout: () => void;
  onSaved: (p: Preferenze) => void;
  onPubblica: () => void;
  onModifica: (id: string) => void;
  onCambiato: () => void;
  onCerco: () => void;
}) {
  const [nome, setNome] = useState(user.nome);
  const [cognome, setCognome] = useState(user.cognome);
  const [eta, setEta] = useState("");
  const [corso, setCorso] = useState("");
  const [anno, setAnno] = useState("");
  const [lavoratore, setLavoratore] = useState(false);
  const [genere, setGenere] = useState("");
  const [sede, setSede] = useState("");
  const [zone, setZone] = useState<string[]>([]);
  const [cercoDal, setCercoDal] = useState("");
  const [lingue, setLingue] = useState<string[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [bio, setBio] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [abit, setAbit] = useState<string[]>([]);

  const [caricato, setCaricato] = useState(false);
  const [erroreCarico, setErroreCarico] = useState(false);
  const [caricamentoFoto, setCaricamentoFoto] = useState(false);
  const [esito, setEsito] = useState<"" | "salvo" | "ok" | "errore">("");
  const [scegliZone, setScegliZone] = useState(false);
  const [scegliAbit, setScegliAbit] = useState(false);
  const [inviti, setInviti] = useState<Invito[]>([]);
  const [rispondendo, setRispondendo] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurato()) return setCaricato(true);
    createClient()
      .from("profiles")
      .select(
        "nome, cognome, eta, corso_laurea, anno, sede_principale, zona_preferita, zone_preferite, budget_max, abitudini, foto_url, bio, genere, studente_lavoratore, lingue, cerco_dal",
      )
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setErroreCarico(true);
          setCaricato(true);
          return;
        }
        setNome(data.nome ?? "");
        setCognome(data.cognome ?? "");
        setEta(data.eta != null ? String(data.eta) : "");
        setCorso(data.corso_laurea ?? "");
        setAnno(data.anno ?? "");
        setGenere((data.genere as string) ?? "");
        setSede(data.sede_principale ?? "");
        const z = (data.zone_preferite as string[] | null) ?? [];
        setZone(z.length ? z : data.zona_preferita ? [data.zona_preferita] : []);
        setBudget(data.budget_max ?? null);
        setBio(data.bio ?? "");
        setFotoUrl(data.foto_url ?? null);
        setAbit((data.abitudini as string[]) ?? []);
        setLavoratore(!!data.studente_lavoratore);
        setLingue((data.lingue as string[]) ?? []);
        setCercoDal(data.cerco_dal ?? "");
        setCaricato(true);
      });
  }, [user.id]);

  // Inviti come coinquilino ancora validi
  useEffect(() => {
    if (!supabaseConfigurato()) return;
    createClient()
      .from("housemates")
      .select("id, genere, eta, scadenza_invito, apartments(titolo, zona)")
      .eq("profile_id", user.id)
      .eq("stato", "in_attesa")
      .then(({ data }) => {
        if (!data) return;
        const ora = Date.now();
        setInviti(
          data
            .filter((h) => h.scadenza_invito && new Date(h.scadenza_invito as string).getTime() > ora)
            .map((h) => {
              const ap = (h as unknown as { apartments: { titolo: string; zona: string } | null }).apartments;
              return {
                id: h.id as string,
                genere: (h.genere as string) ?? "",
                eta: h.eta as number | null,
                scadenza: h.scadenza_invito as string,
                titolo: ap?.titolo ?? "Una casa",
                zona: ap?.zona ?? "",
              };
            }),
        );
      });
  }, [user.id]);

  async function rispondiInvito(id: string, accetta: boolean) {
    setRispondendo(id);
    const { error } = await createClient().rpc("rispondi_invito", { p_housemate: id, p_accetta: accetta });
    setRispondendo(null);
    if (!error) {
      setInviti((v) => v.filter((x) => x.id !== id));
      if (accetta) onCambiato();
    }
  }

  async function caricaFoto(file: File) {
    if (!supabaseConfigurato()) return;
    setCaricamentoFoto(true);
    const supabase = createClient();
    const path = `${user.id}/avatar/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("foto").upload(path, file, { upsert: true });
    if (!error) setFotoUrl(supabase.storage.from("foto").getPublicUrl(path).data.publicUrl);
    setCaricamentoFoto(false);
  }

  async function salva() {
    if (!supabaseConfigurato()) return;
    const etaN = eta ? Number(eta) : null;
    if (etaN != null && (!Number.isInteger(etaN) || etaN < 16 || etaN > 99)) {
      setEsito("errore");
      return;
    }
    setEsito("salvo");
    const { error } = await createClient()
      .from("profiles")
      .update({
        nome: nome.trim(),
        cognome: cognome.trim() || null,
        eta: etaN,
        genere: genere || null,
        corso_laurea: corso.trim() || null,
        anno: anno || null,
        sede_principale: sede || null,
        zona_preferita: zone[0] ?? null,
        zone_preferite: zone,
        budget_max: budget,
        bio: bio.trim() || null,
        abitudini: abit,
        foto_url: fotoUrl,
        studente_lavoratore: lavoratore,
        lingue,
        cerco_dal: cercoDal || null,
      })
      .eq("id", user.id);
    if (error) {
      setEsito("errore");
      return;
    }
    onSaved({ budget, zone, sede: sede || null });
    setEsito("ok");
    setTimeout(() => setEsito((e) => (e === "ok" ? "" : e)), 2600);
  }

  const toggle = (lista: string[], set: (v: string[]) => void, v: string) =>
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const campi = [nome, eta, corso, anno, sede, budget, fotoUrl, abit.length ? "x" : "", zone.length ? "x" : ""];
  const compl = campi.filter((x) => x !== null && x !== "").length / campi.length;
  const iniziali = ((nome[0] ?? user.email[0] ?? "?") + (cognome[0] ?? "")).toUpperCase();
  const etaNonValida = !!eta && (!/^\d+$/.test(eta) || Number(eta) < 16 || Number(eta) > 99);

  return (
    <div className="sb-noscroll" style={css("height:100%;overflow:auto;padding:calc(56px + env(safe-area-inset-top)) 20px 120px")}>
      <h1 style={css("font-size:34px;font-weight:900;letter-spacing:-.045em;margin:0;line-height:1")}>Profilo</h1>
      <div style={css(`height:2px;background:${C.ink};margin:12px 0 18px`)} />

      {/* testata */}
      <div style={css("display:flex;gap:14px;align-items:center")}>
        <label style={css(`position:relative;width:74px;height:74px;flex:none;cursor:pointer;overflow:hidden;background:${C.rosso}`)}>
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="La tua foto" loading="lazy" width={74} height={74} style={css("width:100%;height:100%;object-fit:cover")} />
          ) : (
            <span aria-hidden style={css(`width:100%;height:100%;display:grid;place-items:center;color:${C.crema};font-size:26px;font-weight:900;letter-spacing:-.04em`)}>
              {iniziali}
            </span>
          )}
          <span style={css(`position:absolute;left:0;right:0;bottom:0;background:rgba(27,24,21,.78);color:${C.crema};font-size:10px;font-weight:800;text-align:center;padding:3px 0;letter-spacing:.04em;text-transform:uppercase`)}>
            {caricamentoFoto ? "Carico…" : "Cambia foto"}
          </span>
          <input
            type="file"
            accept="image/*"
            aria-label="Cambia la tua foto"
            style={css("position:absolute;inset:0;opacity:0;cursor:pointer")}
            onChange={(e) => e.target.files?.[0] && caricaFoto(e.target.files[0])}
          />
        </label>
        <div style={css("min-width:0")}>
          <div style={css("font-size:20px;font-weight:900;letter-spacing:-.035em;line-height:1.05")}>
            {`${nome} ${cognome}`.trim() || "Studente UniBo"}
          </div>
          <div style={css(`font-size:13px;color:${C.grigio};font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis`)}>{user.email}</div>
          <span style={css(`display:inline-flex;align-items:center;gap:5px;margin-top:6px;background:rgba(46,125,91,.12);border:1px solid rgba(46,125,91,.3);color:${C.verde};font-size:12px;font-weight:800;padding:3px 8px`)}>
            <Icona nome="check" size={14} />
            Verificato UniBo
          </span>
        </div>
      </div>

      {/* inviti: solo se ce ne sono */}
      {inviti.length > 0 && (
        <div style={css(`margin-top:18px;border:2px solid ${C.rosso};background:${C.carta}`)}>
          <div style={css(`padding:10px 14px;background:${C.rosso};color:${C.crema};font-size:14px;font-weight:800`)}>
            {inviti.length === 1 ? "Un coinquilino ti ha aggiunto a una casa" : `${inviti.length} case ti hanno aggiunto`}
          </div>
          {inviti.map((inv) => {
            const per = personaCoinquilino(inv.genere);
            return (
              <div key={inv.id} style={css(`padding:14px;border-top:1px solid ${C.linea}`)}>
                <div style={css("font-size:16px;font-weight:900;letter-spacing:-.02em")}>{inv.titolo}</div>
                <div style={css(`font-size:14px;color:${C.testo};margin-top:4px;line-height:1.4`)}>
                  {inv.zona} · Confermi di abitarci? Comparirai come {per.label.toLowerCase()}
                  {inv.eta ? `, ${inv.eta} anni` : ""}, senza nome.
                </div>
                <div style={css("display:flex;gap:8px;margin-top:11px")}>
                  <button type="button" onClick={() => rispondiInvito(inv.id, true)} disabled={rispondendo === inv.id} style={css(`${BOTTONE.scuro};height:46px;flex:1`)}>
                    {rispondendo === inv.id ? "Un attimo…" : "Sì, abito qui"}
                  </button>
                  <button type="button" onClick={() => rispondiInvito(inv.id, false)} disabled={rispondendo === inv.id} style={css(`${BOTTONE.contorno};height:46px;flex:1`)}>
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sezione
        titolo="Le mie case"
        extra={
          <button type="button" onClick={onPubblica} style={css(`${BOTTONE.piccolo};display:flex;align-items:center;gap:6px;letter-spacing:0;text-transform:none`)}>
            <Icona nome="piu" size={16} />
            Pubblica
          </button>
        }
      />
      <LeMieCase userId={user.id} onModifica={onModifica} onPubblica={onPubblica} onCambiato={onCambiato} />

      <Sezione titolo="Stai cercando casa?" />
      <button
        type="button"
        onClick={onCerco}
        style={css(`width:100%;display:flex;align-items:center;gap:12px;border:2px solid ${C.ink};background:${C.carta};color:${C.ink};padding:14px 16px;font-family:inherit;text-align:left;cursor:pointer`)}
      >
        <Icona nome="persona" size={22} />
        <span style={css("flex:1")}>
          <span style={css("display:block;font-size:15px;font-weight:800")}>Il tuo annuncio &laquo;Cerco stanza&raquo;</span>
          <span style={css(`display:block;font-size:13px;color:${C.grigio}`)}>Fatti trovare da chi ha una stanza libera</span>
        </span>
        <Icona nome="freccia" />
      </button>

      {/* dati */}
      <Sezione titolo="I tuoi dati" />
      {erroreCarico && (
        <div role="alert" style={css(`margin-bottom:12px;font-size:14px;font-weight:700;color:${C.rosso}`)}>
          Non riesco a caricare il profilo. Puoi comunque modificarlo e salvarlo.
        </div>
      )}
      {!caricato ? (
        <div aria-busy="true" style={css(`font-size:14px;color:${C.grigio}`)}>Carico…</div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:14px")}>
          <div style={css(`font-size:13.5px;color:${C.grigio};line-height:1.4;background:${C.sabbia};padding:10px 12px`)}>
            Nome e cognome li vedi solo tu. Negli annunci compari senza nome, solo con età, corso e abitudini.
          </div>
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
            <CampoTesto etichetta="Nome" value={nome} onChange={setNome} autoComplete="given-name" />
            <CampoTesto etichetta="Cognome" value={cognome} onChange={setCognome} autoComplete="family-name" />
          </div>
          <div style={css("display:grid;grid-template-columns:110px 1fr;gap:10px")}>
            <CampoTesto
              etichetta="Età"
              value={eta}
              onChange={(v) => setEta(v.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              aria-invalid={etaNonValida}
            />
            <CampoTesto etichetta="Corso di laurea" value={corso} onChange={setCorso} maxLength={80} />
          </div>
          {etaNonValida && <div role="alert" style={css(`margin-top:-6px;font-size:13px;font-weight:700;color:${C.rosso}`)}>L&apos;età va da 16 a 99 anni.</div>}

          <Campo etichetta="Anno">
            {(id) => (
              <select id={id} value={anno} onChange={(e) => setAnno(e.target.value)} style={css(CAMPO)}>
                <option value="">— scegli —</option>
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

          <Campo etichetta="Sei…">
            {() => (
              <div role="radiogroup" aria-label="Genere" style={css("display:flex;gap:8px")}>
                {GENERI_COINQUILINO.map((g) => (
                  <Chip key={g.value} on={genere === g.value} onClick={() => setGenere(genere === g.value ? "" : g.value)}>
                    {g.label}
                  </Chip>
                ))}
              </div>
            )}
          </Campo>

          <Campo etichetta="La tua sede" aiuto="Mettiamo in cima i tempi verso la tua sede, in ogni casa.">
            {(id, d) => (
              <select id={id} aria-describedby={d} value={sede} onChange={(e) => setSede(e.target.value)} style={css(CAMPO)}>
                <option value="">— scegli —</option>
                {SEDI_UNIBO.map((s) => (
                  <option key={s.key} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>

          <Campo etichetta="Zone che ti interessano" aiuto={zone.length ? "Scopri ti mostra prima queste zone." : "Nessuna: vedi tutta Bologna."}>
            {(id, d) => (
              <button
                id={id}
                aria-describedby={d}
                type="button"
                onClick={() => setScegliZone(true)}
                style={css(`${CAMPO};text-align:left;cursor:pointer;display:flex;align-items:center;gap:8px;height:auto;min-height:48px;padding:8px 12px`)}
              >
                <span style={css("flex:1;line-height:1.35")}>{zone.length ? zone.join(", ") : "Tutta Bologna"}</span>
                <Icona nome="avanti" size={18} />
              </button>
            )}
          </Campo>

          <Campo etichetta="Ti serve una stanza dal">
            {(id) => <input id={id} type="date" value={cercoDal} onChange={(e) => setCercoDal(e.target.value)} style={css(CAMPO)} />}
          </Campo>

          <Campo etichetta={budget ? `Budget massimo: ${budget} € al mese` : "Budget massimo: nessun limite"}>
            {(id) => (
              <div style={css("display:flex;align-items:center;gap:12px")}>
                <input
                  id={id}
                  type="range"
                  min={BUDGET_MIN}
                  max={BUDGET_MAX}
                  step={10}
                  value={budget ?? BUDGET_MAX}
                  aria-valuetext={budget ? `${budget} euro` : "nessun limite"}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBudget(v >= BUDGET_MAX ? null : v);
                  }}
                  style={css(`flex:1;height:44px;accent-color:${C.rosso}`)}
                />
                {budget ? (
                  <button type="button" onClick={() => setBudget(null)} style={css(BOTTONE.piccolo)}>
                    Togli
                  </button>
                ) : null}
              </div>
            )}
          </Campo>

          <Campo etichetta="Lingue che parli">
            {() => (
              <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                {LINGUE.map((l) => (
                  <Chip key={l} on={lingue.includes(l)} onClick={() => toggle(lingue, setLingue, l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            )}
          </Campo>

          <Campo etichetta="Abitudini" aiuto="Le vede chi cerca un coinquilino, quando abiti in una casa pubblicata.">
            {(id, d) => (
              <button
                id={id}
                aria-describedby={d}
                type="button"
                onClick={() => setScegliAbit(true)}
                style={css(`${CAMPO};text-align:left;cursor:pointer;display:flex;align-items:center;gap:8px;height:auto;min-height:48px;padding:8px 12px`)}
              >
                <span style={css("flex:1;line-height:1.35")}>{abit.length ? abit.join(", ") : "Scegli le tue abitudini"}</span>
                <Icona nome="avanti" size={18} />
              </button>
            )}
          </Campo>

          <Campo etichetta="Due righe su di te" aiuto={`${bio.length}/500`}>
            {(id, d) => (
              <textarea
                id={id}
                aria-describedby={d}
                maxLength={500}
                rows={3}
                placeholder="Cosa studi, che ritmi hai, cosa cerchi in una casa"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={css(`${CAMPO};height:auto;padding:10px 12px;resize:vertical;min-height:84px;line-height:1.4`)}
              />
            )}
          </Campo>

          {/* completamento: animato con transform, non con la larghezza */}
          <div>
            <div style={css(`height:8px;background:${C.linea};overflow:hidden`)}>
              <div style={css(`height:100%;width:100%;background:${C.rosso};transform-origin:left;transform:scaleX(${compl});transition:transform .4s ${EASE}`)} />
            </div>
            <div style={css(`font-size:13px;color:${C.grigio};font-weight:600;margin-top:6px`)}>Profilo completo al {Math.round(compl * 100)}%</div>
          </div>

          <div role="status" aria-live="polite">
            {esito === "errore" && (
              <div style={css(`font-size:14px;font-weight:700;color:${C.rosso};margin-bottom:8px`)}>
                {etaNonValida ? "Controlla l'età." : "Non sono riuscito a salvare. Controlla la connessione e riprova."}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={salva}
            disabled={esito === "salvo"}
            style={css(`${BOTTONE.pieno};width:100%;height:54px;background:${esito === "ok" ? C.verde : C.rosso};display:flex;align-items:center;justify-content:center;gap:8px`)}
          >
            {esito === "ok" ? <Icona nome="check" size={18} /> : null}
            {esito === "salvo" ? "Salvo…" : esito === "ok" ? "Profilo salvato" : "Salva profilo"}
          </button>
        </div>
      )}

      <button type="button" onClick={onLogout} style={css(`${BOTTONE.contorno};width:100%;margin-top:12px`)}>
        Esci
      </button>

      <Foglio aperto={scegliZone} onChiudi={() => setScegliZone(false)} titolo="Zone che ti interessano">
        <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
          {ZONE_BOLOGNA.map((z) => (
            <Chip key={z} on={zone.includes(z)} onClick={() => toggle(zone, setZone, z)}>
              {z}
            </Chip>
          ))}
        </div>
        <div style={css("display:flex;gap:8px;margin-top:18px")}>
          <button type="button" onClick={() => setZone([])} style={css(`${BOTTONE.contorno};flex:1`)}>
            Tutta Bologna
          </button>
          <button type="button" onClick={() => setScegliZone(false)} style={css(`${BOTTONE.scuro};flex:1;height:48px`)}>
            Fatto{zone.length ? ` (${zone.length})` : ""}
          </button>
        </div>
      </Foglio>

      <Foglio aperto={scegliAbit} onChiudi={() => setScegliAbit(false)} titolo="Le tue abitudini">
        <div style={css("display:flex;flex-direction:column;gap:16px")}>
          {ABIT_CATEGORIE.map((cat) => (
            <fieldset key={cat.titolo} style={css("border:0;margin:0;padding:0")}>
              <legend style={css("font-size:13px;font-weight:800;margin-bottom:8px;padding:0")}>{cat.titolo}</legend>
              <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                {cat.voci.map((v) => (
                  <Chip key={v} on={abit.includes(v)} onClick={() => toggle(abit, setAbit, v)}>
                    {v}
                  </Chip>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <button type="button" onClick={() => setScegliAbit(false)} style={css(`${BOTTONE.scuro};width:100%;margin-top:18px;height:48px`)}>
          Fatto{abit.length ? ` (${abit.length})` : ""}
        </button>
      </Foglio>
    </div>
  );
}
