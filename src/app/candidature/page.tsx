import Link from "next/link";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CandidatureLista } from "@/components/candidature-lista";

export const metadata = { title: "Candidature — SLEPBOLO" };

export default async function CandidaturePage() {
  if (!supabaseConfigurato()) {
    return <SpiegazioneDemo />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Vuoto
        titolo="Accedi per vedere le candidature"
        testo="Le conversazioni tra chi cerca e chi affitta sono private: serve il login."
        cta={{ href: "/accedi", label: "Accedi" }}
      />
    );
  }

  // Candidature dove sono studente o host (la RLS filtra già).
  const { data } = await supabase
    .from("applications")
    .select(
      "id, messaggio, stato, created_at, student_id, rooms(prezzo_mensile, apartments(titolo, zona, host_id)), profiles(nome, corso_laurea, verificato_unibo)",
    )
    .order("created_at", { ascending: false });

  const candidature = (data ?? []).map((c) => ({
    id: c.id as string,
    stato: c.stato as string,
    messaggio: c.messaggio as string | null,
    // @ts-expect-error join annidato
    titolo: c.rooms?.apartments?.titolo ?? "Annuncio",
    // @ts-expect-error join annidato
    zona: c.rooms?.apartments?.zona ?? "",
    // @ts-expect-error join annidato
    prezzo: c.rooms?.prezzo_mensile ?? 0,
    // @ts-expect-error join annidato
    sonoHost: c.rooms?.apartments?.host_id === user.id,
    // @ts-expect-error join annidato
    studente: c.profiles?.nome ?? "Studente",
    // @ts-expect-error join annidato
    studenteCorso: c.profiles?.corso_laurea ?? "",
    // @ts-expect-error join annidato
    studenteVerificato: c.profiles?.verificato_unibo ?? false,
  }));

  if (candidature.length === 0) {
    return (
      <Vuoto
        titolo="Ancora nessuna candidatura"
        testo="Quando ti candidi a una stanza o ricevi una richiesta, la trovi qui."
        cta={{ href: "/cerca", label: "Cerca una stanza" }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-5 pb-20 pt-8 sm:px-6">
      <h1 className="text-[28px]">Candidature e messaggi</h1>
      <p className="mt-1 text-sm text-grigio">Ogni candidatura porta con sé il profilo di chi scrive.</p>
      <CandidatureLista candidature={candidature} userId={user.id} />
    </div>
  );
}

function Vuoto({
  titolo,
  testo,
  cta,
}: {
  titolo: string;
  testo: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-[520px] px-5 py-24 text-center sm:px-6">
      <h1 className="text-[24px]">{titolo}</h1>
      <p className="mx-auto mt-2 max-w-[40ch] text-[15px] text-grigio">{testo}</p>
      <Button asChild className="mt-5">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}

function SpiegazioneDemo() {
  return (
    <div className="mx-auto max-w-[560px] px-5 py-24 text-center sm:px-6">
      <div className="eyebrow">Candidature e chat</div>
      <h1 className="mt-2 text-[26px]">Serve Supabase per la messaggistica.</h1>
      <p className="mx-auto mt-3 max-w-[46ch] text-[15px] text-grigio">
        Questa sezione usa autenticazione e Realtime. Collega un progetto Supabase
        (variabili in <code className="rounded bg-crema px-1.5 py-0.5">.env.local</code>) e
        applica le migration in <code className="rounded bg-crema px-1.5 py-0.5">supabase/</code>{" "}
        per attivare candidature e messaggi in tempo reale.
      </p>
      <Button asChild variant="ghost" className="mt-5">
        <Link href="/cerca">Torna alla ricerca</Link>
      </Button>
    </div>
  );
}
