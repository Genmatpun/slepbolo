import { redirect } from "next/navigation";

// La pubblicazione ora vive dentro l'app (/app), con il percorso a passi e
// "Incolla da WhatsApp". Questa pagina resta solo perché i link vecchi
// (e le mail già mandate) continuino a funzionare.
export const dynamic = "force-dynamic";

const ID_VALIDO = /^[0-9a-f-]{36}$/i;

export default async function ProponiPage({ searchParams }: { searchParams: Promise<{ modifica?: string }> }) {
  const { modifica } = await searchParams;
  redirect(modifica && ID_VALIDO.test(modifica) ? `/app?modifica=${modifica}` : "/app?pubblica=1");
}
