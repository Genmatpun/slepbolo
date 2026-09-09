import type { NextConfig } from "next";

/** Origine Supabase: serve alla CSP per lasciar passare login e query. */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Header applicati a tutto il sito. Nessuno di questi rompe funzionalità. */
const baseHeaders = [
  // Il browser non "indovina" il tipo di un file: blocca i trucchi in cui
  // un upload viene servito come se fosse JavaScript.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Verso siti esterni parte solo il dominio, mai il percorso completo:
  // un link da /admin/credenziali non racconta in giro dove sei stato.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Niente fotocamera e microfono: non servono, e toglierli chiude la porta.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
];

/**
 * Regola aggiuntiva per l'area admin: è la pagina che mostra le password,
 * e non carica nulla da fuori. `connect-src` limitato a se stessa e a
 * Supabase è la riga che conta: se anche uno script riuscisse a infilarsi,
 * non avrebbe dove spedire quello che legge. `frame-ancestors none` impedisce
 * di incorniciare la pagina in un sito civetta per rubare la password.
 */
const cspAdmin = [
  "default-src 'self'",
  // 'unsafe-inline' è inevitabile: Next inserisce script inline per
  // trasmettere i dati della pagina. Non indebolisce connect-src.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      {
        // Solo qui: il resto del sito carica mappe e tile da domini esterni,
        // e una CSP stretta li spegnerebbe.
        source: "/admin/:path*",
        headers: [
          ...baseHeaders,
          { key: "Content-Security-Policy", value: cspAdmin },
          // L'area riservata non finisce nella cache di nessun intermediario.
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
