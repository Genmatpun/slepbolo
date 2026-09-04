import { cn } from "@/lib/utils";

/** Logo SLEPBOLO ufficiale. `chiaro` = versione crema per sfondi scuri. */
export function Logo({ className, chiaro = false }: { className?: string; chiaro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chiaro ? "/logo-chiaro.png" : "/logo.png"}
      alt="SLEPBOLO"
      className={cn("h-10 w-auto", className)}
    />
  );
}
