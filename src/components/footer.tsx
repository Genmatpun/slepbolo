import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="bg-inchiostro text-crema">
      <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-6">
        <div className="grid gap-9 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo chiaro className="mb-3.5" />
            <p className="max-w-[36ch] text-sm text-crema/70">
              Stanze e coinquilini per chi studia a Bologna. Prototipo — i dati mostrati sono
              di esempio.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-arancio">
              Studenti
            </h4>
            <FootLink href="/cerca">Cerca una stanza</FootLink>
            <FootLink href="/profilo">Crea il profilo</FootLink>
            <FootLink href="/#come-funziona">Come funziona</FootLink>
          </div>
          <div>
            <h4 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-arancio">
              Chi affitta
            </h4>
            <FootLink href="/pubblica">Pubblica annuncio</FootLink>
            <FootLink href="/cerca?vista=mappa">Esplora sulla mappa</FootLink>
          </div>
        </div>
        <div className="mt-9 flex flex-wrap justify-between gap-3.5 border-t border-crema/[0.14] pt-5 text-[12.5px] text-crema/50">
          <span>© 2026 SLEPBOLO — progetto indipendente, non affiliato all&apos;Università di Bologna.</span>
          <span>Bologna, Italia</span>
        </div>
      </div>
    </footer>
  );
}

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-[7px] block text-sm text-crema/70 transition hover:text-crema">
      {children}
    </Link>
  );
}
