"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, inputClass } from "./field";
import { Button } from "./ui/button";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  nome: z.string().optional(),
  email: z.string().email("Inserisci una mail valida"),
  password: z.string().min(8, "Almeno 8 caratteri"),
});
type Form = z.infer<typeof schema>;

export function AuthForm() {
  const router = useRouter();
  const [modo, setModo] = useState<"accedi" | "registrati">("registrati");
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const email = watch("email") ?? "";
  const saraVerificato = email.toLowerCase().endsWith("@studio.unibo.it");

  async function onSubmit(values: Form) {
    setErrore(null);
    setAvviso(null);
    if (!supabaseConfigurato()) {
      setAvviso(
        "Supabase non è configurato in questa demo. Imposta le variabili d'ambiente per abilitare l'accesso reale.",
      );
      return;
    }
    const supabase = createClient();
    if (modo === "registrati") {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { nome: values.nome || values.email.split("@")[0] } },
      });
      if (error) return setErrore(error.message);
      setAvviso("Controlla la mail per confermare l'indirizzo, poi accedi.");
      setModo("accedi");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) return setErrore("Email o password non corretti.");
      router.push("/profilo");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex rounded-[--radius-pill] border border-linea bg-crema p-[3px]">
        {(["registrati", "accedi"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={cn(
              "flex-1 rounded-[--radius-pill] px-4 py-2 text-[13px] font-semibold capitalize transition",
              modo === m ? "bg-inchiostro text-crema" : "text-grigio",
            )}
          >
            {m === "registrati" ? "Registrati" : "Accedi"}
          </button>
        ))}
      </div>

      {modo === "registrati" && (
        <Field label="Nome">
          <input className={inputClass} placeholder="Come ti chiami" {...register("nome")} />
        </Field>
      )}
      <Field label="Email UniBo o personale" errore={errors.email?.message}>
        <input className={inputClass} placeholder="nome.cognome@studio.unibo.it" {...register("email")} />
      </Field>
      {modo === "registrati" && email && (
        <p className={cn("text-[12.5px] font-semibold", saraVerificato ? "text-verde" : "text-grigio")}>
          {saraVerificato
            ? "✓ Otterrai il badge Studente UniBo verificato."
            : "Mail non istituzionale: profilo senza badge di verifica."}
        </p>
      )}
      <Field label="Password" errore={errors.password?.message}>
        <input type="password" className={inputClass} {...register("password")} />
      </Field>

      {errore && <p className="text-[13px] font-semibold text-rosso">{errore}</p>}
      {avviso && (
        <p className="rounded-xl border-[1.5px] border-arancio/30 bg-arancio/10 px-3.5 py-2.5 text-[13px] font-semibold text-[#B23A17]">
          {avviso}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} size="lg" className="mt-1">
        {isSubmitting
          ? "Un attimo…"
          : modo === "registrati"
            ? "Crea il profilo"
            : "Accedi"}
      </Button>
    </form>
  );
}
