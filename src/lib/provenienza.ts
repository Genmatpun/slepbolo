/**
 * Da dove arriva chi apre SLEPBOLO.
 *
 * I link che pubblichiamo finiscono in `?da=tiktok`, `?da=telegram`, `?da=adesivo`.
 * Qui lo leggiamo una volta e lo teniamo sul dispositivo finché la persona non si
 * registra: a quel punto l'app lo scrive nella tabella `provenienze`.
 *
 * Solo il nome del canale, niente altro: nessun identificatore, niente di personale.
 */

const CHIAVE = "slepbolo-da";
/** Lettere, numeri, trattini. Tutto il resto lo buttiamo: arriva dall'indirizzo. */
const FORMA = /^[a-z0-9_-]{1,24}$/;

/**
 * Legge `?da=` dall'indirizzo e lo mette da parte; se non c'è, ritorna quello
 * già salvato. Sicuro da chiamare anche sul server (ritorna null).
 */
export function leggiProvenienza(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const da = new URLSearchParams(window.location.search).get("da")?.trim().toLowerCase();
    if (da && FORMA.test(da)) {
      localStorage.setItem(CHIAVE, da);
      return da;
    }
    const salvata = localStorage.getItem(CHIAVE);
    return salvata && FORMA.test(salvata) ? salvata : null;
  } catch {
    // finestra privata, memoria piena, permessi negati: non è importante
    return null;
  }
}
