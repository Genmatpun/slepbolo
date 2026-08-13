import { cn } from "@/lib/utils";
import { labelCamereLibere } from "@/lib/utils";

/**
 * L'elemento distintivo: una fila di quadratini, verdi le libere e grigi
 * le occupate, con la scritta "2 camere libere su 4".
 */
export function RoomsIndicator({
  totali,
  libere,
  className,
}: {
  totali: number;
  libere: number;
  className?: string;
}) {
  const occupate = totali - libere;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: totali }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-3 rounded-[4px]",
              i >= occupate ? "bg-verde" : "bg-linea",
            )}
          />
        ))}
      </div>
      <span className="text-[12.5px] font-semibold text-grigio">
        {labelCamereLibere(libere)} su {totali}
      </span>
    </div>
  );
}
