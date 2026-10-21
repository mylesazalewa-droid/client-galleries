"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Galleries", match: (p: string) => p === "/admin" || p.startsWith("/admin/g/") },
  { href: "/admin/reviews", label: "Reviews", match: (p: string) => p.startsWith("/admin/reviews") },
  { href: "/admin/payments", label: "Payments", match: (p: string) => p.startsWith("/admin/payments") },
  { href: "/admin/brands", label: "Client brands", match: (p: string) => p.startsWith("/admin/brands") },
  { href: "/admin/brand", label: "My branding", match: (p: string) => p === "/admin/brand" },
];

/** Main menu across the top of every dashboard page. */
export default function AdminNav() {
  const path = usePathname() ?? "";
  return (
    <nav className="admin-nav" aria-label="Dashboard">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.match(path) ? "on" : ""} aria-current={l.match(path) ? "page" : undefined}>{l.label}</Link>
      ))}
    </nav>
  );
}
