"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { eliminaUtente } from "@/app/admin/credenziali/actions";
import type { UtenteAdmin } from "@/lib/credenziali/utenti";
import { inputClass } from "@/components/field";
import { cn } from "@/lib/utils";

/** Fuso esplicito: server e browser devono formattare identico, o React protesta. */
const FORMATO = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

function data(iso: string | null): string {
  return iso ? FORMATO.format(new Date(iso)) : "mai";
}

function BottoneConferma() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border-2 border-rosso bg-rosso px-3 py-1.5 text-[12px] font-bold whitespace-nowrap text-white transition hover:bg-rosso-scuro disabled:opacity-50"
    >
      {pending ? "Elimino…" : "Sì, elimina"}
    </button>
  );
}

/**
 * Due passaggi di proposito: la cancellazione è definitiva e la conferma
 * nomina la persona, così un tocco sbagliato non porta via l'account sbagliato.
 */
function Elimina({ utente }: { utente: UtenteAdmin }) {
  const [conferma, setConferma] = useState(false);

  if (!conferma) {
    return (
      <button
        type="button"
        onClick={() => setConferma(true)}
        className="border-2 border-linea px-3 py-1.5 text-[12px] font-bold whitespace-nowrap transition hover:border-rosso hover:text-rosso"
      >
        Elimina
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold text-rosso">Eliminare?</span>
      <form action={eliminaUtente}>
        <input type="hidden" name="id" value={utente.id} />
        <input type="hidden" name="email" value={utente.email} />
        <BottoneConferma />
      </form>
      <button
        type="button"
        onClick={() => setConferma(false)}
        className="border-2 border-linea px-3 py-1.5 text-[12px] font-bold transition hover:border-inchiostro"
      >
        Annulla
      </button>
    </div>
  );
}

/** Password in chiaro, toccabile per copiarla. */
function Password({ valore }: { valore: string | null }) {
  const [copiata, setCopiata] = useState(false);

  if (!valore) {
    return (
      <span
        className="text-[12.5px] text-grigio"
        title="Registrato prima che le password venissero salvate: di questo account resta solo l'hash bcrypt."
      >
        non registrata
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valore).then(
          () => {
            setCopiata(true);
            setTimeout(() => setCopiata(false), 1200);
          },
          () => undefined,
        );
      }}
      className="border-2 border-linea bg-crema px-2.5 py-1 font-mono text-[13px] font-semibold transition hover:border-inchiostro"
    >
      {copiata ? "copiata ✓" : valore}
    </button>
  );
}

function Scheda({ etichetta, valore }: { etichetta: string; valore: number }) {
  return (
    <div className="border-2 border-linea bg-carta px-3 py-2.5">
      <div className="text-[10.5px] font-extrabold tracking-[0.1em] text-grigio uppercase">
        {etichetta}
      </div>
      <div className="mt-0.5 text-[22px] font-black tracking-[-0.03em]">{valore}</div>
    </div>
  );
}

export function CredenzialiLista({ utenti }: { utenti: UtenteAdmin[] }) {
  const [cerca, setCerca] = useState("");

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return utenti;
    return utenti.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.nome ?? "").toLowerCase().includes(q),
    );
  }, [utenti, cerca]);

  const stats = useMemo(() => {
    const settimana = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      totale: utenti.length,
      conPassword: utenti.filter((u) => u.passwordChiaro).length,
      unibo: utenti.filter((u) => u.verificatoUnibo).length,
      recenti: utenti.filter((u) => +new Date(u.creatoIl) > settimana).length,
    };
  }, [utenti]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Scheda etichetta="Registrati" valore={stats.totale} />
        <Scheda etichetta="Con password" valore={stats.conPassword} />
        <Scheda etichetta="Badge UniBo" valore={stats.unibo} />
        <Scheda etichetta="Ultimi 7 gg" valore={stats.recenti} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          className={cn(inputClass, "w-full sm:w-[320px]")}
          placeholder="Cerca per email o nome…"
          type="search"
        />
        <span className="text-[13px] font-semibold text-grigio">
          {filtrati.length} di {utenti.length}
        </span>
      </div>

      {/* Elenco a schede, non tabella: su un telefono una tabella a 8 colonne
          costringe a scorrere di lato per leggere una riga sola. */}
      <div className="flex flex-col divide-y-2 divide-linea border-2 border-inchiostro bg-carta">
        {filtrati.map((u) => (
          <div key={u.id} className="flex flex-col gap-2.5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <b className="min-w-0 text-[15px] break-all">{u.email}</b>
              <Elimina utente={u} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold tracking-[0.1em] text-grigio uppercase">
                Password
              </span>
              <Password valore={u.passwordChiaro} />
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-grigio">
              <span>{u.nome ?? "senza nome"}</span>
              <span>·</span>
              <span>iscritto il {data(u.creatoIl)}</span>
              <span>·</span>
              <span>
                {u.emailConfermataIl ? "mail confermata" : "mail da confermare"}
              </span>
              <span>·</span>
              <span>ultimo accesso {data(u.ultimoAccessoIl)}</span>
              {u.verificatoUnibo && (
                <span className="border border-verde/40 bg-verde/[0.12] px-1.5 text-[10.5px] font-bold text-verde uppercase">
                  ✓ UniBo
                </span>
              )}
              {u.bloccato && (
                <span className="text-[11px] font-bold text-rosso">BLOCCATO</span>
              )}
            </div>
          </div>
        ))}

        {filtrati.length === 0 && (
          <div className="p-10 text-center text-[14px] text-grigio">
            {utenti.length === 0
              ? "Nessuno si è ancora registrato."
              : "Nessun risultato per questa ricerca."}
          </div>
        )}
      </div>
    </div>
  );
}
