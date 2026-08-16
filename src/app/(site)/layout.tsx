import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PwaInstall } from "@/components/pwa-install";

/** Layout del sito web (con header/footer). L'app mobile /app ne è fuori. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <PwaInstall />
    </>
  );
}
