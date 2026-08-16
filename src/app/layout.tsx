import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SLEPBOLO — Trova il tuo coinquilino a Bologna",
  description:
    "Stanze in appartamenti condivisi da 3 mesi a un anno, pubblicate da chi ci abita già. Solo studenti, solo Bologna.",
  applicationName: "SLEPBOLO",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SLEPBOLO",
  },
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#A2001D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
