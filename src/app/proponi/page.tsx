import Link from "next/link";
import { Archivo } from "next/font/google";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { ProponiForm } from "@/components/proponi-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Proponi una casa — SLEPBOLO" };
export const dynamic = "force-dynamic";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], display: "swap" });

export default async function ProponiPage() {
  let loggato = false;
  if (supabaseConfigurato()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    loggato = !!user;
  }

  return (
    <div className={archivo.className}>
      <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-6">
        <Link href="/app" className="text-[13px] font-bold text-grigio hover:text-inchiostro">← Torna all&apos;app</Link>
        <div className="eyebrow mt-4">Hai una stanza libera?</div>
        <h1 className="mt-2 text-[32px]">Proponi la tua casa</h1>
        <p className="mt-2 max-w-[54ch] text-[15px] text-grigio">
          Compila i dati: la controlliamo e la pubblichiamo. Chi cerca ti scriverà direttamente ai tuoi contatti.
        </p>
        <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />

        {loggato ? (
          <ProponiForm />
        ) : (
          <div className="border-2 border-linea p-8 text-center">
            <p className="text-[15px] text-grigio">Per proporre una casa devi prima accedere con la tua mail UniBo.</p>
            <Button asChild className="mt-4"><Link href="/app">Vai all&apos;accesso</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
