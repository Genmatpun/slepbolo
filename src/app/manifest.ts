import type { MetadataRoute } from "next";

/** Manifest PWA: rende SLEPBOLO installabile come app a schermo intero. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SLEPBOLO — Stanze e coinquilini a Bologna",
    short_name: "SLEPBOLO",
    description:
      "Trova stanze in appartamenti condivisi a Bologna e scopri chi ci abita già. Solo studenti, solo Bologna.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF3E7",
    theme_color: "#A2001D",
    lang: "it",
    categories: ["lifestyle", "education", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cerca stanza", url: "/cerca" },
      { name: "Pubblica annuncio", url: "/pubblica" },
    ],
  };
}
