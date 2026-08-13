// Genera le icone PWA dal marchio SLEPBOLO (quadrato rosso, "SB", pallino arancio).
// Uso: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const ROSSO = "#A2001D";
const ARANCIO = "#E4572E";
const CREMA = "#FAF3E7";

/** SVG del marchio. full=true riempie tutto il canvas (icone maskable/apple). */
function svg(size, { full }) {
  const r = full ? 0 : Math.round(size * 0.22);
  const inset = full ? 0 : Math.round(size * 0.04);
  const box = size - inset * 2;
  const fontSize = Math.round(box * 0.42);
  const dot = Math.round(box * 0.3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="${inset}" y="${inset}" width="${box}" height="${box}" rx="${r}" fill="${ROSSO}"/>
    <circle cx="${inset + box * 0.82}" cy="${inset + box * 0.84}" r="${dot / 2}" fill="${ARANCIO}"/>
    <text x="${inset + box * 0.46}" y="${inset + box * 0.5}" fill="${CREMA}"
      font-family="Segoe UI, Helvetica, Arial, sans-serif" font-weight="800"
      font-size="${fontSize}" letter-spacing="-${fontSize * 0.04}"
      text-anchor="middle" dominant-baseline="central">SB</text>
  </svg>`;
}

async function png(size, opts, nome) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(`public/${nome}`);
  console.log("scritto", nome);
}

await mkdir("public", { recursive: true });
await png(192, { full: false }, "icon-192.png");
await png(512, { full: false }, "icon-512.png");
await png(512, { full: true }, "icon-maskable-512.png");
await png(180, { full: true }, "apple-touch-icon.png");
await png(32, { full: false }, "favicon-32.png");
console.log("Fatto.");
