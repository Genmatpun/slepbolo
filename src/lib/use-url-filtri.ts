"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook per leggere/scrivere i filtri nei query params.
 * Mantiene la ricerca condivisibile e il tasto indietro funzionante.
 */
export function useUrlFiltri() {
  const router = useRouter();
  const params = useSearchParams();

  const get = useCallback((k: string) => params.get(k) ?? "", [params]);

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(next.toString() ? `/cerca?${next}` : "/cerca", { scroll: false });
    },
    [params, router],
  );

  const toggleInList = useCallback(
    (k: string, value: string) => {
      const current = (params.get(k) ?? "").split(",").filter(Boolean);
      const next = current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value];
      set({ [k]: next.length ? next.join(",") : null });
    },
    [params, set],
  );

  return { get, set, toggleInList, params };
}
