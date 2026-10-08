import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { getAnnunci, getAnnuncio } from "@/lib/data";
import { aMobile, ordinaPerFreschezza } from "@/lib/annuncio-mobile";
import { MobileApp } from "@/components/mobile/mobile-app";

export const dynamic = "force-dynamic";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

type Params = Promise<{ casa?: string | string[]; pubblica?: string | string[]; modifica?: string | string[] }>;

const ID_VALIDO = /^[0-9a-f-]{36}$/i;

function idCasa(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && ID_VALIDO.test(s) ? s : null;
}

/**
 * Un annuncio condiviso su WhatsApp arriva come /app?casa=<id>: l'anteprima
 * del link mostra la casa vera invece della scritta generica dell'app.
 */
export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const id = idCasa((await searchParams).casa);
  const base: Metadata = { title: "SLEPBOLO — app" };
  if (!id) return base;

  const a = await getAnnuncio(id);
  if (!a || !a.attivo) return base;
  const m = aMobile(a);
  const chi = m.coinq.length
    ? `Ci abitano: ${m.coinq.map((c) => [c.g === "ragazza" ? "ragazza" : c.g === "ragazzo" ? "ragazzo" : "persona", c.e].filter(Boolean).join(" ")).join(", ")}.`
    : "";
  const titolo = `${m.tipo} in ${m.zona} · ${m.prezzo} €/mese`;
  const descrizione = [chi, "Solo studenti UniBo, gratis, senza agenzie."].filter(Boolean).join(" ");
  return {
    title: `${titolo} — SLEPBOLO`,
    description: descrizione,
    openGraph: {
      title: titolo,
      description: descrizione,
      images: m.foto[0] ? [{ url: m.foto[0] }] : undefined,
    },
  };
}

export default async function AppPage({ searchParams }: { searchParams: Params }) {
  const [annunci, sp] = await Promise.all([getAnnunci(), searchParams]);
  const data = annunci.map(aMobile).sort(ordinaPerFreschezza);

  // /proponi e /pubblica (link vecchi) arrivano qui come ?pubblica=1 o ?modifica=<id>
  const modifica = idCasa(sp.modifica);
  const pubblicaIniziale = modifica ? { modificaId: modifica } : sp.pubblica ? { modificaId: null } : null;

  return (
    <div className={archivo.className}>
      <MobileApp annunci={data} casaIniziale={idCasa(sp.casa)} pubblicaIniziale={pubblicaIniziale} />
    </div>
  );
}
