import { Suspense } from "react";
import { getAnnunci } from "@/lib/data";
import { filtriDaSearchParams, applicaFiltri } from "@/lib/search";
import { FiltriSidebar } from "@/components/filtri-sidebar";
import { CercaToolbar } from "@/components/cerca-toolbar";
import { AnnuncioCard } from "@/components/annuncio-card";
import { MappaView } from "@/components/mappa-view";

export const metadata = { title: "Cerca stanza — SLEPBOLO" };
export const dynamic = "force-dynamic";

export default async function CercaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtri = filtriDaSearchParams(sp);
  const annunci = await getAnnunci();
  const risultati = applicaFiltri(annunci, filtri);

  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-8 sm:px-6">
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="text-[26px]">Stanze disponibili</h2>
          <p className="mt-1 text-sm text-grigio">
            {risultati.length === 0
              ? "Nessuna stanza con questi filtri"
              : `${risultati.length} ${risultati.length === 1 ? "annuncio" : "annunci"} · aggiornati oggi`}
          </p>
        </div>
        <Suspense>
          <CercaToolbar />
        </Suspense>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
        <Suspense>
          <FiltriSidebar />
        </Suspense>

        <section>
          {filtri.vista === "mappa" ? (
            <MappaView annunci={risultati} />
          ) : risultati.length === 0 ? (
            <div className="rounded-[--radius-lg] border border-linea bg-carta px-5 py-[70px] text-center text-grigio">
              <b className="mb-1.5 block text-[19px] text-inchiostro">
                Nessuna stanza trovata
              </b>
              Prova ad allargare il prezzo o a togliere qualche filtro.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              {risultati.map((a) => (
                <AnnuncioCard key={a.id} annuncio={a} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
