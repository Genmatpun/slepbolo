import { redirect } from "next/navigation";

// Aprendo il sito si entra direttamente nell'app (login UniBo + ricerca stanze).
export default function Home() {
  redirect("/app");
}
