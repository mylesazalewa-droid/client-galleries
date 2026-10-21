"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Studio } from "@/lib/types";

const NAV = [
  { href: "/work", label: "Work" },
  { href: "/pricing", label: "Pricing" },
  { href: "/galleries", label: "Galleries" },
  { href: "/review", label: "Review" },
  { href: "/about", label: "About" },
];

export default function SiteHeader({ studio, overlay = false }: { studio: Studio; overlay?: boolean }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <header className={`site-head ${overlay ? "overlay" : ""} ${open ? "open" : ""}`}>
      <Link href="/" className="site-logo serif" aria-label={`${studio.name} home`}>
        {studio.logo ? <img src={studio.logo} alt={studio.name} /> : studio.name}
      </Link>
      <nav className="site-nav" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? "on" : ""} aria-current={path.startsWith(n.href) ? "page" : undefined}>{n.label}</Link>
        ))}
        <Link href="/contact" className="btn primary site-cta">Get a quote</Link>
      </nav>
      <button className="site-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span /><span />
      </button>
    </header>
  );
}
