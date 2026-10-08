import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { createClient, supabaseConfigurato } from "@/lib/supabase/server";
import { CONTRATTI, PREFERENZE_CASA, ZONE_BOLOGNA } from "@/lib/constants";
import { AnnuncioEstratto, LUNGHEZZA_MAX, ripulisci, type RispostaEstrazione } from "@/lib/estrazione";

// ============================================================
// "Incolla da WhatsApp": dal testo di un annuncio ai campi del modulo.
//
// - Solo studenti UniBo entrati (o l'admin), massimo 20 al giorno a testa
//   (funzione usa_estrazione nel database).
// - Il modello deve rispondere nello schema AnnuncioEstratto: niente testo
//   libero da interpretare.
// - Niente viene pubblicato da qui: il modulo si riempie e la persona
//   controlla tutto prima di pubblicare.
// ============================================================

export const runtime = "nodejs";
export const maxDuration = 60;

const ISTRUZIONI = `Ricevi il testo di un annuncio per una stanza in affitto a Bologna, copiato da un gruppo WhatsApp o Telegram di studenti. Può essere in italiano o in inglese, pieno di emoji e maiuscole. Estrai i campi dello schema.

Regola principale: riporta solo ciò che il testo dice. Se un'informazione non c'è, lascia null o un elenco vuoto. Non stimare prezzi, età, date o numeri di camere. Chi pubblica ricontrolla ogni campo, quindi un campo vuoto va bene e un campo inventato no.

Come leggere i casi frequenti:
- Prezzo: è l'affitto mensile a persona (o a posto letto). "325 + 65 totale 390, compresi condominio, TARI e Wi-Fi" vuol dire prezzo_mensile 325, spese_incluse false, spese_mensili 65, spese_comprendono [Condominio, TARI, Wi-Fi]. "300 € bills included" vuol dire spese_incluse true. "spese escluse" senza cifra: spese_incluse false, spese_mensili null.
- Stanze: una voce per ogni stanza libera. "Due posti letto in una camera doppia" è UNA stanza doppia con posti_liberi 2. "Due stanze singole" sono DUE stanze singole. "Posto letto in doppia" o "bed in a shared double room" è una doppia con posti_liberi 1. Se le stanze sono descritte insieme (stesso prezzo, stessa data), ripeti gli stessi valori per ognuna.
- Date in formato AAAA-MM-GG, ricavate dalla data di oggi che ti viene data. "Da ottobre" = il primo giorno del prossimo ottobre (quest'anno se non è passato). "Da gennaio (o metà dicembre)": usa la prima data possibile, cioè il 15 dicembre, e scrivi il resto in nota. "Subito" o "già libera" = la data di oggi.
- Zona: scegli una zona dell'elenco solo se il testo la nomina, o nomina una via, una piazza o un luogo noto che sta chiaramente lì (es. Piazza 8 Agosto → Centro storico, via Bergami / zona Saffi → Porta Saffi, ospedale Sant'Orsola → Massarenti). Se hai dubbi, null.
- via: la via o piazza scritta nel testo, con il civico se c'è.
- Contratto: "4+4" → "4+4"; "3+2" o "canone concordato" → "3+2 a canone concordato"; "contratto per studenti/universitario" → "Per studenti (6-36 mesi)"; "transitorio" → "Transitorio"; "subentro" → "Subentro". Se non è scritto, null. "Tramite agenzia" → tramite_agenzia true. "Senza contratto", "without contract", "in nero" → senza_contratto true.
- Caparra: com'è scritta, breve ("1 mensilità", "2 mensilità + spese d'agenzia").
- Coinquilini: solo chi ci abita già, una voce per persona. "In casa vivono già 3 ragazze" = tre voci con genere ragazza ed età null. "Una doppia con due ragazzi di 20 e 24 anni e una singola con una ragazza di 23" = tre voci con le loro età. Chi pubblica parla di sé ("vivo con…"): conta anche lui o lei solo se è chiaro che resta in casa.
- genere_casa: "solo ragazze", "all girls", "stanza per ragazza" → ragazze; lo stesso per ragazzi; "ragazze/i", "studenti e studentesse" → misto. Altrimenti null.
- preferenze: solo quelle scritte. "Solo studenti" → solo_studenti; "anche lavoratori" → lavoratori_ok; "coppie" → coppie_ok; "due persone che si conoscono", "amici" → amici_ok; "che parlino italiano" → italiano; "English ok" → english_ok; "no affitti brevi" → no_brevi.
- servizi: solo quelli elencati nello schema e nominati nel testo.
- vicino_a: in una riga, cosa c'è vicino e come ci si muove (fermate e linee bus, dipartimenti, supermercati, stazione).
- link_foto: un link https a foto o all'annuncio su un altro sito, se c'è.
- titolo: in italiano, al massimo 60 caratteri, nel formato "Singola in Bolognina" o "Due posti in doppia a Porta Saffi".
- descrizione: il testo originale, nella sua lingua, senza numeri di telefono, email e link. Non riassumerlo e non riscriverlo.
- contatto_nome e contatto_telefono: il nome e il numero di chi pubblica, se sono nel testo.

Zone possibili: ${ZONE_BOLOGNA.join(", ")}.
Contratti possibili: ${CONTRATTI.join(", ")}.
Preferenze possibili: ${PREFERENZE_CASA.map((p) => `${p.value} (${p.label})`).join(", ")}.`;

