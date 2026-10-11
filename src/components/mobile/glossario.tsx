"use client";

import type { ReactNode } from "react";
import { C, css } from "./stile";

// ============================================================
// Le parole degli affitti, spiegate in una riga.
// Chi cerca casa per la prima volta non è tenuto a conoscerle.
// ============================================================

/** Cosa vuol dire ogni tipo di contratto che si può scegliere pubblicando. */
export const SPIEGA_CONTRATTO: Record<string, string> = {
  "4+4": "Dura 4 anni e si rinnova per altri 4. L'affitto si decide liberamente tra te e il proprietario.",
  "3+2 a canone concordato":
    "Dura 3 anni più 2 di rinnovo. L'affitto sta dentro i limiti fissati dagli accordi del Comune, di solito più bassi dei prezzi liberi.",
  "Per studenti (6-36 mesi)":
    "Pensato per chi studia fuori sede: da 6 a 36 mesi, con affitto dentro i limiti del Comune. Serve essere iscritti all'università.",
  Transitorio: "Per un'esigenza temporanea, da 1 a 18 mesi. Il motivo va scritto nel contratto.",
  Subentro:
    "Entri al posto di chi se ne va, nel contratto che c'è già. Chiedi che il proprietario sia d'accordo e che il cambio venga registrato.",
  "Da definire": "Chi pubblica non l'ha ancora deciso. Chiedilo prima di impegnarti.",
};

/** Le altre parole che si incontrano in un annuncio. */
export const SPIEGA_PAROLE: { parola: string; spiega: string }[] = [
  {
    parola: "Contratto registrato",
    spiega:
      "Depositato all'Agenzia delle Entrate. È quello che ti tutela e che serve per la borsa di studio e per detrarre l'affitto dalle tasse.",
  },
  {
    parola: "Caparra",
    spiega: "Soldi che lasci a garanzia e che riprendi a fine contratto, se non ci sono danni. Per legge non può superare 3 mensilità.",
  },
  { parola: "Spese", spiega: "Quello che si paga oltre l'affitto: di solito condominio, luce, gas, acqua e internet." },
  { parola: "TARI", spiega: "La tassa del Comune sui rifiuti. Si divide tra chi abita la casa." },
  {
    parola: "Tramite agenzia",
    spiega: "L'annuncio passa da un'agenzia, che di solito chiede un compenso. Chiedi subito quanto.",
  },
];

/** Una voce del glossario: la parola in grassetto, poi la spiegazione. */
function Voce({ parola, children }: { parola: string; children: ReactNode }) {
  return (
    <div style={css(`padding:12px 0;border-top:1px solid ${C.linea}`)}>
      <dt style={css("font-size:15px;font-weight:800;letter-spacing:-.01em")}>{parola}</dt>
      <dd style={css(`margin:4px 0 0;font-size:14.5px;line-height:1.45;color:${C.testo}`)}>{children}</dd>
    </div>
  );
}

/**
 * Il contenuto del foglio "Cosa vuol dire?". Se si passa il contratto
 * dell'annuncio, quello viene per primo.
 */
export function Glossario({ contratto }: { contratto?: string | null }) {
  const mio = contratto && SPIEGA_CONTRATTO[contratto] ? contratto : null;
  const altri = Object.keys(SPIEGA_CONTRATTO).filter((k) => k !== mio && k !== "Da definire");
  // "4+4" → "Contratto 4+4"; "Transitorio" → "Contratto transitorio"; "Subentro" resta com'è
  const nome = (k: string) => (k === "Subentro" ? k : `Contratto ${/^\d/.test(k) ? k : k.charAt(0).toLowerCase() + k.slice(1)}`);
  return (
    <dl style={css("margin:0")}>
      {mio && <Voce parola={nome(mio)}>{SPIEGA_CONTRATTO[mio]}</Voce>}
      {SPIEGA_PAROLE.map((p) => (
        <Voce key={p.parola} parola={p.parola}>
          {p.spiega}
        </Voce>
      ))}
      {altri.map((k) => (
        <Voce key={k} parola={nome(k)}>
          {SPIEGA_CONTRATTO[k]}
        </Voce>
      ))}
    </dl>
  );
}
