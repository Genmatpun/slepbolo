import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminForm } from "@/components/admin/admin-form";

export const metadata = { title: "Nuovo appartamento — Admin" };
export const dynamic = "force-dynamic";

export default async function NuovoPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin");

  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <Link href="/admin" className="text-[13px] font-bold text-grigio hover:text-inchiostro">
        ← Torna agli annunci
      </Link>
      <h1 className="mt-3 text-[32px]">Nuovo appartamento</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      <AdminForm />
    </div>
  );
}
