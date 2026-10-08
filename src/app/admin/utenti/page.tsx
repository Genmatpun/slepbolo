import { getAdminUser } from "@/lib/admin";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminLogin } from "@/components/admin/admin-login";

export const metadata = { title: "Utenti — Admin" };
export const dynamic = "force-dynamic";

interface Profilo {
  id: string;
  nome: string | null;
  cognome: string | null;
  eta: number | null;
  corso_laurea: string | null;
  abitudini: string[] | null;
  verificato_unibo: boolean;
  created_at: string;
}

export default async function UtentiPage() {
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
    .from("profiles")
    .select("id, nome, cognome, eta, corso_laurea, abitudini, verificato_unibo, created_at")
    .order("created_at", { ascending: false });
  const utenti = (data ?? []) as Profilo[];

  // Da quale canale è arrivato ognuno (?da= nel link che pubblichiamo).
  const { data: prov } = await supabase.from("provenienze").select("user_id, canale");
  const canaleDi = new Map((prov ?? []).map((p) => [p.user_id as string, p.canale as string]));

  const conteggi = new Map<string, number>();
  for (const u of utenti) {
    const c = canaleDi.get(u.id) ?? "diretto";
    conteggi.set(c, (conteggi.get(c) ?? 0) + 1);
  }
  const classifica = [...conteggi.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Shell>
      <p className="mb-4 text-[15px] text-grigio">
        {utenti.length} {utenti.length === 1 ? "persona registrata" : "persone registrate"}
      </p>

      {utenti.length > 0 && (
        <div className="mb-6 border-2 border-linea p-4">
          <div className="eyebrow mb-2">Da dove arrivano</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {classifica.map(([canale, n]) => (
              <span key={canale} className="text-[14px]">
                <b>{n}</b> <span className="text-grigio">{canale}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-grigio">
            «diretto» = chi è arrivato senza un link tracciato. Per tracciarne uno, aggiungi
            <code className="mx-1 bg-crema px-1">?da=tiktok</code> in fondo al link che pubblichi.
          </p>
        </div>
      )}

      {utenti.length === 0 ? (
        <div className="border-2 border-dashed border-linea p-10 text-center text-grigio">
          Ancora nessun iscritto. Compariranno qui appena si registrano.
        </div>
      ) : (
        <div className="flex flex-col divide-y-2 divide-linea border-2 border-inchiostro">
          {utenti.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="grid h-11 w-11 flex-none place-items-center bg-rosso text-[15px] font-black text-crema">
                {((u.nome?.[0] ?? "?") + (u.cognome?.[0] ?? "")).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[15px]">
                    {[u.nome, u.cognome].filter(Boolean).join(" ") || "Senza nome"}
                  </b>
                  {u.eta ? <span className="text-[13px] text-grigio">{u.eta} anni</span> : null}
                  {u.verificato_unibo && (
                    <span className="border border-verde/40 bg-verde/[0.12] px-2 py-0.5 text-[10px] font-bold uppercase text-verde">
                      ✓ UniBo
                    </span>
                  )}
                  {canaleDi.has(u.id) && (
                    <span className="border border-arancio/50 bg-arancio/[0.1] px-2 py-0.5 text-[10px] font-bold uppercase text-arancio">
                      da {canaleDi.get(u.id)}
                    </span>
                  )}
                </div>
                {u.corso_laurea && <div className="text-[13px] text-grigio">{u.corso_laurea}</div>}
                {u.abitudini && u.abitudini.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.abitudini.map((a) => (
                      <span key={a} className="border border-linea px-2 py-0.5 text-[11px] font-semibold text-grigio">{a}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-none text-[12px] text-grigio">
                iscritto il {new Date(u.created_at).toLocaleDateString("it-IT")}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[12.5px] text-grigio">
        Le email complete sono in Supabase → Authentication → Users (collegate dallo stesso utente).
      </p>
    </Shell>
  );
}

function Shell({ children, nascondiNav = false }: { children: React.ReactNode; nascondiNav?: boolean }) {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <div className="eyebrow">SLEPBOLO · Admin</div>
      <h1 className="mt-2 text-[32px]">Utenti registrati</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      {!nascondiNav && <AdminNav />}
      {children}
    </div>
  );
}
