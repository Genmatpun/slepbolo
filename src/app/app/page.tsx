import { Archivo } from "next/font/google";
import { getAnnunci } from "@/lib/data";
import { camereLibere, prezzoDa } from "@/lib/types";
import { MobileApp, type MobileAnnuncio } from "@/components/mobile/mobile-app";

export const metadata = { title: "SLEPBOLO — app" };
export const dynamic = "force-dynamic";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const TERRACINI = { lat: 44.5215, lng: 11.3289 };

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371,
    dLa = ((b.lat - a.lat) * Math.PI) / 180,
    dLo = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.sin(dLo / 2) ** 2 * Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default async function AppPage() {
  const annunci = await getAnnunci();

  const data: MobileAnnuncio[] = annunci
    .map((a) => {
      const rooms = a.rooms.filter((r) => r.stato === "libera");
      const room = rooms[0];
      const lat = a.lat ?? 44.494,
        lng = a.lng ?? 11.342;
      return {
        id: a.id,
        titolo: a.titolo,
        zona: a.zona,
        via: a.via ?? "",
        lat,
        lng,
        tot: a.camere_totali,
        occ: a.camere_occupate,
        prezzo: prezzoDa(a),
        tipo: room?.tipo === "doppia" ? "Doppia" : "Singola",
        spese: room?.spese_incluse
          ? "spese incluse"
          : room?.spese_stimate
            ? `+${room.spese_stimate} € spese`
            : "spese escluse",
        speseIncl: !!room?.spese_incluse,
        min: room?.permanenza_minima_mesi ?? 6,
        contratto: (a.contratto_tipo ?? "").startsWith("Registrato")
          ? "Registrato"
          : a.contratto_tipo || "Da concordare",
        servizi: a.servizi,
        descrizione: a.descrizione ?? "",
        coinq: a.housemates.map((h) => ({ n: h.nome_visualizzato, e: h.eta, c: h.corso ?? "" })),
        contattoNome: a.contatto_nome ?? null,
        telefono: a.contatto_telefono ?? null,
        whatsapp: a.contatto_whatsapp ?? null,
        email: a.contatto_email ?? null,
        contattoNote: a.contatto_note ?? null,
        foto: a.foto_urls?.[0] ?? null,
        _lib: camereLibere(a),
      };
    })
    .filter((a) => a._lib > 0)
    .sort((x, y) => distKm(x, TERRACINI) - distKm(y, TERRACINI))
    .map(({ _lib, ...rest }) => rest);

  return (
    <div className={archivo.className}>
      <MobileApp annunci={data} />
    </div>
  );
}
