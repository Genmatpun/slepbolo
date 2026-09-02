import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { AdminForm } from "@/components/admin/admin-form";
import type { Annuncio } from "@/lib/types";

export const metadata = { title: "Modifica appartamento — Admin" };
export const dynamic = "force-dynamic";

export default async function ModificaPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("apartments")
    .select("*, rooms(*), housemates(*)")
    .eq("id", id)
    .single();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-6">
      <Link href="/admin" className="text-[13px] font-bold text-grigio hover:text-inchiostro">
        ← Torna agli annunci
      </Link>
      <h1 className="mt-3 text-[32px]">Modifica appartamento</h1>
      <div className="mt-2 mb-8 h-[2px] w-full bg-inchiostro" />
      <AdminForm initial={data as Annuncio} />
    </div>
  );
}
