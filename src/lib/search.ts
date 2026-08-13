import { PREZZO_MAX } from "./constants";
import type { Annuncio } from "./types";
import { camereLibere, prezzoDa } from "./types";
import { distanzeSedi } from "./constants";

export interface FiltriRicerca {
  prezzoMax: number;
  zona: string;
  casaPer: string; // "" | ragazze | ragazzi | misto
  tipo: string; // "" | singola | doppia
  durata: number; // 0 | 3 | 6 | 12  (permanenza minima accettata)
  servizi: string[];
  soloVerificati: boolean;
  ordina: "rilevanza" | "prezzo-asc" | "prezzo-desc" | "distanza";
  sede: string; // key sede per l'ordinamento distanza
  vista: "griglia" | "mappa";
}

type SP = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/** Legge i filtri dai query params dell'URL. */
export function filtriDaSearchParams(sp: SP): FiltriRicerca {
  const serviziRaw = str(sp.servizi);
  return {
    prezzoMax: Number(str(sp.prezzoMax)) || PREZZO_MAX,
    zona: str(sp.zona),
    casaPer: str(sp.casaPer),
    tipo: str(sp.tipo),
    durata: Number(str(sp.durata)) || 0,
    servizi: serviziRaw ? serviziRaw.split(",").filter(Boolean) : [],
    soloVerificati: str(sp.verificati) === "1",
    ordina: (str(sp.ordina) || "rilevanza") as FiltriRicerca["ordina"],
    sede: str(sp.sede),
    vista: str(sp.vista) === "mappa" ? "mappa" : "griglia",
  };
}

/** Serializza i filtri in una query string condivisibile. */
export function searchParamsDaFiltri(f: Partial<FiltriRicerca>): string {
  const p = new URLSearchParams();
  if (f.prezzoMax && f.prezzoMax < PREZZO_MAX) p.set("prezzoMax", String(f.prezzoMax));
  if (f.zona) p.set("zona", f.zona);
  if (f.casaPer) p.set("casaPer", f.casaPer);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.durata) p.set("durata", String(f.durata));
  if (f.servizi?.length) p.set("servizi", f.servizi.join(","));
  if (f.soloVerificati) p.set("verificati", "1");
  if (f.ordina && f.ordina !== "rilevanza") p.set("ordina", f.ordina);
  if (f.sede) p.set("sede", f.sede);
  if (f.vista && f.vista !== "griglia") p.set("vista", f.vista);
  return p.toString();
}

/** Applica i filtri a una lista di annunci (già con almeno una stanza libera). */
export function applicaFiltri(
  annunci: Annuncio[],
  f: FiltriRicerca,
  hostVerificato: (a: Annuncio) => boolean = () => true,
): Annuncio[] {
  const filtrati = annunci.filter((a) => {
    if (camereLibere(a) <= 0) return false;
    if (prezzoDa(a) > f.prezzoMax) return false;
    if (f.zona && a.zona !== f.zona) return false;
    if (f.casaPer && a.genere !== f.casaPer) return false;
    if (f.tipo && !a.rooms.some((r) => r.stato === "libera" && r.tipo === f.tipo)) return false;
    if (f.durata) {
      const ok = a.rooms.some(
        (r) => r.stato === "libera" && r.permanenza_minima_mesi <= f.durata,
      );
      if (!ok) return false;
    }
    if (f.soloVerificati && !hostVerificato(a)) return false;
    for (const s of f.servizi) {
      if (s === "Spese incluse") {
        if (!a.rooms.some((r) => r.stato === "libera" && r.spese_incluse)) return false;
      } else if (!a.servizi.includes(s)) {
        return false;
      }
    }
    return true;
  });

  return ordinaAnnunci(filtrati, f);
}

function distanzaVersoSede(a: Annuncio, sedeKey: string): number {
  if (!a.lat || !a.lng || !sedeKey) return Number.POSITIVE_INFINITY;
  const d = distanzeSedi({ lat: a.lat, lng: a.lng }).find((x) => x.sede.key === sedeKey);
  return d ? d.km : Number.POSITIVE_INFINITY;
}

export function ordinaAnnunci(lista: Annuncio[], f: FiltriRicerca): Annuncio[] {
  const l = lista.slice();
  if (f.ordina === "prezzo-asc") l.sort((a, b) => prezzoDa(a) - prezzoDa(b));
  else if (f.ordina === "prezzo-desc") l.sort((a, b) => prezzoDa(b) - prezzoDa(a));
  else if (f.ordina === "distanza" && f.sede)
    l.sort((a, b) => distanzaVersoSede(a, f.sede) - distanzaVersoSede(b, f.sede));
  return l;
}
