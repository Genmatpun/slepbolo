import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "./ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-[60] border-b-2 border-inchiostro bg-crema/[0.9] backdrop-blur-[14px] backdrop-saturate-[1.8]">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-6">
        <Link href="/" aria-label="SLEPBOLO — home">
          <Logo />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link
            href="/cerca"
            className="rounded-[--radius-pill] px-3.5 py-2.5 text-sm font-semibold text-grigio transition hover:bg-rosso/[0.06] hover:text-inchiostro"
          >
            Cerca stanza
          </Link>
          <Link
            href="/#come-funziona"
            className="rounded-[--radius-pill] px-3.5 py-2.5 text-sm font-semibold text-grigio transition hover:bg-rosso/[0.06] hover:text-inchiostro"
          >
            Come funziona
          </Link>
          <Link
            href="/candidature"
            className="rounded-[--radius-pill] px-3.5 py-2.5 text-sm font-semibold text-grigio transition hover:bg-rosso/[0.06] hover:text-inchiostro"
          >
            Candidature
          </Link>
          <Link
            href="/profilo"
            className="rounded-[--radius-pill] px-3.5 py-2.5 text-sm font-semibold text-grigio transition hover:bg-rosso/[0.06] hover:text-inchiostro"
          >
            Il mio profilo
          </Link>
          <Link
            href="/accedi"
            className="rounded-[--radius-pill] px-3.5 py-2.5 text-sm font-semibold text-grigio transition hover:bg-rosso/[0.06] hover:text-inchiostro"
          >
            Accedi
          </Link>
        </nav>

        <Button asChild size="sm">
          <Link href="/pubblica">+ Pubblica annuncio</Link>
        </Button>
      </div>
    </header>
  );
}
