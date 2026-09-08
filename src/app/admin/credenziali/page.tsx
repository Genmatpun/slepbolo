import { getAdminUser } from "@/lib/admin";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogin } from "@/components/admin/admin-login";
import { CredenzialiLista, type Credenziale } from "@/components/admin/credenziali-lista";

export const metadata = { title: "Credenziali — Admin" };
export const dynamic = "force-dynamic";

export default async function CredenzialiPage() {
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

  // Email autorizzate a LEGGERE le credenziali (deve coincidere con la policy
  // SELECT su Supabase). Serve solo per l'avviso qui sotto.
  const AUTORIZZATE = ["gennaiomat@gmail.com", "accexel90@gmail.com"];
  const emailAdmin = admin.email.toLowerCase();
  const autorizzato = AUTORIZZATE.includes(emailAdmin);

  const supabase = await createClient();
  const { data } = await supabase
    .from("credenziali")
    .select("id, email, password, created_at")
    .order("created_at", { ascending: false });
  const righe = (data ?? []) as Credenziale[];

  return (
    <Shell>
      <div className="mb-4 border-2 border-inchiostro px-4 py-3 text-[13px]">
        Sei loggato come <b>{admin.email}</b>.{" "}
        {autorizzato
          ? "Questa email è autorizzata a leggere le credenziali."
          : "⚠️ Questa email NON è tra quelle autorizzate a leggere: per questo la lista risulta vuota. Esci e accedi con gennaiomat@gmail.com, oppure aggiungi questa email alla regola SELECT su Supabase."}
      </div>

      <div className="mb-6 border-2 border-arancio/40 bg-arancio/[0.08] px-4 py-3 text-[13px] font-semibold text-[#B23A17]">
        Password salvate in chiaro — solo per la fase di test con account fittizi.
        Visibili unicamente a te (proprietario). Non usare con utenti reali.
      </div>

      {righe.length === 0 ? (
        <div className="border-2 border-dashed border-linea p-10 text-center text-grigio">
          {autorizzato
            ? "Nessuna credenziale salvata. Compariranno qui appena qualcuno si registra."
            : "Lista vuota perché questa email non è autorizzata alla lettura (vedi avviso sopra)."}
        </div>
      ) : (
        <CredenzialiLista righe={righe} />
      )}
    </Shell>
  );
}

function Shell({ children, nascondiNav = false }: { children: React.ReactNode; nascondiNav?: boolean }) {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <div className="eyebrow">SLEPBOLO · Admin</div>
      <h1 className="mt-2 text-[32px]">Credenziali iscritti</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      {!nascondiNav && <AdminNav />}
      {children}
    </div>
  );
}
