"use client";

import { useActionState } from "react";
import { abilitaHost, type StatoHost } from "@/app/admin/host/actions";
import { Field, inputClass } from "@/components/field";

const INIZIO: StatoHost = { errore: null, ok: null };

/** Modulo per abilitare la mail di un host. */
export function AbilitaHost() {
  const [stato, azione, inCorso] = useActionState(abilitaHost, INIZIO);
  return (
    <form action={azione} className="mb-6 flex flex-col gap-3 border-2 border-inchiostro p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mail dell'host">
          <input name="email" type="email" required autoComplete="off" placeholder="nome@gmail.com" className={inputClass} />
        </Field>
        <Field label="Nota" hint="facoltativa, la vedi solo tu">
          <input name="nota" maxLength={120} placeholder="Elena, Strada Maggiore" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCorso}
          className="border-2 border-rosso bg-rosso px-4 py-2 text-[13px] font-extrabold text-white transition hover:bg-rosso-scuro disabled:opacity-50"
        >
          {inCorso ? "Salvo…" : "Abilita"}
        </button>
        <div role="status" aria-live="polite" className="text-[13px] font-semibold">
          {stato.errore && <span className="text-rosso">{stato.errore}</span>}
          {stato.ok && <span className="text-verde">{stato.ok}</span>}
        </div>
      </div>
    </form>
  );
}
