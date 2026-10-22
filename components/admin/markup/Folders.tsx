"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

async function api(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></svg>
);

/** "New folder" button: one folder per client keeps several projects together. */
export function NewFolder({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await api("/api/admin/reviews/folders", { method: "POST", body: JSON.stringify({ name }) });
    setBusy(false);
    if (!res.ok) return setErr(res.error || "Couldn't create the folder");
    setOpen(false); setName("");
    router.push(`/admin/reviews?folder=${res.id}`);
    router.refresh();
  }
  return (
    <>
      <button className="mk-btn" onClick={() => setOpen(true)}><FolderIcon /> New folder</button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form className="dialog" onSubmit={submit}>
            <h2 className="serif">New folder</h2>
            <p className="sub">Group a client&apos;s projects together, like every upload for one brand or event.</p>
            <label className="field"><span>Folder name</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harbor Health" maxLength={80} /></label>
            {demo && <p className="error">Demo mode — connect Google to create folders.</p>}
            {err && <p className="error">{err}</p>}
            <div className="actions">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || demo}>{busy ? "Creating…" : "Create folder"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** A folder tile on the Markup home, with rename and delete. */
export function FolderCard({ id, name, count, open, covers, demo }: { id: string; name: string; count: number; open: number; covers: string[]; demo: boolean }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    const res = await api(`/api/admin/reviews/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name: draft }) });
    if (!res.ok) return setErr(res.error || "Couldn't rename");
    setRenaming(false); router.refresh();
  }
  async function remove() {
    setMenu(false);
    const res = await api(`/api/admin/reviews/folders/${id}`, { method: "DELETE" });
    if (!res.ok) return setErr(res.error || "Couldn't delete");
    router.refresh();
  }

  return (
    <div className="mk-card mk-folder">
      <Link href={`/admin/reviews?folder=${id}`} className="mk-card-art folder">
        <span className="mk-folder-art">
          {covers.slice(0, 3).map((c, i) => <img key={i} src={c} alt="" loading="lazy" style={{ "--i": i } as React.CSSProperties} />)}
          {!covers.length && <span className="mk-folder-empty"><FolderIcon /></span>}
        </span>
      </Link>
      <div className="mk-card-body">
        {renaming ? (
          <form onSubmit={rename} className="mk-rename">
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} />
            <button className="mk-btn primary sm">Save</button>
            <button type="button" className="mk-btn ghost sm" onClick={() => { setRenaming(false); setDraft(name); }}>Cancel</button>
          </form>
        ) : (
          <Link href={`/admin/reviews?folder=${id}`}><b><span className="mk-folder-ico"><FolderIcon /></span>{name}</b></Link>
        )}
        <span className="mk-card-sub">{count} project{count === 1 ? "" : "s"}{open ? ` · ${open} open comment${open === 1 ? "" : "s"}` : ""}</span>
        {err && <span className="error" style={{ margin: "4px 0 0" }}>{err}</span>}
        <div className="mk-card-menu">
          <button className="mk-icon" aria-label="Folder options" onClick={() => setMenu(!menu)}>
            <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
          </button>
          {menu && (
            <div className="mk-pop" onMouseLeave={() => setMenu(false)}>
              <Link href={`/admin/reviews?folder=${id}`}>Open</Link>
              <button disabled={demo} onClick={() => { setMenu(false); setRenaming(true); }}>Rename</button>
              <button className="danger" disabled={demo} onClick={remove} title={count ? "Move or delete its projects first" : undefined}>Delete folder</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
