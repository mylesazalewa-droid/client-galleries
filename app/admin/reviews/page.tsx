import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import NewReview from "@/components/admin/markup/NewReview";
import { studio } from "@/lib/config";
import { formatDuration } from "@/lib/format";
import { loadReviews } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { feedbackFor } from "@/lib/review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Markup" };

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });
};

export default async function MarkupHome() {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const records = await loadReviews(true).catch(() => []);
  const rows = await Promise.all(records.map(async (g) => {
    const fb = await feedbackFor(g.id).catch(() => ({ notes: [], approvals: [] }));
    const latest = g.sections.filter((s) => g.items.some((i) => i.section === s.id)).at(-1);
    const files = g.items.filter((i) => i.kind !== "caption" && (!latest || i.section === latest.id));
    const name = (id: string) => { const f = g.items.find((i) => i.id === id); return f ? f.title ?? f.name.replace(/\.[^.]+$/, "") : "File"; };
    const approved = files.filter((f) => fb.approvals.some((a) => a.fileId === f.id)).length;
    return { g, files: files.length, version: latest?.name, open: fb.notes.filter((n) => !n.resolved), approved, name };
  }));
  const latest = rows
    .flatMap((r) => r.open.map((n) => ({ ...n, project: r.g, file: r.name(n.fileId) })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
  const totalOpen = rows.reduce((n, r) => n + r.open.length, 0);
  const ready = rows.filter((r) => r.files > 0 && r.approved >= r.files).length;

  return (
    <AdminShell studio={studio} email={owner.email} demo={owner.demo}>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Drafts & client feedback</div>
          <h1 className="serif">Markup</h1>
        </div>
        <div className="admin-head-actions"><NewReview demo={owner.demo} /></div>
      </div>

      <div className="stat-row">
        <div className="stat"><b>{rows.length}</b><span>review projects</span></div>
        <div className="stat"><b>{totalOpen}</b><span>open notes to address</span></div>
        <div className="stat"><b>{ready}</b><span>fully approved</span></div>
      </div>

      {rows.length ? (
        <>
          <section className="page-sec">
            <h2>Projects</h2>
            <div className="mk-grid">
              {rows.map((r) => {
                const cover = (r.g.items.filter((i) => i.kind !== "caption").at(-1) ?? r.g.items[0])?.thumb;
                const done = r.files > 0 && r.approved >= r.files;
                return (
                  <Link key={r.g.id} href={`/admin/reviews/${r.g.id}`} className="mk-card">
                    <span className="mk-img">
                      {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="mk-empty">No drafts yet</span>}
                      <span className="dash-tags">
                        {r.version && <span className="tag">{r.version}</span>}
                        {r.g.hidden && <span className="tag">Archived</span>}
                      </span>
                    </span>
                    <span className="mk-body">
                      <b>{r.g.title}</b>
                      <span className="lr-sub">{r.g.settings.client || "No client set"}</span>
                      <span className="mk-meta">
                        {done ? <span className="mk-ok">✓ All approved</span> : r.open.length ? <span className="mk-open">{r.open.length} open note{r.open.length === 1 ? "" : "s"}</span> : <span>Waiting on client</span>}
                        <span>{r.approved}/{r.files} approved</span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="page-sec">
            <h2>Latest open notes</h2>
            {latest.length ? (
              <div className="list-page">
                {latest.map((n) => (
                  <Link key={n.id} href={`/admin/reviews/${n.project.id}`} className="list-row" style={{ alignItems: "flex-start" }}>
                    <span className="lr-main">
                      <span className="lr-sub" style={{ display: "block" }}>{n.project.title} · {n.file}{n.t !== undefined ? ` · ${formatDuration(n.t) || "0:00"}` : n.x !== undefined ? " · pin" : ""}</span>
                      <span style={{ display: "block", marginTop: 3 }}><b>{n.author}:</b> {n.text}</span>
                      <span className="lr-sub">{when(n.at)}{n.replies.length ? ` · ${n.replies.length} repl${n.replies.length === 1 ? "y" : "ies"}` : ""}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : <p className="hint">No open notes. You&apos;re all caught up.</p>}
          </section>
        </>
      ) : (
        <div className="empty" style={{ padding: "50px 20px" }}>
          <div className="serif">No reviews yet</div>
          Start one with <b>+ New review</b>, upload a draft, and send your client the link. They leave notes right on the video.
        </div>
      )}
    </AdminShell>
  );
}
