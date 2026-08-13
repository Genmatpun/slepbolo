"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader } from "./ui/dialog";
import { MOTIVI_SEGNALAZIONE } from "@/lib/constants";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";

const schema = z.object({
  motivo: z.enum(["caparra_anticipata", "annuncio_inesistente", "prezzo_diverso"]),
  dettaglio: z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

export function SegnalaAnnuncio({ apartmentId }: { apartmentId: string }) {
  const [inviato, setInviato] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Form) {
    if (supabaseConfigurato()) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("reports").insert({
        apartment_id: apartmentId,
        reporter_id: user?.id ?? null,
        motivo: values.motivo,
        dettaglio: values.dettaglio,
      });
    }
    setInviato(true);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-[13px] font-semibold text-grigio underline hover:text-rosso">
          Segnala questo annuncio
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[460px]">
        <DialogHeader
          titolo="Segnala l'annuncio"
          sottotitolo="Ci aiuti a tenere pulita la bacheca. Le segnalazioni sono anonime per l'host."
        />
        <div className="p-6">
          {inviato ? (
            <p className="rounded-xl border-[1.5px] border-verde/30 bg-verde/10 px-4 py-3.5 text-sm font-semibold text-verde">
              Grazie. Controlleremo l&apos;annuncio.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">Motivo</span>
                <select
                  {...register("motivo")}
                  className="rounded-[11px] border-[1.5px] border-linea bg-crema px-3.5 py-3 text-[14.5px] outline-none focus:border-rosso"
                >
                  {MOTIVI_SEGNALAZIONE.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">Dettagli (facoltativo)</span>
                <textarea
                  {...register("dettaglio")}
                  rows={3}
                  className="resize-y rounded-[11px] border-[1.5px] border-linea bg-crema px-3.5 py-3 text-[14.5px] outline-none focus:border-rosso focus:bg-carta"
                />
              </label>
              <Button type="submit" variant="arancio" disabled={isSubmitting} className="self-end">
                Invia segnalazione
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
