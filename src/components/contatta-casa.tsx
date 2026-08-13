"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader } from "./ui/dialog";
import { createClient, supabaseConfigurato } from "@/lib/supabase/client";

const schema = z.object({
  messaggio: z
    .string()
    .min(20, "Scrivi almeno due righe: chi sei e perché ti interessa.")
    .max(1000, "Massimo 1000 caratteri."),
});
type Form = z.infer<typeof schema>;

export function ContattaCasa({ roomId, titolo }: { roomId: string; titolo: string }) {
  const [open, setOpen] = useState(false);
  const [esito, setEsito] = useState<"idle" | "ok" | "auth" | "errore">("idle");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Form) {
    if (!supabaseConfigurato()) {
      setEsito("ok");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEsito("auth");
      return;
    }
    const { error } = await supabase.from("applications").insert({
      room_id: roomId,
      student_id: user.id,
      messaggio: values.messaggio,
    });
    setEsito(error ? "errore" : "ok");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">Contatta la casa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader
          titolo="Candidati per questa stanza"
          sottotitolo={`Il tuo profilo viene mostrato a chi gestisce «${titolo}».`}
        />
        <div className="p-6">
          {esito === "ok" ? (
            <p className="rounded-xl border-[1.5px] border-verde/30 bg-verde/10 px-4 py-3.5 text-sm font-semibold text-verde">
              Candidatura inviata. Ti risponderanno in chat: tieni d&apos;occhio la posta.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">Il tuo messaggio</span>
                <textarea
                  {...register("messaggio")}
                  rows={5}
                  placeholder="Ciao! Studio Ingegneria a Terracini, cerco una stanza da settembre per tutto l'anno. Non fumo, sono ordinato..."
                  className="resize-y rounded-[11px] border-[1.5px] border-linea bg-crema px-3.5 py-3 text-[14.5px] outline-none focus:border-rosso focus:bg-carta"
                />
                {errors.messaggio && (
                  <span className="text-[12.5px] font-semibold text-rosso">
                    {errors.messaggio.message}
                  </span>
                )}
              </label>

              {esito === "auth" && (
                <p className="text-[13px] font-semibold text-arancio">
                  Accedi o crea il profilo per candidarti.
                </p>
              )}
              {esito === "errore" && (
                <p className="text-[13px] font-semibold text-rosso">
                  Qualcosa è andato storto. Riprova tra poco.
                </p>
              )}

              <Button type="submit" disabled={isSubmitting} className="self-end">
                {isSubmitting ? "Invio…" : "Invia candidatura"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
