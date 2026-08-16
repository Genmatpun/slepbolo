import { ProfiloForm } from "@/components/profilo-form";

export const metadata = { title: "Il mio profilo — SLEPBOLO" };

export default function ProfiloPage() {
  return (
    <div className="mx-auto max-w-[680px] px-5 pb-20 pt-8 sm:px-6">
      <div className="eyebrow">Il tuo profilo studente</div>
      <h1 className="mt-2 text-[28px]">Fatti conoscere prima di scrivere.</h1>
      <p className="mt-2 max-w-[52ch] text-[15px] text-grigio">
        Chi affitta vede il tuo profilo quando ricevi una candidatura: meno messaggi a vuoto,
        risposte più veloci.
      </p>
      <div className="mt-7 rounded-[--radius-lg] border border-linea bg-carta p-6 shadow-[var(--shadow-morbida)]">
        <ProfiloForm />
      </div>
    </div>
  );
}
