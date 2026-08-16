import { cn } from "@/lib/utils";

/** Campo di form riusabile, restilizzato sulla palette. */
export function Field({
  label,
  hint,
  errore,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  errore?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <label className="text-[12.5px] font-bold">
        {label}
        {hint && <span className="font-medium text-grigio"> — {hint}</span>}
      </label>
      {children}
      {errore && <span className="text-[12px] font-semibold text-rosso">{errore}</span>}
    </div>
  );
}

export const inputClass =
  "border-2 border-linea bg-crema px-3.5 py-[11px] text-[14.5px] outline-none transition focus:border-inchiostro focus:bg-carta";

/** Chip selezionabili (toggle). */
export function ChipToggle({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-2 px-3 py-[7px] text-[13px] font-bold transition",
        attivo ? "border-inchiostro bg-inchiostro text-crema" : "border-linea bg-crema hover:border-grigio",
      )}
    >
      {children}
    </button>
  );
}
