import { redirect } from "next/navigation";

// La pubblicazione ora vive dentro l'app: questa pagina resta per i link vecchi.
// Dinamica, così il reindirizzamento è una vera risposta HTTP.
export const dynamic = "force-dynamic";

export default function PubblicaPage() {
  redirect("/app?pubblica=1");
}
