"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Field, inputClass, ChipToggle } from "./field";
import { Button } from "./ui/button";
import { RoomsIndicator } from "./rooms-indicator";
import {
  ZONE_BOLOGNA,
  GENERI_CASA,
  TIPI_STANZA,
  GENERI_COINQUILINO,
  ABITUDINI,
  personaCoinquilino,
} from "@/lib/constants";
import { geocodaVia } from "@/lib/geocoding";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SERVIZI_DISPONIBILI = [
  "Wi-Fi",
  "Lavatrice",
  "Arredata",
  "Balcone",
  "Lavastoviglie",
  "Aria condizionata",
  "Ammessi animali",
  "Si può fumare",
  "Bici/garage",
];

interface Coinquilino {
  genere: string;
  eta: string;
  corso: string;
  abitudini: string[];
}

interface Bozza {
  titolo: string;
  zona: string;
  via: string;
  piano: string;
  camere_totali: number;
  camere_occupate: number;
  genere: string;
  tipo: string;
  prezzo: number;
  spese_incluse: boolean;
  spese_stimate: number;
  disponibile_dal: string;
  permanenza: number;
  coinquilini: Coinquilino[];
  servizi: string[];
  contratto: string;
  cauzione: string;
  descrizione: string;
}

const BOZZA_INIZIALE: Bozza = {
  titolo: "",
  zona: ZONE_BOLOGNA[0],
  via: "",
  piano: "",
  camere_totali: 3,
  camere_occupate: 2,
  genere: "misto",
  tipo: "singola",
  prezzo: 380,
  spese_incluse: true,
  spese_stimate: 50,
  disponibile_dal: "2026-09-01",
  permanenza: 6,
  coinquilini: [],
  servizi: ["Wi-Fi", "Lavatrice", "Arredata"],
  contratto: "Registrato — studenti (3+2)",
  cauzione: "1 mensilità",
  descrizione: "",
};

const CHIAVE_BOZZA = "slepbolo-bozza";
const PASSI = ["Appartamento", "Camere e prezzi", "Chi ci abita", "Foto e pubblicazione"];