function errore(status: number, messaggio: string) {
  return NextResponse.json<RispostaEstrazione>({ ok: false, errore: messaggio }, { status });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errore(503, "La compilazione automatica non è attiva in questo momento. Compila i campi a mano.");
  }
  if (!supabaseConfigurato()) return errore(503, "Servizio non disponibile.");

  // 1. chi chiede
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errore(401, "Entra con la mail UniBo per usare la compilazione automatica.");

  // 2. il testo
  let testo = "";
  try {
    const corpo = (await req.json()) as { testo?: unknown };
    testo = typeof corpo.testo === "string" ? corpo.testo.trim() : "";
  } catch {
    return errore(400, "Richiesta non valida.");
  }
  if (testo.length < 20) return errore(400, "Incolla il messaggio completo dell'annuncio.");
  if (testo.length > LUNGHEZZA_MAX) {
    return errore(400, `Il messaggio è troppo lungo (più di ${LUNGHEZZA_MAX} caratteri). Incolla solo l'annuncio.`);
  }

  // 3. il limite giornaliero (si conta prima di chiamare il modello)
  const { data: permesso, error: erroreLimite } = await supabase.rpc("usa_estrazione");
  if (erroreLimite) return errore(503, "Servizio non disponibile. Riprova tra poco.");
  if (!permesso) return errore(429, "Hai usato la compilazione automatica 20 volte oggi. Domani si riparte, intanto puoi compilare a mano.");

  // 4. il modello
  const oggi = new Date().toISOString().slice(0, 10);
  const client = new Anthropic();
  try {
    const risposta = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      // Estrazione semplice: poco ragionamento basta, e costa meno.
      output_config: { effort: "low", format: betaZodOutputFormat(AnnuncioEstratto) },
      // Se il modello rifiuta per un falso allarme, l'API riprova da sola con un altro modello.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: ISTRUZIONI,
      messages: [
        {
          role: "user",
          content: `Data di oggi: ${oggi}.\n\nAnnuncio:\n"""\n${testo}\n"""`,
        },
      ],
    });

    if (risposta.stop_reason === "refusal") {
      return errore(422, "Non riesco a leggere questo messaggio. Compila i campi a mano.");
    }
    if (risposta.stop_reason === "max_tokens" || !risposta.parsed_output) {
      return errore(422, "Non sono riuscito a ricavare i dati da questo messaggio. Compila i campi a mano.");
    }

    return NextResponse.json<RispostaEstrazione>({ ok: true, dati: ripulisci(risposta.parsed_output) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return errore(429, "Troppe richieste in questo momento. Riprova tra un minuto.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("estrai-annuncio: errore API", e.status, e.message);
      return errore(502, "La compilazione automatica non risponde. Riprova, o compila a mano.");
    }
    console.error("estrai-annuncio: errore inatteso", e);
    return errore(500, "Qualcosa non ha funzionato. Riprova, o compila a mano.");
  }
}
