import { PubblicaWizard } from "@/components/pubblica-wizard";

export const metadata = { title: "Pubblica annuncio — SLEPBOLO" };

export default function PubblicaPage() {
  return (
    <div className="mx-auto max-w-[760px] px-5 pb-20 pt-8 sm:px-6">
      <div className="eyebrow">Pubblica il tuo appartamento</div>
      <h1 className="mt-2 text-[28px]">Chi cerca vede subito le camere ancora libere.</h1>
      <p className="mt-2 max-w-[54ch] text-[15px] text-grigio">
        Quattro passaggi. Puoi salvare la bozza e riprendere quando vuoi.
      </p>
      <div className="mt-7">
        <PubblicaWizard />
      </div>
    </div>
  );
}
