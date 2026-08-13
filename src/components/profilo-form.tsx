"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, inputClass, ChipToggle } from "./field";
import { Button } from "./ui/button";
import { BadgeVerificato } from "./badges";
import { ABITUDINI, SEDI_UNIBO, PREZZO_MAX } from "@/lib/constants";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";

const ANNI = [
  "1° triennale",
  "2° triennale",
  "3° triennale",
  "1° magistrale",
  "2° magistrale",
  "Erasmus",
];

const schema = z.object({
  nome: z.string().min(2, "Come ti chiami?"),
  eta: z.coerce.number().min(16).max(99),
  corso_laurea: z.string().min(2, "Il tuo corso di laurea"),
  anno: z.string(),
  sede_principale: z.string(),
  budget_max: z.coerce.number().min(0).max(2000),
  bio: z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

export function ProfiloForm() {
  const [abitudini, setAbitudini] = useState<string[]>([]);
  const [salvato, setSalvato] = useState(false);
  const [verificato, setVerificato] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { eta: 21, budget_max: 420, anno: ANNI[0], sede_principale: SEDI_UNIBO[0].key },
  });

  function toggle(a: string) {
    setAbitudini((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function onSubmit(values: Form) {
    if (supabaseConfigurato()) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ ...values, abitudini })
          .eq("id", user.id);
        setVerificato((user.email ?? "").endsWith("@studio.unibo.it"));
      }
    }
    setSalvato(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {salvato && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-verde/30 bg-verde/10 px-4 py-3.5 text-sm font-semibold text-verde">
          Profilo salvato. {verificato && <BadgeVerificato />}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" errore={errors.nome?.message}>
          <input className={inputClass} placeholder="Come ti chiami" {...register("nome")} />
        </Field>
        <Field label="Età" errore={errors.eta?.message}>
          <input type="number" className={inputClass} {...register("eta")} />
        </Field>
        <Field label="Corso di laurea" errore={errors.corso_laurea?.message}>
          <input className={inputClass} placeholder="Es. Ingegneria gestionale" {...register("corso_laurea")} />
        </Field>
        <Field label="Anno">
          <select className={inputClass} {...register("anno")}>
            {ANNI.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field label="Sede principale">
          <select className={inputClass} {...register("sede_principale")}>
            {SEDI_UNIBO.map((s) => (
              <option key={s.key} value={s.key}>
                {s.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Budget max / mese" errore={errors.budget_max?.message}>
          <input type="number" max={PREZZO_MAX} className={inputClass} {...register("budget_max")} />
        </Field>
        <Field label="Abitudini" hint="aiuta a trovare la casa giusta" wide>
          <div className="flex flex-wrap gap-1.5">
            {ABITUDINI.map((a) => (
              <ChipToggle key={a} attivo={abitudini.includes(a)} onClick={() => toggle(a)}>
                {a}
              </ChipToggle>
            ))}
          </div>
        </Field>
        <Field label="Due righe su di te" wide>
          <textarea
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="Chi sei, cosa cerchi in una casa..."
            {...register("bio")}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? "Salvataggio…" : "Salva profilo"}
        </Button>
      </div>
    </form>
  );
}
