import { notFound } from "next/navigation";
import { getAnnuncio, getAnnunci } from "@/lib/data";
import { camereLibere, prezzoDa } from "@/lib/types";
import { distanzeSedi } from "@/lib/constants";
import { RoomsIndicator } from "@/components/rooms-indicator";
import { TagAutomatici } from "@/components/badges";
import { LABEL_GENERE, formattaMese } from "@/components/annuncio-card";
import { iniziale } from "@/lib/utils";
import { ContattaCasa } from "@/components/contatta-casa";
import { SegnalaAnnuncio } from "@/components/segnala-annuncio";

export async function generateStaticParams() {
  const annunci = await getAnnunci();
  return annunci.map((a) => ({ id: a.id }));
}

export default async function AnnuncioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getAnnuncio(id);
  if (!a) notFound();

  const libere = camereLibere(a);
  const prezzo = prezzoDa(a);
  const room = a.rooms.find((r) => r.stato === "libera");
  const distanze = a.lat && a.lng ? distanzeSedi({ lat: a.lat, lng: a.lng }) : [];

  const speseLabel = room?.spese_incluse
    ? "spese incluse"
    : room?.spese_stimate
      ? `+ circa ${room.spese_stimate} €/mese di spese`
      : "spese escluse";

  return (
    <div className="mx-auto max-w-[860px] px-5 pb-20 pt-6 sm:px-6">
      {/* HERO */}
      <div
        className="relative grid h-[230px] place-items-center overflow-hidden rounded-[--radius-lg]"
        style={{ background: "linear-gradient(135deg,#A2001D,#E4572E)" }}
      >
        <span className="text-[76px] font-extrabold tracking-[-0.07em] text-white/25">
          {a.zona.slice(0, 3).toUpperCase()}
        </span>
        <div className="absolute bottom-5 right-5 rounded-[14px] bg-carta px-4 py-2.5 shadow-[var(--shadow-morbida)]">
          <b className="text-[24px] tracking-[-0.03em]">{prezzo} €</b>
          <span className="block text-[12.5px] text-grigio">al mese · {speseLabel}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">{a.zona}</div>
          <h1 className="mt-1.5 text-[28px]">{a.titolo}</h1>
          <p className="mt-1 text-sm text-grigio">
            {a.via ? `${a.via} · ` : ""}
            {a.piano} · {LABEL_GENERE[a.genere]}
          </p>
        </div>
        <RoomsIndicator totali={a.camere_totali} libere={libere} className="mt-2" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <TagAutomatici annuncio={a} />
      </div>

      {/* Dati chiave */}
      <div className="my-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
        <Box label="Tipo stanza">{room?.tipo === "doppia" ? "Doppia" : "Singola"}</Box>
        <Box label="Disponibile da">
          {room?.disponibile_dal ? formattaMese(room.disponibile_dal) : "—"}
        </Box>
        <Box label="Permanenza minima">{room?.permanenza_minima_mesi} mesi</Box>
        <Box label="Cauzione">{a.cauzione ?? "—"}</Box>
        <Box label="Contratto">{a.contratto_tipo ?? "Da concordare"}</Box>
      </div>

      {a.descrizione && (
        <p className="text-[15px] leading-relaxed text-inchiostro/90">{a.descrizione}</p>
      )}

      {/* CHI CI ABITA */}
      <Section titolo="Chi ci abita già">
        <div className="flex flex-wrap gap-3">
          {a.housemates.map((h) => (
            <div
              key={h.id}
              className="min-w-[150px] flex-1 rounded-xl bg-crema p-3.5"
            >
              <div className="mb-2 grid h-8 w-8 place-items-center rounded-full bg-arancio text-[13px] font-bold text-white">
                {iniziale(h.nome_visualizzato)}
              </div>
              <b className="block text-[14.5px]">
                {h.nome_visualizzato}
                {h.eta ? `, ${h.eta}` : ""}
              </b>
              <span className="text-[12.5px] text-grigio">{h.corso}</span>
            </div>
          ))}
          {Array.from({ length: libere }, (_, i) => (
            <div
              key={`libera-${i}`}
              className="grid min-w-[150px] flex-1 place-items-center rounded-xl border-[1.5px] border-dashed border-arancio/50 p-3.5 text-center"
            >
              <span className="text-[13px] font-semibold text-arancio">
                Camera libera
                <span className="block text-[12px] font-normal text-grigio">
                  potresti essere tu
                </span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* DISTANZE */}
      {distanze.length > 0 && (
        <Section titolo="Distanza dalle sedi UniBo">
          <ul className="grid gap-px overflow-hidden rounded-xl border border-linea">
            {distanze.map((d) => (
              <li
                key={d.sede.key}
                className="flex items-center justify-between gap-3 bg-carta px-4 py-3 text-sm"
              >
                <span className="font-semibold">{d.sede.nome}</span>
                <span className="text-grigio">
                  {d.piedi} min a piedi · {d.bici} min in bici
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Servizi */}
      {a.servizi.length > 0 && (
        <Section titolo="Cosa c'è in casa">
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
            {a.servizi.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm text-grigio">
                <span className="h-1.5 w-1.5 rounded-full bg-arancio" />
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* CTA */}
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-linea pt-6">
        {room && <ContattaCasa roomId={room.id} titolo={a.titolo} />}
        <SegnalaAnnuncio apartmentId={a.id} />
      </div>
    </div>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-crema px-4 py-3">
      <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-grigio">
        {label}
      </label>
      <b className="text-[15px]">{children}</b>
    </div>
  );
}

function Section({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="mb-2.5 text-[15px] font-bold">{titolo}</h4>
      {children}
    </section>
  );
}
