import Link from "next/link";
import type { Studio } from "@/lib/types";
import ThemeToggle from "../ThemeToggle";
import { Left } from "../icons";

export default function AdminShell({ studio, email, demo, back, children }: { studio: Studio; email: string; demo: boolean; back?: boolean; children: React.ReactNode }) {
  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-brand">
          {back ? (
            <Link href="/admin" className="icon-btn" aria-label="All galleries"><Left /></Link>
          ) : null}
          <Link href="/admin" className="serif brand">{studio.name}</Link>
          <span className="pill">Dashboard</span>
        </div>
        <div className="admin-user">
          <span className="who">{demo ? "Demo preview" : email}</span>
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button className="btn" style={{ height: 34 }}>Sign out</button>
          </form>
        </div>
      </header>
      {demo && (
        <div className="admin-banner">
          You&apos;re previewing the dashboard with sample galleries. Connect Google to create galleries and upload for real.
        </div>
      )}
      <main className="admin-main">{children}</main>
    </div>
  );
}
