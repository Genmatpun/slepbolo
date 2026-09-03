import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { camereLibere } from "@/lib/types";
import type { Annuncio } from "@/lib/types";

export const metadata = { title: "Admin — SLEPBOLO" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!supabaseConfigurato()) {
    return (
      <Shell>
        <p className="text-grigio">Configura Supabase per usare l&apos;area admin.</p>
      </Shell>
    );
  }

  const admin = await getAdminUser();
  if (!admin) {
    return (
      <Shell>
        <p className="mb-6 max-w-[46ch] text-[15px] text-grigio">
          Area riservata. Accedi con l&apos;account proprietario per gestire gli annunci.
        </p>
        <div className="max-w-[380px]">
          <AdminLogin />
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  // L'admin vede tutti gli annunci pubblicati dagli utenti.
  const { data } = await supabase
    .from("apartments")
    .select("*, rooms(*), housemates(*)")
    .order("created_at", { ascending: false });
  const annunci = (data ?? []) as Annuncio[];

  // Chi ha pubblicato ogni annuncio (nome dal profilo).
  const hostIds = [...new Set(annunci.map((a) => a.host_id).filter(Boolean))];
  const { data: profs } = hostIds.length
    ? await supabase.from("profiles").select("id, nome, cognome").in("id", hostIds)
    : { data: [] as { id: string; nome: string | null; cognome: string | null }[] };
  const nomeHost = new Map(
    (profs ?? []).map((p) => [p.id, `${p.nome ?? ""} ${p.cognome ?? ""}`.trim()]),
  );

  return (
    <Shell>
      <AdminNav />
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-[15px] text-grigio">
          {annunci.length} {annunci.length === 1 ? "annuncio" : "annunci"} · {admin.email}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/modulo" target="_blank">Modulo host (PDF)</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/nuovo">+ Nuovo appartamento</Link>
          </Button>
        </div>
      </div>

      {annunci.length === 0 ? (
        <div className="border-2 border-dashed border-linea p-10 text-center text-grigio">
          Ancora nessun appartamento. Clicca <b className="text-inchiostro">Nuovo appartamento</b> per iniziare.
        </div>
      ) : (
        <div className="flex flex-col divide-y-2 divide-linea border-2 border-inchiostro">
          {annunci.map((a) => (
            <Link
              key={a.id}
              href={`/admin/${a.id}`}
              className="flex items-center gap-4 p-4 transition hover:bg-crema"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="truncate text-[15px]">{a.titolo}</b>
                  {!a.attivo && (
                    <span className="bg-grigio px-2 py-0.5 text-[10px] font-bold uppercase text-crema">
                      Nascosto
                    </span>
                  )}
                </div>
                <span className="block text-[13px] text-grigio">
                  {a.zona} · {a.rooms?.length ? `${camereLibere(a)}/${a.camere_totali} libere` : "0 stanze"} ·{" "}
                  {a.housemates?.length ?? 0} coinquilini
                </span>
                <span className="block text-[12px] text-grigio">
                  Pubblicato da <b className="text-inchiostro">{nomeHost.get(a.host_id) || "Utente"}</b>
                </span>
              </div>
              <span className="text-grigio">→</span>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <div className="eyebrow">SLEPBOLO · Admin</div>
      <h1 className="mt-2 text-[32px]">Gestione appartamenti</h1>
      <div className="mt-2 h-[2px] w-full bg-inchiostro" />
      <div className="mt-8">{children}</div>
    </div>
  );
}
