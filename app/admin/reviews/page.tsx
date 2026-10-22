import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MarkupShell from "@/components/admin/markup/MarkupShell";
import NewReview from "@/components/admin/markup/NewReview";
import { FolderCard, NewFolder } from "@/components/admin/markup/Folders";
import { studio } from "@/lib/config";
import { loadReviewTree } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { feedbackFor } from "@/lib/review";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Markup" };

const STATUS: Record<string, string> = { progress: "In progress", changes: "Needs changes", approved: "Approved" };

function ago(iso?: string) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return "";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} minutes ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function MarkupHome({ searchParams }: { searchParams: Promise<{ archived?: string; q?: string; folder?: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const { archived, q, folder } = await searchParams;
  const tree = await loadReviewTree(true).catch(() => ({ projects: [], folders: [], box: null }));
  const all = tree.projects;
  const current = folder ? tree.folders.find((f) => f.id === folder) : undefined;
  // Top level shows folders plus loose projects; inside a folder, just its projects; search and archive look everywhere.
  const flat = !!(q || archived);
  const shown = all
    .filter((g) => (archived ? g.hidden : !g.hidden))
    .filter((g) => flat || (current ? g.group?.id === current.id : !g.group))
    .filter((g) => !q || `${g.title} ${g.settings.client ?? ""} ${g.group?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const folderCards = flat || current ? [] : await Promise.all(tree.folders.map(async (fo) => {
    const inside = all.filter((g) => g.group?.id === fo.id && !g.hidden);
    const opens = await Promise.all(inside.map((g) => feedbackFor(g.id).then((f) => f.notes.filter((n) => !n.resolved).length).catch(() => 0)));
    const covers = inside.map((g) => (g.items.find((i) => i.kind === "video") ?? g.items[0])?.thumb).filter((x): x is string => !!x);
    return { ...fo, count: inside.length, open: opens.reduce((a, b) => a + b, 0), covers };
  }));
  const cards = await Promise.all(shown.map(async (g) => {
    const fb = await feedbackFor(g.id).catch(() => ({ notes: [], approvals: [] }));
    const latest = g.sections.filter((s) => g.items.some((i) => i.section === s.id)).at(-1);
    const files = g.items.filter((i) => i.kind !== "caption" && (!latest || i.section === latest.id));
    const approved = files.filter((f) => fb.approvals.some((a) => a.fileId === f.id)).length;
    const lastAt = [...fb.notes.map((n) => n.at), ...fb.approvals.map((a) => a.at)].sort().at(-1);
    const cover = files.find((i) => i.kind === "video") ?? files[0];
    return { g, files, approved, comments: fb.notes.length, open: fb.notes.filter((n) => !n.resolved).length, version: latest?.name, updated: lastAt ?? (g.settings.date ? `${g.settings.date}T12:00:00` : undefined), cover };
  }));

  return (
    <MarkupShell studio={studio} email={owner.email} demo={owner.demo} active={archived ? "archive" : current ? current.id : "projects"} folders={tree.folders} counts={{ projects: all.filter((g) => !g.hidden).length, archived: all.filter((g) => g.hidden).length }}>
      <div className="mk-toolbar">
        <form className="mk-search" action="/admin/reviews">
          {archived && <input type="hidden" name="archived" value="1" />}
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input name="q" defaultValue={q} placeholder="Search projects and folders" />
        </form>
        <div className="mk-toolbar-r">
          {!current && <NewFolder demo={owner.demo} />}
          <NewReview demo={owner.demo} folders={tree.folders} folderId={current?.id} />
        </div>
      </div>
      <div className="mk-crumbs">
        {current ? (
          <>
            <Link href="/admin/reviews">Projects</Link>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            <b>{current.name}</b>
          </>
        ) : <span>{archived ? "Archive" : q ? `Results for “${q}”` : "Projects"}</span>}
      </div>

      {cards.length || folderCards.length ? (
        <div className="mk-cards">
          {folderCards.map((fo) => <FolderCard key={fo.id} id={fo.id} name={fo.name} count={fo.count} open={fo.open} covers={fo.covers} demo={owner.demo} />)}
          {cards.map((c) => (
            <Link key={c.g.id} href={`/admin/reviews/${c.g.id}`} className="mk-card">
              <span className="mk-card-art">
                <span className="mk-card-frame">
                  {c.cover?.thumb ? <img src={c.cover.thumb} alt="" loading="lazy" /> : <span className="mk-card-blank" />}
                  {c.files.length > 1 && <span className="mk-stack" aria-hidden />}
                </span>
                {c.g.settings.reviewStatus && <span className={`mk-chip s-${c.g.settings.reviewStatus}`}><span className="dot" />{STATUS[c.g.settings.reviewStatus]}</span>}
              </span>
              <span className="mk-card-body">
                <b>{c.g.title}</b>
                <span className="mk-card-sub">{flat && c.g.group ? `${c.g.group.name} · ` : ""}{c.updated ? `Updated ${ago(c.updated)}` : "No activity yet"}{c.version ? ` · ${c.version}` : ""}</span>
                <span className="mk-stats">
                  <span title="Approved"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5 9-10" /></svg>{c.approved}</span>
                  <span title="Comments" className={c.open ? "hot" : ""}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v11H9l-5 4z" /></svg>{c.comments}</span>
                  <span title="Files"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>{c.files.length}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mk-blank">
          <span className="mk-empty-ico" aria-hidden><svg viewBox="0 0 48 40" width="72" height="60"><rect x="6" y="4" width="36" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 28l4 6 4-6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 12h18M12 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
          <h2>{q ? "No matching projects" : archived ? "Nothing archived" : current ? "This folder is empty" : "No reviews yet"}</h2>
          <p>{archived || q ? "" : current ? "Create a review here, or move a project in from its Settings." : "Create a folder for each client, then add a review, upload a draft and send the link."}</p>
        </div>
      )}
    </MarkupShell>
  );
}
