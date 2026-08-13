import Link from "next/link";
import type { Annuncio } from "@/lib/types";
import { camereLibere, prezzoDa } from "@/lib/types";
import { RoomsIndicator } from "./rooms-indicator";
import { TagAutomatici } from "./badges";

const GRADIENTI = [
  "linear-gradient(135deg,#A2001D,#E4572E)",
  "linear-gradient(135deg,#E4572E,#F0A868)",
  "linear-gradient(135deg,#7A0016,#A2001D)",
  "linear-gradient(135deg,#B5651D,#E4572E)",
  "linear-gradient(135deg,#8C3B2E,#D9744F)",
];

function gradiente(id: string): string {
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return GRADIENTI[n % GRADIENTI.length];
}

const LABEL_GENERE: Record<string, string> = {
  ragazze: "Solo ragazze",
  ragazzi: "Solo ragazzi",
  misto: "Casa mista",
  indifferente: "Indifferente",
};

export function AnnuncioCard({ annuncio }: { annuncio: Annuncio }) {
  const libere = camereLibere(annuncio);
  const prezzo = prezzoDa(annuncio);
  const roomLibera = annuncio.rooms.find((r) => r.stato === "libera");
  const tipoLabel =
    TIPI_LABEL[roomLibera?.tipo ?? "singola"] ?? "Stanza";
  const glyph = annuncio.zona.split(" ")[0].slice(0, 3).toUpperCase();

  return (
    <Link
      href={`/annuncio/${annuncio.id}`}
      className="group flex flex-col overflow-hidden rounded-[--radius-lg] border border-linea bg-carta transition duration-200 hover:-translate-y-[3px] hover:border-grigio hover:shadow-[var(--shadow-alta)]"
    >
      <div
        className="relative grid h-[168px] place-items-center"
        style={{ background: gradiente(annuncio.id) }}
      >
        <span className="text-[44px] font-extrabold tracking-[-0.06em] text-white/[0.28]">
          {glyph}
        </span>
        <span className="absolute left-3 top-3 rounded-[--radius-pill] bg-carta/95 px-[11px] py-[5px] text-[11.5px] font-bold tracking-[0.02em]">
          {annuncio.zona}
        </span>
        <span className="absolute bottom-3 right-3 rounded-[--radius-pill] bg-inchiostro px-3 py-1.5 text-sm font-bold text-crema">
          {prezzo} €<span className="text-[11px] font-medium">/mese</span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-[9px] p-4 pb-[18px]">
        <h3 className="text-[16.5px] leading-[1.25] font-bold tracking-[-0.02em]">
          {annuncio.titolo}
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-[5px] text-[13px] text-grigio">
          <span>{tipoLabel}</span>
          <span>{LABEL_GENERE[annuncio.genere]}</span>
          {roomLibera?.disponibile_dal && (
            <span>da {formattaMese(roomLibera.disponibile_dal)}</span>
          )}
        </div>
        <RoomsIndicator totali={annuncio.camere_totali} libere={libere} className="mt-0.5" />
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <TagAutomatici annuncio={annuncio} />
        </div>
      </div>
    </Link>
  );
}

const TIPI_LABEL: Record<string, string> = { singola: "Singola", doppia: "Doppia" };

// Riuso la label del genere anche altrove
export { LABEL_GENERE };

function formattaMese(iso: string): string {
  const d = new Date(iso);
  const mesi = [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ];
  return `${mesi[d.getMonth()]} ${d.getFullYear()}`;
}

export { formattaMese };
