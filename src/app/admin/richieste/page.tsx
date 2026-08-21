import { getAdminUser } from "@/lib/admin";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogin } from "@/components/admin/admin-login";
import { RichiesteLista } from "@/components/admin/richieste-lista";

export const metadata = { title: "Richieste — Admin" };
export const dynamic = "force-dynamic";

export default async function RichiestePage() {
  if (!supabaseConfigurato()) return <Shell><p className="text-grigio">Supabase non configurato.</p></Shell>;

  const admin = await getAdminUser();
  if (!admin) {
    return (
      <Shell nascondiNav>
        <p className="mb-6 max-w-[46ch] text-[15px] text-grigio">Area riservata. Accedi con l&apos;account proprietario.</p>
        <div className="max-w-[380px]"><AdminLogin /></div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("richieste")
    .select("id, dati, created_at")
    .eq("stato", "in_attesa")
    .order("created_at", { ascending: false });

  return (
    <Shell>
      <p className="mb-6 text-[15px] text-grigio">
        {(data?.length ?? 0)} {(data?.length ?? 0) === 1 ? "proposta in attesa" : "proposte in attesa"}
      </p>
      <RichiesteLista richieste={(data ?? []) as never} adminId={admin.id} />
    </Shell>
  );
}

function Shell({ children, nascondiNav = false }: { children: React.ReactNode; nascondiNav?: boolean }) {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <div className="eyebrow">SLEPBOLO · Admin</div>
      <h1 className="mt-2 text-[32px]">Richieste in attesa</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      {!nascondiNav && <AdminNav />}
      {children}
    </div>
  );
}
