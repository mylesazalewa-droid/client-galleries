"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, plural } from "@/lib/format";
import { Lock, Photo } from "../icons";
import CopyLink from "./CopyLink";

export type DashGallery = {
  id: string;
  slug: string;
  title: string;
  client?: string;
  date?: string;
  locked: boolean;
  hidden: boolean;
  photos: number;
  videos: number;
  coverThumb?: string;
};

export default function Dashboard({ galleries, demo, loadError, rootMissing }: { galleries: DashGallery[]; demo: boolean; loadError: string; rootMissing: boolean }) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">{plural(galleries.length, "gallery", "galleries")}</div>
          <h1 className="serif">Client galleries</h1>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New gallery</button>
      </div>

      {loadError && <p className="error">{loadError}</p>}
      {rootMissing && (
        <div className="notice" style={{ marginTop: 0, marginBottom: 20 }}>
          A <b>CLIENTS</b> folder will be created in your Google Drive when you make your first gallery. Every gallery lives inside it, and the app can&apos;t see or touch anything else in your Drive.
        </div>
      )}

      {galleries.length ? (
        <div className="dash-grid">
          {galleries.map((g) => (
            <article key={g.id} className="dash-card">
              <Link href={`/admin/g/${g.id}`} className="dash-img">
                {g.coverThumb ? <img src={g.coverThumb} alt="" loading="lazy" /> : <span className="dash-empty"><Photo /> No media yet</span>}
                <span className="dash-tags">
                  {g.hidden && <span className="tag">Draft</span>}
                  {g.locked && <span className="tag"><Lock /> Password</span>}
                </span>
              </Link>
              <div className="dash-body">
                <Link href={`/admin/g/${g.id}`} className="serif dash-title">{g.title}</Link>
                <div className="dash-meta">
                  {[g.client, formatDate(g.date), [g.photos && plural(g.photos, "photo"), g.videos && plural(g.videos, "film")].filter(Boolean).join(", ") || "Empty"]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="dash-actions">
                  <Link href={`/admin/g/${g.id}`} className="btn">Manage</Link>
                  <CopyLink path={`/g/${g.slug}`} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !loadError && (
          <div className="empty">
            <div className="serif">No galleries yet</div>
            Create one, drop in your photos and films, and send the client their private link.
          </div>
        )
      )}

      {creating && <NewGallery demo={demo} onClose={() => setCreating(false)} />}
    </>
  );
}

function NewGallery({ demo, onClose }: { demo: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ title: "", client: "", date: new Date().toISOString().slice(0, 10), password: "", message: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/galleries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
    if (res.ok) router.push(`/admin/g/${res.id}`);
    else { setBusy(false); setErr(res.error || "Something went wrong."); }
  }

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-title">
        <h2 id="new-title" className="serif">New gallery</h2>
        <p className="sub">You&apos;ll add photos and films on the next screen.</p>
        <label className="field"><span>Gallery name</span>
          <input required autoFocus value={f.title} onChange={set("title")} placeholder="Lakeshore CU — Brand Film" />
        </label>
        <div className="field-row">
          <label className="field"><span>Client</span>
            <input value={f.client} onChange={set("client")} placeholder="Lakeshore Credit Union" />
          </label>
          <label className="field"><span>Date</span>
            <input type="date" value={f.date} onChange={set("date")} />
          </label>
        </div>
        <label className="field"><span>Password (optional)</span>
          <input value={f.password} onChange={set("password")} placeholder="Leave blank for link-only access" autoComplete="off" />
        </label>
        <label className="field"><span>Welcome message (optional)</span>
          <textarea value={f.message} onChange={set("message")} placeholder="Final cuts and stills from the shoot. Heart your favorites and send your picks." />
        </label>
        {demo && <p className="error">Demo mode — connect Google to create galleries.</p>}
        {err && <p className="error" role="alert">{err}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || demo}>{busy ? "Creating…" : "Create gallery"}</button>
        </div>
      </form>
    </div>
  );
}
