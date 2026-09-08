"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { accedi, type StatoLogin } from "@/app/admin/credenziali/actions";
import { Field, inputClass } from "@/components/field";
import { Button } from "@/components/ui/button";

function Invia() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
      {pending ? "Verifico…" : "Entra"}
    </Button>
  );
}

export function CredenzialiLogin({ configurato }: { configurato: boolean }) {
  const [stato, azione] = useActionState<StatoLogin, FormData>(accedi, { errore: null });

  if (!configurato) {
    return (
      <p className="border-2 border-arancio/40 bg-arancio/10 px-3.5 py-3 text-[13px] font-semibold text-[#B23A17]">
        Pagina non ancora attiva: manca la variabile d&apos;ambiente{" "}
        <code className="font-mono">ADMIN_PASSWORD</code>. Impostala su Vercel e rifai il
        deploy.
      </p>
    );
  }

  return (
    <form action={azione} className="flex flex-col gap-4">
      <Field label="Password" errore={stato.errore ?? undefined}>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
          className={inputClass}
          placeholder="••••••••••••"
        />
      </Field>
      <Invia />
      <p className="text-[12.5px] leading-relaxed text-grigio">
        Non è la password del tuo account SLEPBOLO: è quella dell&apos;area riservata. Va
        rimessa a ogni visita, l&apos;accesso non viene mai ricordato.
      </p>
    </form>
  );
}
