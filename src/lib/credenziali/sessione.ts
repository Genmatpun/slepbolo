import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Gate a password per l'area /admin.
 *
 * Non usa Supabase Auth: è una serratura separata dagli account degli utenti,
 * così chi entra nell'admin non passa da un profilo studente e viceversa.
 * Il cookie non contiene la password ma solo una scadenza firmata in HMAC:
 * senza il segreto non è falsificabile.
 */

export const NOME_COOKIE = "slepbolo_admin";
export const PERCORSO_COOKIE = "/admin";
/**
 * Tetto massimo di una sessione aperta. Non è un "ricordami": arrivare
 * sul link /admin butta comunque fuori (vedi middleware.ts), quindi questo
 * serve solo a far scadere una scheda lasciata aperta.
 */
const DURATA_MS = 30 * 60 * 1000;

function passwordAttesa(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/** Segreto di firma: dedicato se c'è, altrimenti derivato dalla password. */
function segreto(): string {
  return process.env.ADMIN_SESSION_SECRET || `slepbolo::admin::${passwordAttesa() ?? ""}`;
}

/** False se ADMIN_PASSWORD non è impostata: l'area resta chiusa, non aperta. */
export function adminConfigurato(): boolean {
  return passwordAttesa() !== null;
}

/**
 * Confronto a tempo costante. Un `===` normale esce al primo carattere
 * diverso, e la differenza di tempo è misurabile: si indovina la password
 * un carattere alla volta.
 */
function ugualeSicuro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba); // confronto fittizio: stesso costo anche a lunghezze diverse
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function passwordCorretta(tentativo: string): boolean {
  const attesa = passwordAttesa();
  if (!attesa) return false;
  return ugualeSicuro(tentativo, attesa);
}

function firma(scadenza: number): string {
  return createHmac("sha256", segreto()).update(String(scadenza)).digest("hex");
}

export async function apriSessione(): Promise<void> {
  const scadenza = Date.now() + DURATA_MS;
  const store = await cookies();
  store.set(NOME_COOKIE, `${scadenza}.${firma(scadenza)}`, {
    httpOnly: true, // invisibile al JavaScript di pagina: niente furto via XSS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: PERCORSO_COOKIE,
    // Niente maxAge: è un cookie di sessione, il browser non lo scrive su
    // disco e sparisce alla chiusura. Nessun accesso salvato.
  });
}

export async function chiudiSessione(): Promise<void> {
  const store = await cookies();
  store.delete({ name: NOME_COOKIE, path: PERCORSO_COOKIE });
}

export async function sessioneValida(): Promise<boolean> {
  const valore = (await cookies()).get(NOME_COOKIE)?.value;
  if (!valore) return false;
  const [scadenzaRaw, hash] = valore.split(".");
  const scadenza = Number(scadenzaRaw);
  if (!Number.isFinite(scadenza) || !hash) return false;
  if (scadenza < Date.now()) return false;
  return ugualeSicuro(hash, firma(scadenza));
}

// ---------- Freno ai tentativi di indovinare la password ----------
// In memoria: si azzera a ogni riavvio e non è condiviso fra istanze
// serverless. Rallenta il brute force, non lo rende impossibile:
// la difesa vera resta una ADMIN_PASSWORD lunga e casuale.

const MAX_TENTATIVI = 5;
const FINESTRA_MS = 15 * 60 * 1000;
const tentativi = new Map<string, { n: number; scadeIl: number }>();

export function troppiTentativi(ip: string): boolean {
  const v = tentativi.get(ip);
  if (!v || v.scadeIl < Date.now()) return false;
  return v.n >= MAX_TENTATIVI;
}

export function registraFallimento(ip: string): void {
  const ora = Date.now();
  const v = tentativi.get(ip);
  if (!v || v.scadeIl < ora) {
    tentativi.set(ip, { n: 1, scadeIl: ora + FINESTRA_MS });
    return;
  }
  v.n += 1;
}

export function azzeraTentativi(ip: string): void {
  tentativi.delete(ip);
}
