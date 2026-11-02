import { getAdminUser } from "@/lib/admin";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogin } from "@/components/admin/admin-login";
import { AbilitaHost } from "@/components/admin/host-abilitati";
import { togliHost } from "./actions";

export const metadata = { title: "Host abilitati — Admin" };
export const dynamic = "force-dynamic";

interface HostAbilitato {
  email: string;
  nota: string | null;
  creato: string;
}

export default async function HostPage() {
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
  const { data, error } = await supabase.from("host_abilitati").select("email, nota, creato").order("creato", { ascending: false });
  const host = (data ?? []) as HostAbilitato[];

  return (
    <Shell>
      <p className="mb-4 max-w-[60ch] text-[15px] text-grigio">
        Chi affitta e non ha una mail universitaria può registrarsi come host solo con una mail che abiliti qui. Dopo che si è
        registrato, dalla sua casa in «Le mie case» puoi passargli l&apos;annuncio.
      </p>

      <AbilitaHost />

      {error ? (
        <p className="border-2 border-rosso bg-rosso/[0.06] p-3 text-[13px] font-semibold text-rosso">
          Non riesco a leggere l&apos;elenco. Se è la prima volta, controlla che la migrazione 0016 sia stata applicata.
        </p>
      ) : host.length === 0 ? (
        <div className="border-2 border-dashed border-linea p-10 text-center text-grigio">Ancora nessuna mail abilitata.</div>
      ) : (
        <div className="flex flex-col divide-y-2 divide-linea border-2 border-inchiostro">
          {host.map((h) => (
            <div key={h.email} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <b className="text-[15px] break-all">{h.email}</b>
                {h.nota && <div className="text-[13px] text-grigio">{h.nota}</div>}
              </div>
              <span className="text-[12px] text-grigio">dal {new Date(h.creato).toLocaleDateString("it-IT")}</span>
              <form action={togliHost}>
                <input type="hidden" name="email" value={h.email} />
                <button type="submit" className="border-2 border-linea px-3 py-1.5 text-[12px] font-bold text-grigio transition hover:border-rosso hover:text-rosso">
                  Togli
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, nascondiNav = false }: { children: React.ReactNode; nascondiNav?: boolean }) {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <div className="eyebrow">SLEPBOLO · Admin</div>
      <h1 className="mt-2 text-[32px]">Host abilitati</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      {!nascondiNav && <AdminNav />}
      {children}
    </div>
  );
}
