import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAnnunci } from "@/lib/data";
import { camereLibere, prezzoDa } from "@/lib/types";
import { HomeSearch } from "@/components/home-search";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const annunci = await getAnnunci();
  const camereTot = annunci.reduce((s, a) => s + camereLibere(a), 0);
  const prezzoMedio = annunci.length
    ? Math.round(annunci.reduce((s, a) => s + prezzoDa(a), 0) / annunci.length)
    : 0;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-[120px] -top-[180px] h-[520px] w-[520px]"
          style={{
            background:
              "radial-gradient(circle, rgba(228,87,46,.16), transparent 68%)",
          }}
        />
        <div className="mx-auto max-w-[1240px] px-5 pb-11 pt-[70px] sm:px-6">
          <div className="eyebrow">Solo studenti · Solo Bologna</div>
          <h1 className="my-3.5 max-w-[15ch] text-[clamp(34px,5.4vw,60px)]">
            Trova il tuo <em className="not-italic text-rosso">coinquilino</em>, non solo la
            stanza.
          </h1>
          <p className="mb-[30px] max-w-[52ch] text-[18px] text-grigio">
            Stanze in appartamenti condivisi da 3 mesi a un anno, pubblicate da chi ci abita
            già. Vedi chi c&apos;è in casa, quanto si paga davvero e quanto dista dalla tua sede
            UniBo.
          </p>

          <HomeSearch />

          <div className="mt-[34px] flex flex-wrap gap-x-[34px] gap-y-4">
            <Stat valore={String(annunci.length)} etichetta="annunci attivi" />
            <Stat valore={String(camereTot)} etichetta="camere libere ora" />
            <Stat valore={`${prezzoMedio} €`} etichetta="prezzo medio / mese" />
            <Stat valore="12" etichetta="zone coperte" />
          </div>
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section
        id="come-funziona"
        className="mt-[60px] border-t border-linea py-16"
      >
        <div className="mx-auto max-w-[1240px] px-5 sm:px-6">
          <div className="eyebrow">Come funziona</div>
          <h2 className="mt-2.5 text-[30px]">Due lati, una casa.</h2>
          <div className="mt-8 grid gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {PASSI.map((p, i) => (
              <div
                key={i}
                className="rounded-[--radius-lg] border border-linea bg-carta p-6"
              >
                <div className="mb-3.5 grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-rosso text-[15px] font-extrabold text-white">
                  {i + 1}
                </div>
                <h3 className="mb-[7px] text-[17px]">{p.titolo}</h3>
                <p className="text-sm text-grigio">{p.testo}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/cerca">Cerca una stanza</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/pubblica">Ho una stanza libera</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ valore, etichetta }: { valore: string; etichetta: string }) {
  return (
    <div>
      <b className="block text-[26px] font-extrabold tracking-[-0.03em]">{valore}</b>
      <span className="text-[13px] text-grigio">{etichetta}</span>
    </div>
  );
}

const PASSI = [
  {
    titolo: "Hai una stanza libera",
    testo:
      "Pubblichi l'appartamento: quante camere ci sono, quante sono già occupate, chi ci abita e quanto si paga di affitto e spese.",
  },
  {
    titolo: "Cerchi casa",
    testo:
      "Crei il profilo studente: facoltà, sede, budget, abitudini. Filtri per zona e distanza dalle lezioni.",
  },
  {
    titolo: "Vi trovate",
    testo:
      "Vedi chi sono i futuri coinquilini prima di scrivere. Niente agenzie, niente annunci fantasma di sublocazione.",
  },
  {
    titolo: "Chiudete l'accordo",
    testo:
      "Chat, visita (anche in video) e contratto. SLEPBOLO indica sempre se il contratto è registrato.",
  },
];
