"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { Field, inputClass } from "@/components/field";
import { Button } from "@/components/ui/button";

/** Pagina di reset: arriva dal link email, imposta la nuova password. */
export function ResetForm() {
  const [pronto, setPronto] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurato()) {
      setChecking(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPronto(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setPronto(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salva() {
    setErrore(null);
    if (password.length < 8) return setErrore("La password deve avere almeno 8 caratteri.");
    if (password !== conferma) return setErrore("Le due password non coincidono.");
    setInvio(true);
    const { error } = await createClient().auth.updateUser({ password });
    setInvio(false);
    if (error) return setErrore("Errore: " + error.message);
    setFatto(true);
  }

  if (checking) return <p className="text-grigio">Un attimo…</p>;

  if (fatto) {
    return (
      <div className="border-2 border-verde bg-verde/[0.08] p-8 text-center">
        <div className="text-[20px] font-black text-verde">Password aggiornata!</div>
        <p className="mt-2 text-[14px] text-inchiostro/80">Ora puoi accedere con la nuova password.</p>
        <Button asChild className="mt-5"><a href="/app">Vai all&apos;app</a></Button>
      </div>
    );
  }

  if (!pronto) {
    return (
      <div className="border-2 border-linea p-6">
        <p className="text-[15px] text-grigio">
          Link non valido o scaduto. Torna all&apos;app, tocca <b className="text-inchiostro">Accedi → Password dimenticata?</b> e richiedi un nuovo link.
        </p>
        <Button asChild variant="ghost" className="mt-4"><a href="/app">Torna all&apos;app</a></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nuova password" errore={undefined}>
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="Conferma password">
        <input className={inputClass} type="password" value={conferma} onChange={(e) => setConferma(e.target.value)} autoComplete="new-password" />
      </Field>
      {errore && <p className="text-[13px] font-semibold text-rosso">{errore}</p>}
      <Button onClick={salva} disabled={invio} size="lg">{invio ? "Salvo…" : "Imposta nuova password"}</Button>
    </div>
  );
}
