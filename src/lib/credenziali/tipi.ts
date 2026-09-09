/**
 * Solo tipi, nessun codice e nessuna chiave.
 *
 * Esiste separato apposta: i componenti che girano nel browser hanno bisogno
 * della forma di UtenteAdmin, ma non devono avere nessun motivo per importare
 * `utenti.ts`, che al suo interno costruisce il client con la service role
 * key. Cosi' quel file resta raggiungibile solo dal server.
 */

export type UtenteAdmin = {
  id: string;
  email: string;
  nome: string | null;
  /** Provider di accesso: "email" = password, altrimenti OAuth. */
  provider: string[];
  haPassword: boolean;
  /**
   * PROTOTIPO: password in chiaro, presa dalla tabella `credenziali`.
   * null se l'utente si e' registrato prima che venissero salvate.
   */
  passwordChiaro: string | null;
  creatoIl: string;
  emailConfermataIl: string | null;
  ultimoAccessoIl: string | null;
  aggiornatoIl: string | null;
  verificatoUnibo: boolean | null;
  haProfilo: boolean;
  bloccato: boolean;
};

export type EsitoUtenti =
  | { ok: true; utenti: UtenteAdmin[]; demo: boolean }
  | { ok: false; errore: string };
