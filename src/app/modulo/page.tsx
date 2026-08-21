"use client";

import { useState } from "react";

// Modulo pubblico: l'host compila la scheda dell'appartamento e la esporta in PDF
// (Stampa → Salva come PDF), poi la manda al gestore che la carica in /admin.

const U =
  "w-full border-0 border-b-2 border-linea bg-transparent px-1 py-1.5 text-[15px] font-semibold outline-none focus:border-inchiostro print:border-b print:border-linea";
const SERVIZI = [
  "Wi-Fi", "Lavatrice", "Arredata", "Balcone", "Lavastoviglie",
  "Aria condizionata", "Ammessi animali", "Si può fumare", "Bici/garage",
];
const ZONE = [
  "Barca", "Bolognina", "Cirenaica", "Fiera", "Massarenti", "Murri", "Navile",
  "Porta Saffi", "San Donato", "Santo Stefano", "Saragozza", "Zamboni",
];

export default function ModuloPage() {
  const [coinq] = useState([0, 1, 2, 3, 4]);

  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 print:py-0 sm:px-8">
      {/* Intestazione */}
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-9 w-9 place-items-center overflow-hidden bg-rosso">
          <span className="text-[15px] font-black tracking-[-0.04em] text-crema">SB</span>
          <span className="absolute -bottom-2 -right-1.5 h-5 w-5 rounded-full bg-arancio" />
        </div>
        <div className="text-[19px] font-black tracking-[-0.05em]">
          SLEP<span className="text-rosso">BOLO</span>
        </div>
        <span className="ml-auto text-[12px] font-bold uppercase tracking-[0.14em] text-grigio">Scheda appartamento</span>
      </div>
      <div className="mt-3 h-[2px] w-full bg-inchiostro" />

      <p className="no-print mt-5 max-w-[62ch] text-[14.5px] leading-relaxed text-grigio">
        Compila i dati della casa e delle persone che ci abitano, poi clicca <b className="text-inchiostro">Scarica PDF</b>:
        scegli <b className="text-inchiostro">&quot;Salva come PDF&quot;</b> e invia il file. Verrà pubblicato su SLEPBOLO.
      </p>

      <Sez n="1" titolo="L'appartamento" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo label="Titolo annuncio" wide><input className={U} placeholder="Es. Singola in trilocale a Zamboni" /></Campo>
        <Campo label="Zona">
          <select className={U} defaultValue=""><option value="" disabled>— scegli —</option>{ZONE.map((z) => <option key={z}>{z}</option>)}</select>
        </Campo>
        <Campo label="Via (senza civico)"><input className={U} placeholder="Es. Via Mascarella" /></Campo>
        <Campo label="Piano / ascensore"><input className={U} placeholder="Es. 2° con ascensore" /></Campo>
        <Campo label="Casa di">
          <select className={U} defaultValue=""><option value="" disabled>— scegli —</option><option>Ragazzi e ragazze</option><option>Solo ragazze</option><option>Solo ragazzi</option></select>
        </Campo>
        <Campo label="Camere totali"><input className={U} inputMode="numeric" placeholder="Es. 3" /></Campo>
        <Campo label="Camere già occupate"><input className={U} inputMode="numeric" placeholder="Es. 2" /></Campo>
      </div>

      <Sez n="2" titolo="Stanza libera e prezzo" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo label="Tipo stanza">
          <select className={U} defaultValue=""><option value="" disabled>— scegli —</option><option>Singola</option><option>Doppia</option></select>
        </Campo>
        <Campo label="Affitto al mese (a persona)"><input className={U} placeholder="Es. 400 €" /></Campo>
        <Campo label="Spese"><input className={U} placeholder="Incluse / +50 € al mese" /></Campo>
        <Campo label="Disponibile dal"><input className={U} placeholder="Es. settembre 2026" /></Campo>
        <Campo label="Permanenza minima"><input className={U} placeholder="Es. 6 mesi" /></Campo>
        <Campo label="Cauzione"><input className={U} placeholder="Es. 1 mensilità" /></Campo>
        <Campo label="Contratto" wide><input className={U} placeholder="Es. Registrato studenti (3+2)" /></Campo>
      </div>

      <Sez n="3" titolo="Chi ci abita già" />
      <p className="no-print mb-3 text-[13px] text-grigio">Nome, età e corso di ogni coinquilino attuale.</p>
      <div className="flex flex-col gap-4">
        {coinq.map((i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_1fr] gap-4">
            <Campo label={i === 0 ? "Nome" : ""}><input className={U} /></Campo>
            <Campo label={i === 0 ? "Età" : ""}><input className={U} inputMode="numeric" /></Campo>
            <Campo label={i === 0 ? "Corso" : ""}><input className={U} /></Campo>
          </div>
        ))}
      </div>

      <Sez n="4" titolo="Contatti dell'host" />
      <p className="no-print mb-3 text-[13px] text-grigio">Chi cerca casa ti contatterà direttamente con questi recapiti.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo label="Nome referente"><input className={U} /></Campo>
        <Campo label="Telefono"><input className={U} placeholder="+39 ..." /></Campo>
        <Campo label="WhatsApp (se diverso)"><input className={U} placeholder="+39 ..." /></Campo>
        <Campo label="Email"><input className={U} placeholder="nome@email.it" /></Campo>
        <Campo label="Note (quando/come contattarti)" wide><input className={U} /></Campo>
      </div>

      <Sez n="5" titolo="Cosa c'è in casa" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {SERVIZI.map((s) => (
          <label key={s} className="flex items-center gap-2.5 text-[14px]">
            <input type="checkbox" className="h-4 w-4 accent-rosso" /> {s}
          </label>
        ))}
      </div>
      <div className="mt-5">
        <Campo label="Descrizione (com'è la casa, cosa cercate in un coinquilino)" wide>
          <textarea rows={4} className={`${U} resize-none`} />
        </Campo>
      </div>

      <div className="no-print mt-10 flex flex-wrap gap-3 border-t-2 border-inchiostro pt-6">
        <button
          onClick={() => window.print()}
          className="bg-rosso px-6 py-3.5 text-[15px] font-extrabold text-white transition hover:bg-rosso-scuro"
        >
          Scarica PDF
        </button>
        <span className="self-center text-[13px] text-grigio">
          Nella finestra di stampa scegli <b className="text-inchiostro">Salva come PDF</b>.
        </span>
      </div>

      <div className="hidden print:mt-8 print:block print:text-[11px] print:text-grigio">
        Scheda generata su SLEPBOLO — inviare il PDF compilato al gestore per la pubblicazione.
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 14mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function Sez({ n, titolo }: { n: string; titolo: string }) {
  return (
    <div className="mt-9 mb-5 flex items-center gap-3 break-inside-avoid">
      <span className="grid h-7 w-7 place-items-center bg-inchiostro text-[13px] font-black text-crema">{n}</span>
      <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">{titolo}</h2>
      <span className="h-[2px] flex-1 bg-linea" />
    </div>
  );
}

function Campo({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      {label && <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-grigio">{label}</span>}
      {children}
    </label>
  );
}
