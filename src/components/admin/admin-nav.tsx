"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/admin", label: "Appartamenti" },
  { href: "/admin/utenti", label: "Utenti registrati" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mb-6 flex gap-2">
      {VOCI.map((v) => {
        const on = v.href === "/admin" ? path === "/admin" : path.startsWith(v.href);
        return (
          <Link
            key={v.href}
            href={v.href}
            className={cn(
              "border-2 px-4 py-2 text-[13px] font-extrabold transition",
              on ? "border-inchiostro bg-inchiostro text-crema" : "border-linea text-grigio hover:border-grigio",
            )}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
