"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

/** Chat in tempo reale su una candidatura (Supabase Realtime). */
export function Chat({ applicationId, userId }: { applicationId: string; userId: string }) {
  const [messaggi, setMessaggi] = useState<Message[]>([]);
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const fondoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let attivo = true;

    supabase
      .from("messages")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (attivo && data) setMessaggi(data as Message[]);
      });

    const canale = supabase
      .channel(`chat-${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `application_id=eq.${applicationId}`,
        },
        (payload) => {
          setMessaggi((prev) => {
            const nuovo = payload.new as Message;
            if (prev.some((m) => m.id === nuovo.id)) return prev;
            return [...prev, nuovo];
          });
        },
      )
      .subscribe();

    return () => {
      attivo = false;
      supabase.removeChannel(canale);
    };
  }, [applicationId]);

  useEffect(() => {
    fondoRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  async function invia() {
    const t = testo.trim();
    if (!t) return;
    setInvio(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .insert({ application_id: applicationId, sender_id: userId, testo: t });
    if (!error) setTesto("");
    setInvio(false);
  }

  return (
    <div className="flex h-[440px] flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messaggi.length === 0 ? (
          <p className="mt-8 text-center text-sm text-grigio">
            Ancora nessun messaggio. Rompi il ghiaccio: proponete una videochiamata o una visita.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {messaggi.map((m) => {
              const mio = m.sender_id === userId;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mio
                      ? "self-end bg-rosso text-white"
                      : "self-start bg-crema text-inchiostro",
                  )}
                >
                  {m.testo}
                </div>
              );
            })}
            <div ref={fondoRef} />
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-linea p-3">
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invia()}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-[--radius-pill] border-[1.5px] border-linea bg-crema px-4 py-2.5 text-sm outline-none focus:border-rosso"
        />
        <Button onClick={invia} disabled={invio || !testo.trim()} size="sm">
          Invia
        </Button>
      </div>
    </div>
  );
}
