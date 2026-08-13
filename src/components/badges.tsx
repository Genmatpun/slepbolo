import { cn } from "@/lib/utils";
import type { Annuncio } from "@/lib/types";
import { camereLibere } from "@/lib/types";

export function Tag({
  children,
  hot = false,
  className,
}: {
  children: React.ReactNode;
  hot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-[6px] border px-[9px] py-1 text-[11.5px] font-semibold",
        hot
          ? "border-arancio/30 bg-arancio/[0.12] text-[#B23A17]"
          : "border-linea bg-crema text-grigio",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge automatici derivati dallo stato dell'annuncio. */
export function TagAutomatici({ annuncio }: { annuncio: Annuncio }) {
  const libere = camereLibere(annuncio);
  const rooms = annuncio.rooms.filter((r) => r.stato === "libera");
  const speseIncluse = rooms.some((r) => r.spese_incluse);
  const registrato = (annuncio.contratto_tipo ?? "").startsWith("Registrato");
  const brevePeriodo = rooms.some((r) => r.permanenza_minima_mesi <= 3);

  return (
    <>
      {libere === 1 && <Tag hot>Ultima camera</Tag>}
      {libere >= 3 && <Tag hot>{libere} camere libere</Tag>}
      {speseIncluse && <Tag>Spese incluse</Tag>}
      {registrato && <Tag>Contratto registrato</Tag>}
      {brevePeriodo && <Tag>Anche breve periodo</Tag>}
    </>
  );
}

export function BadgeVerificato({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[--radius-pill] border border-verde/30 bg-verde/[0.1] px-2.5 py-1 text-[11.5px] font-bold text-verde",
        className,
      )}
      title="Registrato con mail @studio.unibo.it"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Studente UniBo verificato
    </span>
  );
}
