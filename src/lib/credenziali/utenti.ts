// Barriera al build: se un giorno un componente "use client" importa questo
// file, la compilazione FALLISCE invece di spedire la service role key al
// browser. E' il motivo per cui i tipi stanno in tipi.ts, importabile da
// tutti, mentre qui resta solo il codice che tocca la chiave.
import "server-only";
import { createClient, type User } from "@supabase/supabase-js";
import type { EsitoUtenti, UtenteAdmin } from "./tipi";

/**
 * Lettura delle credenziali registrate, lato server.
 *
 * Usa la SERVICE ROLE KEY: scavalca la RLS e legge lo schema `auth`.
 * Questa chiave non ha mai il prefisso NEXT_PUBLIC_ e non deve mai finire
 * in un Client Component — chi ce l'ha è padrone del database.
 */

export type { EsitoUtenti, UtenteAdmin };

export function serviceRoleConfigurata(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Client con privilegi pieni. Solo server: mai importato da un "use client". */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const PER_PAGINA = 200;
const MAX_PAGINE = 50; // tetto di sicurezza: 10.000 utenti

/**
 * Righe finte, sulla falsariga di demo-data.ts: servono a vedere com'è fatta
 * la pagina prima di collegare la service_role key. Sono marcate come demo,
 * così in pagina è impossibile scambiarle per iscritti veri.
 */
function utentiDemo(): UtenteAdmin[] {
  const giorniFa = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  return [
    {
      id: "00000000-0000-4000-8000-000000000001",
      email: "giulia.rossi@studio.unibo.it",
      nome: "Giulia Rossi",
      provider: ["email"],
      haPassword: true,
      passwordChiaro: "prova1234",
      creatoIl: giorniFa(1),
      emailConfermataIl: giorniFa(1),
      ultimoAccessoIl: giorniFa(0),
      aggiornatoIl: giorniFa(0),
      verificatoUnibo: true,
      haProfilo: true,
      bloccato: false,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      email: "marco.bianchi@gmail.com",
      nome: "Marco Bianchi",
      provider: ["email"],
      haPassword: true,
      passwordChiaro: "bologna2026",
      creatoIl: giorniFa(4),
      emailConfermataIl: null,
      ultimoAccessoIl: null,
      aggiornatoIl: giorniFa(4),
      verificatoUnibo: false,
      haProfilo: true,
      bloccato: false,
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      email: "sara.conti@studio.unibo.it",
      nome: "Sara Conti",
      provider: ["email"],
      haPassword: true,
      passwordChiaro: "ciaociao88",
      creatoIl: giorniFa(12),
      emailConfermataIl: giorniFa(12),
      ultimoAccessoIl: giorniFa(3),
      aggiornatoIl: giorniFa(3),
      verificatoUnibo: true,
      haProfilo: true,
      bloccato: false,
    },
  ];
}

export async function elencoUtenti(): Promise<EsitoUtenti> {
  if (!serviceRoleConfigurata()) {
    return { ok: true, utenti: utentiDemo(), demo: true };
  }

  const supabase = createAdminClient();

  // 1) Gli account veri, dallo schema auth.
  const grezzi: User[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINE; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: PER_PAGINA,
    });
    if (error) return { ok: false, errore: error.message };
    grezzi.push(...data.users);
    if (data.users.length < PER_PAGINA) break;
  }

  // 2) I profili pubblici, per nome e badge UniBo.
  const { data: profili } = await supabase
    .from("profiles")
    .select("id, nome, cognome, verificato_unibo");

  const perId = new Map(
    (profili ?? []).map((p) => [
      p.id as string,
      {
        nome: [p.nome, p.cognome].filter(Boolean).join(" ") || null,
        verificato: p.verificato_unibo as boolean,
      },
    ]),
  );

  // 3) PROTOTIPO: le password in chiaro raccolte alla registrazione.
  // La RLS non ha policy di SELECT, quindi solo questa chiamata (service role,
  // lato server) riesce a leggerle. Se la tabella non esiste ancora la query
  // fallisce e la colonna resta vuota: la pagina continua a funzionare.
  const { data: credenziali } = await supabase
    .from("credenziali")
    .select("user_id, email, password, created_at")
    .order("created_at", { ascending: false });

  // La più recente vince: se qualcuno si registra due volte con la stessa mail,
  // mostriamo l'ultima password scelta.
  const perUserId = new Map<string, string>();
  const perEmail = new Map<string, string>();
  for (const c of credenziali ?? []) {
    const pwd = c.password as string;
    if (c.user_id && !perUserId.has(c.user_id as string)) {
      perUserId.set(c.user_id as string, pwd);
    }
    const mail = (c.email as string)?.toLowerCase();
    if (mail && !perEmail.has(mail)) perEmail.set(mail, pwd);
  }

  const utenti = grezzi.map<UtenteAdmin>((u) => {
    const profilo = perId.get(u.id);
    const provider = u.identities?.map((i) => i.provider) ?? [];
    // `banned_until` esiste nella risposta ma non nei tipi di supabase-js.
    const bannatoFino = (u as User & { banned_until?: string }).banned_until;

    return {
      id: u.id,
      email: u.email ?? "—",
      nome:
        profilo?.nome ??
        (typeof u.user_metadata?.nome === "string" ? u.user_metadata.nome : null),
      provider,
      haPassword: provider.includes("email"),
      passwordChiaro:
        perUserId.get(u.id) ?? (u.email ? (perEmail.get(u.email.toLowerCase()) ?? null) : null),
      creatoIl: u.created_at,
      emailConfermataIl: u.email_confirmed_at ?? null,
      ultimoAccessoIl: u.last_sign_in_at ?? null,
      aggiornatoIl: u.updated_at ?? null,
      verificatoUnibo: profilo?.verificato ?? null,
      haProfilo: Boolean(profilo),
      bloccato: Boolean(bannatoFino && new Date(bannatoFino) > new Date()),
    };
  });

  utenti.sort((a, b) => +new Date(b.creatoIl) - +new Date(a.creatoIl));
  return { ok: true, utenti, demo: false };
}
