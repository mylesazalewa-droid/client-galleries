import Link from "next/link";
import type { Studio } from "@/lib/types";

/** Markup's own workspace: light, with a left sidebar, separate from the galleries dashboard. */
export default function MarkupShell({ studio, email, demo, active, counts, folders = [], children }: {
  studio: Studio; email: string; demo: boolean; active: string; counts?: { projects: number; archived: number };
  folders?: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mk mk-app">
      <aside className="mk-nav">
        <Link href="/admin/reviews" className="mk-nav-brand">
          <span className="mk-logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z" /><path d="M14 7l3 3" /></svg>
          </span>
          <span><b>Markup</b><small>{studio.name}</small></span>
        </Link>
        <nav>
          <Link href="/admin/reviews" className={active === "projects" ? "on" : ""}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10l9-6 9 6v10H3z" /><path d="M9 20v-6h6v6" /></svg>
            Projects{counts ? <em>{counts.projects}</em> : null}
          </Link>
          {folders.map((f) => (
            <Link key={f.id} href={`/admin/reviews?folder=${f.id}`} className={`sub ${active === f.id ? "on" : ""}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></svg>
              {f.name}
            </Link>
          ))}
          <Link href="/admin/reviews?archived=1" className={active === "archive" ? "on" : ""}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18v4H3zM5 11v9h14v-9M10 15h4" /></svg>
            Archive{counts?.archived ? <em>{counts.archived}</em> : null}
          </Link>
        </nav>
        <div className="mk-nav-sep">Studio</div>
        <nav>
          <Link href="/admin"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>Galleries</Link>
          <Link href="/admin/payments"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>Payments</Link>
          <Link href="/admin/brands"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 3a14 14 0 0 1 0 18M3 12h18" /></svg>Client brands</Link>
          <Link href="/admin/brand"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>My branding</Link>
        </nav>
        <div className="mk-nav-foot">
          <span title={email}>{demo ? "Demo preview" : email}</span>
          <form action="/api/auth/logout" method="post"><button className="link-btn">Sign out</button></form>
        </div>
      </aside>
      <div className="mk-content">
        {demo && <div className="mk-banner">You&apos;re previewing with sample projects. Connect Google to create reviews for real.</div>}
        {children}
      </div>
    </div>
  );
}
