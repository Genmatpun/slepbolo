"use client";

import { useState } from "react";
import { Chat } from "./chat";
import { BadgeVerificato } from "./badges";
import { cn } from "@/lib/utils";

interface Candidatura {
  id: string;
  stato: string;
  messaggio: string | null;
  titolo: string;
  zona: string;
  prezzo: number;
  sonoHost: boolean;
  studente: string;
  studenteCorso: string;
  studenteVerificato: boolean;
}

const LABEL_STATO: Record<string, string> = {
  inviata: "Inviata",
  letta: "Letta",
  accettata: "Accettata",
  rifiutata: "Rifiutata",
};

export function CandidatureLista({
  candidature,
  userId,
}: {
  candidature: Candidatura[];
  userId: string;
}) {
  const [attiva, setAttiva] = useState<string>(candidature[0]?.id ?? "");
  const corrente = candidature.find((c) => c.id === attiva);

  return (
    <div className="mt-6 grid gap-5 md:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-2">
        {candidature.map((c) => (
          <button
            key={c.id}
            onClick={() => setAttiva(c.id)}
            className={cn(
              "rounded-[--radius-card] border bg-carta p-3.5 text-left transition",
              attiva === c.id ? "border-rosso" : "border-linea hover:border-grigio",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <b className="text-[14px] leading-tight">{c.titolo}</b>
              <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-grigio">
                {LABEL_STATO[c.stato]}
              </span>
            </div>
            <span className="text-[12.5px] text-grigio">
              {c.zona} · {c.prezzo} € · {c.sonoHost ? `da ${c.studente}` : "candidatura tua"}
            </span>
          </button>
        ))}
      </div>

      {corrente ? (
        <div className="rounded-[--radius-lg] border border-linea bg-carta">
          {corrente.sonoHost && (
            <div className="border-b border-linea p-4">
              <div className="flex items-center gap-2">
                <b className="text-[15px]">{corrente.studente}</b>
                {corrente.studenteVerificato && <BadgeVerificato />}
              </div>
              <span className="text-[13px] text-grigio">{corrente.studenteCorso}</span>
              {corrente.messaggio && (
                <p className="mt-2 rounded-xl bg-crema p-3 text-sm text-inchiostro/90">
                  {corrente.messaggio}
                </p>
              )}
            </div>
          )}
          <Chat applicationId={corrente.id} userId={userId} />
        </div>
      ) : (
        <div className="grid place-items-center rounded-[--radius-lg] border border-linea bg-carta p-10 text-grigio">
          Seleziona una candidatura
        </div>
      )}
    </div>
  );
}
