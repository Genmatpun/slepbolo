import Link from "next/link";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { InvitiLista } from "@/components/inviti-lista";

export const metadata = { title: "Inviti coinquilino — SLEPBOLO" };
export const dynamic = "force-dynamic";

export default async function InvitiPage() {
  if (!supabaseConfigurato()) {
    return <Vuoto titolo="Serve Supabase" testo="Collega un progetto Supabase per gestire gli inviti." cta={{ href: "/app", label: "Torna all'app" }} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Vuoto titolo="Accedi per vedere i tuoi inviti" testo="Gli inviti a entrare in una casa sono legati al tuo account UniBo." cta={{ href: "/accedi", label: "Accedi" }} />;
  }

  const { data } = await supabase
    .from("housemates")
    .select("id, genere, eta, corso, abitudini, scadenza_invito, apartments(titolo, zona)")
    .eq("profile_id", user.id)
    .eq("stato", "in_attesa")
    .order("scadenza_invito", { ascending: true });

  const ora = Date.now();
  const inviti = (data ?? [])
    .filter((h) => h.scadenza_invito && new Date(h.scadenza_invito as string).getTime() > ora)
    .map((h) => ({
      id: h.id as string,
      genere: (h.genere as string | null) ?? null,
      eta: h.eta as number | null,
      corso: (h.corso as string | null) ?? "",
      abitudini: (h.abitudini as string[]) ?? [],
      scadenza: h.scadenza_invito as string,
      // @ts-expect-error join annidato
      titolo: h.apartments?.titolo ?? "Un annuncio",
      // @ts-expect-error join annidato
      zona: h.apartments?.zona ?? "",
    }));

  if (inviti.length === 0) {
    return <Vuoto titolo="Nessun invito in sospeso" testo="Quando qualcuno ti aggiunge come coinquilino di una casa, la richiesta compare qui e hai 24 ore per accettarla." cta={{ href: "/app", label: "Vai all'app" }} />;
  }

  return (
    <div className="mx-auto max-w-[720px] px-5 pb-20 pt-8 sm:px-6">
      <h1 className="text-[28px]">Inviti come coinquilino</h1>
      <p className="mt-1 max-w-[52ch] text-sm text-grigio">
        Qualcuno ti ha aggiunto come coinquilino di una casa. Accetta per confermare (i dati mostrati
        vengono dal tuo profilo), oppure rifiuta per essere rimosso. Gli inviti non accettati entro 24 ore spariscono da soli.
      </p>
      <InvitiLista inviti={inviti} />
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
      <p className="mx-auto mt-2 max-w-[42ch] text-[15px] text-grigio">{testo}</p>
      <Button asChild className="mt-5">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}
