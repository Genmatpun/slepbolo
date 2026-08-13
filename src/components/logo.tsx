import { cn } from "@/lib/utils";

export function Logo({ className, chiaro = false }: { className?: string; chiaro?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid h-[34px] w-[34px] place-items-center overflow-hidden rounded-[10px] bg-rosso">
        <span className="relative z-[2] text-[15px] font-extrabold tracking-[-0.04em] text-crema">
          SB
        </span>
        <span className="absolute -bottom-2 -right-1.5 h-[22px] w-[22px] rounded-full bg-arancio" />
      </div>
      <div
        className={cn(
          "text-[19px] font-extrabold tracking-[-0.05em]",
          chiaro ? "text-crema" : "text-inchiostro",
        )}
      >
        SLEP<span className={chiaro ? "text-arancio" : "text-rosso"}>BOLO</span>
      </div>
    </div>
  );
}
