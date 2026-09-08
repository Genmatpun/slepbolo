import { esci } from "./actions";
import { CredenzialiLogin } from "@/components/admin/credenziali-login";
import { CredenzialiLista } from "@/components/admin/credenziali-lista";
import { adminConfigurato, sessioneValida } from "@/lib/credenziali/sessione";
import { elencoUtenti } from "@/lib/credenziali/utenti";

export const metadata = {
  title: "Credenziali — Admin",
  // Fuori dai motori di ricerca e dalle anteprime dei link.
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

/**
 * Unica pagina delle credenziali, protetta da ADMIN_PASSWORD.
 *
 * Non passa più da Supabase Auth: non serve un account SLEPBOLO per entrare,
 * e avere un account non basta per entrare. Legge con la service role, quindi
 * nemmeno la policy RLS sulle email autorizzate c'entra più.
 */
export default async function CredenzialiPage() {
  if (!(await sessioneValida())) {
    return (
      <Guscio>
        <p className="mb-6 max-w-[46ch] text-[15px] text-grigio">
          Area riservata. Serve la password dell&apos;amministratore.
        </p>
        <div className="max-w-[380px] border-2 border-inchiostro bg-carta p-5">
          <CredenzialiLogin configurato={adminConfigurato()} />
        </div>
      </Guscio>
    );
  }

  const esito = await elencoUtenti();

  return (
    <Guscio>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-grigio">
          Ogni account registrato su SLEPBOLO, dal più recente.
        </p>
        <form action={esci}>
          <button
            type="submit"
            className="border-2 border-inchiostro px-4 py-2 text-[13px] font-extrabold transition hover:bg-inchiostro hover:text-crema"
          >
            Esci
          </button>
        </form>
      </div>

      {esito.ok && esito.demo && (
        <div className="mb-5 border-2 border-inchiostro bg-inchiostro px-4 py-3 text-[13px] leading-relaxed text-crema">
          <b>Dati finti.</b> Manca{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>: queste righe sono un
          esempio. Imposta la chiave su Vercel e rifai il deploy per vedere gli iscritti veri.
        </div>
      )}

      {esito.ok ? (
        <CredenzialiLista utenti={esito.utenti} />
      ) : (
        <div className="border-2 border-rosso/40 bg-rosso/[0.06] px-4 py-4 text-[14px] font-semibold text-rosso">
          {esito.errore}
        </div>
      )}
    </Guscio>
  );
}

function Guscio({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[880px] px-5 py-10 sm:px-6">
      <div className="eyebrow">SLEPBOLO · Admin</div>
      <h1 className="mt-2 text-[32px]">Credenziali iscritti</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      {children}
    </div>
  );
}
