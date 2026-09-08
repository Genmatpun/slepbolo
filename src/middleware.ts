import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Rinfresca la sessione Supabase su ogni richiesta.
 * Se Supabase non è configurato, passa oltre senza fare nulla.
 */
export async function middleware(request: NextRequest) {
  /**
   * La pagina credenziali ha una serratura sua (ADMIN_PASSWORD) e non usa la
   * sessione Supabase. Aprirla con una GET cancella sempre l'accesso
   * precedente: la password va rimessa a ogni visita, niente login ricordato.
   * Solo sulle GET, altrimenti spazzeremmo via il cookie che il login stesso
   * sta impostando.
   */
  if (request.nextUrl.pathname === "/admin/credenziali") {
    const risposta = NextResponse.next({ request });
    if (request.method === "GET") {
      risposta.cookies.delete({ name: "slepbolo_admin", path: "/admin" });
    }
    return risposta;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  const response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
