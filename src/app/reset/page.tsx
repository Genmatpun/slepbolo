import Link from "next/link";
import { Archivo } from "next/font/google";
import { ResetForm } from "@/components/reset-form";

export const metadata = { title: "Reimposta password — SLEPBOLO" };
export const dynamic = "force-dynamic";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], display: "swap" });

export default function ResetPage() {
  return (
    <div className={archivo.className}>
      <div className="mx-auto max-w-[440px] px-5 py-12 sm:px-6">
        <Link href="/app" className="text-[13px] font-bold text-grigio hover:text-inchiostro">← Torna all&apos;app</Link>
        <div className="eyebrow mt-4">Recupero accesso</div>
        <h1 className="mt-2 text-[30px]">Nuova password</h1>
        <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
        <ResetForm />
      </div>
    </div>
  );
}
