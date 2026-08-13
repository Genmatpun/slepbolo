import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Accedi — SLEPBOLO" };

export default function AccediPage() {
  return (
    <div className="mx-auto max-w-[440px] px-5 pb-20 pt-12 sm:px-6">
      <div className="eyebrow">Accedi o registrati</div>
      <h1 className="mt-2 text-[28px]">La fiducia parte dalla mail.</h1>
      <p className="mt-2 text-[15px] text-grigio">
        Registrati con la tua <b className="text-inchiostro">@studio.unibo.it</b> per ottenere
        il badge di studente verificato. Va bene anche una mail normale, ma senza badge.
      </p>
      <div className="mt-7 rounded-[--radius-lg] border border-linea bg-carta p-6 shadow-[var(--shadow-morbida)]">
        <AuthForm />
      </div>
    </div>
  );
}
