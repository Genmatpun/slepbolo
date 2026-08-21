"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { Field, inputClass } from "@/components/field";
import { Button } from "@/components/ui/button";

/** Login dell'area admin: accedi con l'account proprietario. */
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  async function accedi(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (!supabaseConfigurato()) {
      setErrore("Supabase non configurato.");
      return;
    }
    setInvio(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setInvio(false);
    if (error) {
      setErrore("Email o password non corretti.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={accedi} className="flex flex-col gap-4">
      <Field label="Email proprietario">
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </Field>
      <Field label="Password">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      {errore && <p className="text-[13px] font-semibold text-rosso">{errore}</p>}
      <Button type="submit" disabled={invio} size="lg">
        {invio ? "Accesso…" : "Entra nell'admin"}
      </Button>
    </form>
  );
}
