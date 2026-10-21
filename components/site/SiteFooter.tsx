import Link from "next/link";
import type { Studio } from "@/lib/types";

export default function SiteFooter({ studio }: { studio: Studio }) {
  return (
    <footer className="site-foot">
      <div className="site-foot-cta">
        <h2 className="serif">Have a project in mind?</h2>
        <Link href="/contact" className="btn primary">Request a quote</Link>
      </div>
      <div className="site-foot-row">
        <span>© {new Date().getFullYear()} {studio.name} · Kalamazoo, Michigan</span>
        <nav>
          <Link href="/work">Work</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/galleries">Client galleries</Link>
          <Link href="/review">Review drafts</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <a href="/admin">Studio login</a>
        </nav>
      </div>
    </footer>
  );
}