export function PubblicaWizard() {
  const [passo, setPasso] = useState(0);
  const [b, setB] = useState<Bozza>(BOZZA_INIZIALE);
  const [pubblicato, setPubblicato] = useState(false);
  const [salvataggio, setSalvataggio] = useState<"idle" | "geo" | "invio">("idle");
  const [caricata, setCaricata] = useState(false);

  // Carica bozza salvata
  useEffect(() => {
    const raw = localStorage.getItem(CHIAVE_BOZZA);
    if (raw) {
      try {
        setB({ ...BOZZA_INIZIALE, ...JSON.parse(raw) });
      } catch {}
    }
    setCaricata(true);
  }, []);

  // Salva bozza a ogni modifica
  useEffect(() => {
    if (caricata) localStorage.setItem(CHIAVE_BOZZA, JSON.stringify(b));
  }, [b, caricata]);

  function set<K extends keyof Bozza>(k: K, v: Bozza[K]) {
    setB((prev) => ({ ...prev, [k]: v }));
  }

  const libere = Math.max(0, b.camere_totali - b.camere_occupate);
  const occupateValide = b.camere_occupate < b.camere_totali;

  async function pubblica() {
    setSalvataggio("geo");
    const coord = b.via ? await geocodaVia(b.via, b.zona) : null;
    setSalvataggio("invio");

    if (supabaseConfigurato()) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: apt } = await supabase
          .from("apartments")
          .insert({
            host_id: user.id,
            titolo: b.titolo,
            descrizione: b.descrizione,
            zona: b.zona,
            via: b.via,
            lat: coord?.lat ?? null,
            lng: coord?.lng ?? null,
            piano: b.piano,
            genere: b.genere,
            camere_totali: b.camere_totali,
            camere_occupate: b.camere_occupate,
            servizi: b.servizi,
            contratto_tipo: b.contratto,
            cauzione: b.cauzione,
          })
          .select()
          .single();

        if (apt) {
          await supabase.from("rooms").insert(
            Array.from({ length: libere }, () => ({
              apartment_id: apt.id,
              tipo: b.tipo,
              prezzo_mensile: b.prezzo,
              spese_incluse: b.spese_incluse,
              spese_stimate: b.spese_incluse ? null : b.spese_stimate,
              disponibile_dal: b.disponibile_dal,
              permanenza_minima_mesi: b.permanenza,
              stato: "libera",
            })),
          );
          if (b.coinquilini.length) {
            await supabase.from("housemates").insert(
              b.coinquilini.map((c) => ({
                apartment_id: apt.id,
                nome_visualizzato: null,
                genere: c.genere,
                eta: c.eta ? Number(c.eta) : null,
                corso: c.corso,
                abitudini: c.abitudini,
              })),
            );
          }
        }
      }
    }

    localStorage.removeItem(CHIAVE_BOZZA);
    setSalvataggio("idle");
    setPubblicato(true);
  }

  if (pubblicato) {
    return (
      <div className="rounded-[--radius-lg] border-[1.5px] border-verde/30 bg-verde/10 p-8 text-center">
        <b className="block text-[20px] text-verde">Annuncio pubblicato!</b>
        <p className="mx-auto mt-2 max-w-[42ch] text-sm text-inchiostro/80">
          È già visibile nella ricerca, con {libere} {libere === 1 ? "camera libera" : "camere libere"} su{" "}
          {b.camere_totali}.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button asChild>
            <Link href="/cerca">Vai alla ricerca</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[--radius-lg] border border-linea bg-carta shadow-[var(--shadow-morbida)]">
      {/* Progress */}
      <div className="flex gap-1 border-b border-linea bg-crema px-4 py-3">
        {PASSI.map((p, i) => (
          <button
            key={p}
            onClick={() => i <= passo && setPasso(i)}
            className={cn(
              "flex-1 rounded-[--radius-pill] px-2 py-1.5 text-[12.5px] font-semibold transition",
              i === passo
                ? "bg-inchiostro text-crema"
                : i < passo
                  ? "text-rosso"
                  : "text-grigio",
            )}
          >
            <span className="hidden sm:inline">
              {i + 1}. {p}
            </span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        ))}
      </div>

      <div className="p-6">
        {passo === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titolo annuncio" wide>
              <input
                className={inputClass}
                placeholder="Es. Stanza singola in trilocale luminoso"
                value={b.titolo}
                onChange={(e) => set("titolo", e.target.value)}
              />
            </Field>
            <Field label="Zona">
              <select className={inputClass} value={b.zona} onChange={(e) => set("zona", e.target.value)}>
                {[...ZONE_BOLOGNA].sort().map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <Field label="Via" hint="senza civico: mostriamo solo la via">
              <input
                className={inputClass}
                placeholder="Es. Via Mascarella"
                value={b.via}
                onChange={(e) => set("via", e.target.value)}
              />
            </Field>
            <Field label="Camere totali">
              <input
                type="number"
                min={1}
                max={12}
                className={inputClass}
                value={b.camere_totali}
                onChange={(e) => set("camere_totali", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Camere già occupate"
              errore={!occupateValide ? "Deve restare almeno una camera libera." : undefined}
            >
              <input
                type="number"
                min={0}
                max={b.camere_totali - 1}
                className={inputClass}
                value={b.camere_occupate}
                onChange={(e) => set("camere_occupate", Number(e.target.value))}
              />
            </Field>
            <Field label="Piano / ascensore" wide>
              <input
                className={inputClass}
                placeholder="Es. 2° con ascensore"
                value={b.piano}
                onChange={(e) => set("piano", e.target.value)}
              />
            </Field>
            <Field label="Casa di" wide>
              <div className="flex flex-wrap gap-1.5">
                {GENERI_CASA.filter((g) => g.value !== "indifferente").map((g) => (
                  <ChipToggle key={g.value} attivo={b.genere === g.value} onClick={() => set("genere", g.value)}>
                    {g.value === "misto" ? "Ragazzi e ragazze" : `Solo ${g.label.toLowerCase()}`}
                  </ChipToggle>
                ))}
              </div>
            </Field>
            {occupateValide && (
              <div className="sm:col-span-2">
                <RoomsIndicator totali={b.camere_totali} libere={libere} />
              </div>
            )}
          </div>
        )}

        {passo === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo di stanza libera">
              <div className="flex flex-wrap gap-1.5">
                {TIPI_STANZA.map((t) => (
                  <ChipToggle key={t.value} attivo={b.tipo === t.value} onClick={() => set("tipo", t.value)}>
                    {t.label}
                  </ChipToggle>
                ))}
              </div>
            </Field>
            <Field label="Affitto al mese (a persona)">
              <input
                type="number"
                className={inputClass}
                value={b.prezzo}
                onChange={(e) => set("prezzo", Number(e.target.value))}
              />
            </Field>
            <Field label="Spese">
              <label className="flex items-center gap-2.5 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-rosso"
                  checked={b.spese_incluse}
                  onChange={(e) => set("spese_incluse", e.target.checked)}
                />
                Incluse nel prezzo
              </label>
            </Field>
            {!b.spese_incluse && (
              <Field label="Spese stimate (€/mese)">
                <input
                  type="number"
                  className={inputClass}
                  value={b.spese_stimate}
                  onChange={(e) => set("spese_stimate", Number(e.target.value))}
                />
              </Field>
            )}
            <Field label="Disponibile dal">
              <input
                type="date"
                className={inputClass}
                value={b.disponibile_dal}
                onChange={(e) => set("disponibile_dal", e.target.value)}
              />
            </Field>
            <Field label="Permanenza minima">
              <select
                className={inputClass}
                value={b.permanenza}
                onChange={(e) => set("permanenza", Number(e.target.value))}
              >
                <option value={3}>3 mesi</option>
                <option value={6}>6 mesi</option>
                <option value={12}>12 mesi</option>
              </select>
            </Field>
            <Field label="Cauzione">
              <select className={inputClass} value={b.cauzione} onChange={(e) => set("cauzione", e.target.value)}>
                <option>1 mensilità</option>
                <option>2 mensilità</option>
                <option>Nessuna</option>
              </select>
            </Field>
            <Field label="Contratto">
              <select className={inputClass} value={b.contratto} onChange={(e) => set("contratto", e.target.value)}>
                <option>Registrato — studenti (3+2)</option>
                <option>Registrato — transitorio</option>
                <option>Da concordare</option>
              </select>
            </Field>
          </div>
        )}

        {passo === 2 && (
          <ChiCiAbita
            coinquilini={b.coinquilini}
            onChange={(c) => set("coinquilini", c)}
            libere={libere}
          />
        )}

        {passo === 3 && (
          <div className="flex flex-col gap-5">
            <Field label="Cosa c'è in casa">
              <div className="flex flex-wrap gap-1.5">
                {SERVIZI_DISPONIBILI.map((s) => (
                  <ChipToggle
                    key={s}
                    attivo={b.servizi.includes(s)}
                    onClick={() =>
                      set(
                        "servizi",
                        b.servizi.includes(s)
                          ? b.servizi.filter((x) => x !== s)
                          : [...b.servizi, s],
                      )
                    }
                  >
                    {s}
                  </ChipToggle>
                ))}
              </div>
            </Field>
            <Field label="Descrizione" hint="com'è la casa, cosa cercate in un coinquilino">
              <textarea
                rows={5}
                className={`${inputClass} resize-y`}
                value={b.descrizione}
                onChange={(e) => set("descrizione", e.target.value)}
              />
            </Field>
            <div className="rounded-xl bg-crema p-4 text-sm text-grigio">
              Le foto vere si caricano dopo la pubblicazione, dallo spazio Storage di Supabase.
              Per ora l&apos;annuncio userà una copertina colorata automatica.
            </div>
          </div>
        )}
      </div>

      {/* Footer navigazione */}
      <div className="flex items-center justify-between gap-3 border-t border-linea bg-crema px-6 py-4">
        <span className="text-[12.5px] text-grigio">Bozza salvata automaticamente</span>
        <div className="flex gap-2">
          {passo > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPasso(passo - 1)}>
              Indietro
            </Button>
          )}
          {passo < 3 ? (
            <Button
              size="sm"
              disabled={passo === 0 && (!b.titolo || !occupateValide)}
              onClick={() => setPasso(passo + 1)}
            >
              Continua
            </Button>
          ) : (
            <Button size="sm" onClick={pubblica} disabled={salvataggio !== "idle" || !b.titolo}>
              {salvataggio === "geo"
                ? "Localizzo la via…"
                : salvataggio === "invio"
                  ? "Pubblico…"
                  : "Pubblica annuncio"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChiCiAbita({
  coinquilini,
  onChange,
  libere,
}: {
  coinquilini: Coinquilino[];
  onChange: (c: Coinquilino[]) => void;
  libere: number;
}) {
  const [genere, setGenere] = useState<string>("ragazza");
  const [eta, setEta] = useState("");
  const [corso, setCorso] = useState("");
  const [abit, setAbit] = useState<string[]>([]);

  function aggiungi() {
    onChange([...coinquilini, { genere, eta, corso: corso.trim(), abitudini: abit }]);
    setGenere("ragazza");
    setEta("");
    setCorso("");
    setAbit([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-grigio">
        Descrivi chi abita già in casa. Per privacy <b>niente nomi</b>: solo genere, età, corso e
        stile di vita. Non serve che siano iscritti a SLEPBOLO.
      </p>

      {coinquilini.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {coinquilini.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-crema px-3 py-2 text-sm">
              <b>{personaCoinquilino(c.genere).label}</b>
              <span className="text-grigio">
                {c.eta && `${c.eta} · `}
                {c.corso}
                {c.abitudini.length ? ` · ${c.abitudini.join(", ")}` : ""}
              </span>
              <button
                onClick={() => onChange(coinquilini.filter((_, j) => j !== i))}
                className="text-grigio hover:text-rosso"
                aria-label="Rimuovi coinquilino"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Genere">
          <div className="flex flex-wrap gap-1.5">
            {GENERI_COINQUILINO.map((g) => (
              <ChipToggle key={g.value} attivo={genere === g.value} onClick={() => setGenere(g.value)}>{g.label}</ChipToggle>
            ))}
          </div>
        </Field>
        <Field label="Età">
          <input className={inputClass} value={eta} onChange={(e) => setEta(e.target.value)} inputMode="numeric" placeholder="Es. 23" />
        </Field>
        <Field label="Corso" wide>
          <input className={inputClass} value={corso} onChange={(e) => setCorso(e.target.value)} placeholder="Es. Lettere" />
        </Field>
        <Field label="Stile di vita" wide>
          <div className="flex flex-wrap gap-1.5">
            {ABITUDINI.map((a) => (
              <ChipToggle key={a} attivo={abit.includes(a)} onClick={() => setAbit((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a])}>{a}</ChipToggle>
            ))}
          </div>
        </Field>
      </div>
      <div className="text-right">
        <Button variant="ghost" size="sm" onClick={aggiungi}>
          + Aggiungi coinquilino
        </Button>
      </div>

      <div className="rounded-xl bg-crema p-3.5 text-[13px] text-grigio">
        Nella scheda pubblica appariranno {libere} {libere === 1 ? "card" : "card"} tratteggiate
        «Camera libera — potresti essere tu», una per ogni posto ancora disponibile.
      </div>
    </div>
  );
}
