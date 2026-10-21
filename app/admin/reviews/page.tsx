import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { studio } from "@/lib/config";
import { formatDuration } from "@/lib/format";
import { loadAll } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { feedbackFor } from "@/lib/review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reviews" };

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });
};

export default async function ReviewsPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const records = (await loadAll(true).catch(() => [])).filter((g) => g.settings.mode === "review");
  const rows = await Promise.all(records.map(async (g) => {
    const fb = await feedbackFor(g.id).catch(() => ({ notes: [], approvals: [] }));
    const files = g.items.filter((i) => i.kind !== "caption");
    const name = (id: string) => { const f = files.find((i) => i.id === id); return f ? f.title ?? f.name.replace(/\.[^.]+$/, "") : "File"; };
    return {
      g, files: files.length,
      open: fb.notes.filter((n) => !n.resolved),
      resolved: fb.notes.filter((n) => n.resolved).length,
      approved: new Set(fb.approvals.map((a) => a.fileId)).size,
      name,
    };
  }));
  const latest = rows
    .flatMap((r) => r.open.map((n) => ({ ...n, gallery: r.g, file: r.name(n.fileId) })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 25);
  const totalOpen = rows.reduce((n, r) => n + r.open.length, 0);
  const ready = rows.filter((r) => r.files > 0 && r.approved >= r.files).length;

  return (
    <AdminShell studio={studio} email={owner.email} demo={owner.demo}>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Client feedback on drafts</div>
          <h1 className="serif">Reviews</h1>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><b>{rows.length}</b><span>in review</span></div>
        <div className="stat"><b>{totalOpen}</b><span>open notes to address</span></div>
        <div className="stat"><b>{ready}</b><span>fully approved, ready to deliver</span></div>
      </div>

      {rows.length ? (
        <>
          <section className="page-sec">
            <h2>Galleries in review</h2>
            <div className="list-page">
              {rows.map((r) => {
                const cover = (r.g.cover ?? r.g.items.find((i) => i.kind === "photo") ?? r.g.items[0])?.thumb;
                const done = r.files > 0 && r.approved >= r.files;
                return (
                  <Link key={r.g.id} href={`/admin/g/${r.g.id}#review`} className="list-row">
                    {cover ? <img src={cover} alt="" /> : <span className="ph" />}
                    <span className="lr-main">
                      <span className="lr-title" style={{ display: "block" }}>{r.g.title}</span>
                      <span className="lr-sub">{r.g.settings.client ? `${r.g.settings.client} · ` : ""}{r.approved}/{r.files} approved · {r.open.length} open · {r.resolved} resolved</span>
                    </span>
                    <span className="lr-right">
                      {done ? <span className="tag review">Ready to deliver</span> : r.open.length ? <span className="tag review">{r.open.length} to address</span> : <span className="tag">Waiting on client</span>}
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
                  <a key={n.id} href={`/review/${n.gallery.slug}`} target="_blank" rel="noreferrer" className="list-row" style={{ alignItems: "flex-start" }}>
                    <span className="lr-main">
                      <span className="lr-sub" style={{ display: "block" }}>{n.gallery.title} · {n.file}{n.t !== undefined ? ` · ${formatDuration(n.t) || "0:00"}` : n.x !== undefined ? " · pin" : ""}</span>
                      <span style={{ display: "block", marginTop: 3 }}><b>{n.author}:</b> {n.text}</span>
                      <span className="lr-sub">{when(n.at)}{n.replies.length ? ` · ${n.replies.length} repl${n.replies.length === 1 ? "y" : "ies"}` : ""}</span>
                    </span>
                    <span className="lr-right"><span className="btn" style={{ height: 32 }}>Open ↗</span></span>
                  </a>
                ))}
              </div>
            ) : <p className="hint">No open notes. You&apos;re all caught up.</p>}
          </section>
        </>
      ) : (
        <div className="empty" style={{ padding: "50px 20px" }}>
          <div className="serif">No galleries in review</div>
          Open a gallery, go to its <b>Review</b> tab and click <b>Switch to review mode</b> to collect feedback on drafts.
        </div>
      )}
    </AdminShell>
  );
}
