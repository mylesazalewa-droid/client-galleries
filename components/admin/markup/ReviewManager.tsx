"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDuration, plural } from "@/lib/format";
import type { GallerySettings, MediaItem, Section } from "@/lib/types";
import { Film, Photo, Play } from "../../icons";
import CopyLink from "../CopyLink";
import { Uploader } from "../GalleryManager";

type P = { id: string; slug: string; title: string; settings: GallerySettings; hidden: boolean; items: MediaItem[]; sections: Section[]; group?: { id: string; name: string } };
type Folder = { id: string; name: string };
type Note = { id: string; fileId: string; author: string; text: string; t?: number; x?: number; resolved: boolean; owner: boolean; at: string; replies: { id: string; author: string; text: string; owner: boolean }[] };
type Feedback = { notes: Note[]; approvals: { fileId: string; author: string; at: string }[] };
type Tab = "drafts" | "feedback" | "settings";

async function api(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}
const nameOf = (i: MediaItem) => i.title ?? i.name.replace(/\.[^.]+$/, "");

/** Markup: one review project — versions of drafts, client notes, and its settings. Nothing here touches delivery galleries. */
export default function ReviewManager({ project, brands, folders, demo }: { project: P; brands: { id: string; name: string }[]; folders: Folder[]; demo: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(project);
  const [tab, setTab] = useState<Tab>("drafts");
  const [ver, setVer] = useState(project.sections.at(-1)?.id ?? "");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [toast, setToast] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmVer, setConfirmVer] = useState(false);
  const say = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 3200); }, []);
  const link = `/review/${p.slug}`;

  const loadFb = useCallback(() => {
    fetch(`/api/review/${p.slug}`, { cache: "no-store" }).then((r) => r.json()).then((r) => r.ok && setFb(r)).catch(() => {});
  }, [p.slug]);
  useEffect(() => { loadFb(); const t = setInterval(loadFb, 30000); return () => clearInterval(t); }, [loadFb]);
  useEffect(() => { const h = location.hash.slice(1) as Tab; if (["drafts", "feedback", "settings"].includes(h)) setTab(h); }, []);
  const pick = (t: Tab) => { setTab(t); history.replaceState(null, "", t === "drafts" ? location.pathname : `#${t}`); };

  async function refresh() {
    const res = await api("/api/admin/refresh", { method: "POST", body: JSON.stringify({ galleryId: p.id }) });
    if (res.ok) setP((cur) => ({ ...cur, items: res.items, sections: res.sections ?? cur.sections }));
  }

  async function newVersion() {
    const name = `Version ${p.sections.length + 1}`;
    const res = await api("/api/admin/sections", { method: "POST", body: JSON.stringify({ galleryId: p.id, name }) });
    if (!res.ok) return say(res.error || "Couldn't start a new version");
    setP((cur) => ({ ...cur, sections: [...cur.sections, res.section] }));
    setVer(res.section.id);
    say(`${name} started. Upload the new drafts below.`);
  }

  async function remove(item: MediaItem, quiet = false) {
    const res = await api(`/api/admin/files/${item.id}?g=${p.id}`, { method: "DELETE" });
    if (!res.ok) { say(res.error || "Couldn't delete"); return false; }
    setP((cur) => ({ ...cur, items: cur.items.filter((i) => i.id !== item.id) }));
    if (!quiet) say(`Deleted ${item.name} (it's in your Drive trash)`);
    return true;
  }

  async function removePicked() {
    const list = p.items.filter((i) => picked.has(i.id));
    let n = 0;
    for (const it of list) if (await remove(it, true)) n++;
    say(`Deleted ${n} draft${n === 1 ? "" : "s"} (they're in your Drive trash)`);
    setPicked(new Set()); setSelecting(false); setConfirmBulk(false);
  }

  async function removeVersion() {
    const sec = p.sections.find((s) => s.id === ver);
    if (!sec) return;
    const res = await api(`/api/admin/sections/${sec.id}?g=${p.id}`, { method: "DELETE" });
    setConfirmVer(false);
    if (!res.ok) return say(res.error || "Couldn't delete the version");
    const rest = p.sections.filter((s) => s.id !== sec.id);
    setP((cur) => ({ ...cur, sections: rest, items: cur.items.filter((i) => i.section !== sec.id) }));
    setVer(rest.at(-1)?.id ?? "");
    say(`Deleted ${sec.name} (it's in your Drive trash)`);
  }

  async function move(folderId: string) {
    const res = await api(`/api/admin/reviews/${p.id}/move`, { method: "POST", body: JSON.stringify({ folderId }) });
    if (!res.ok) return say(res.error || "Couldn't move");
    setP((cur) => ({ ...cur, group: folders.find((f) => f.id === folderId) }));
    say(folderId ? `Moved to ${folders.find((f) => f.id === folderId)?.name}` : "Moved out of the folder");
    router.refresh();
  }

  async function save(patch: Partial<GallerySettings> & { title?: string }) {
    const res = await api(`/api/admin/galleries/${p.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!res.ok) { say(res.error || "Couldn't save"); return false; }
    const { title, ...settings } = patch;
    setP((cur) => ({ ...cur, title: title ?? cur.title, slug: res.slug ?? cur.slug, settings: { ...cur.settings, ...settings }, hidden: settings.hidden ?? cur.hidden }));
    say("Saved");
    router.refresh();
    return true;
  }

  const files = p.items.filter((i) => i.kind !== "caption" && (!p.sections.length || i.section === ver));
  const verName = p.sections.find((s) => s.id === ver)?.name;
  const open = fb?.notes.filter((n) => !n.resolved) ?? [];
  const approved = new Set(fb?.approvals.map((a) => a.fileId));
  const latestFiles = p.items.filter((i) => i.kind !== "caption" && (!p.sections.length || i.section === p.sections.at(-1)?.id));
  const approvedLatest = latestFiles.filter((f) => approved.has(f.id)).length;

  const invite = [
    `Hi${p.settings.client ? ` ${p.settings.client}` : ""}! ${verName && p.sections.length > 1 ? `${verName} of` : "Drafts for"} "${p.title}" ${verName && p.sections.length > 1 ? "is" : "are"} ready for your review:`,
    typeof window !== "undefined" ? `${location.origin}${link}` : link,
    p.settings.password ? `Password: ${p.settings.password}` : "",
    "Pause the video anywhere and type a note — it's pinned to that exact moment. Click a photo to pin a note to a spot. Hit Approve on anything that's good to go.",
  ].filter(Boolean).join("\n");

  const STATUS: Record<string, string> = { progress: "In progress", changes: "Needs changes", approved: "Approved" };

  return (
    <>
      <div className="mk-toolbar">
        <div className="mk-crumbs inline">
          <a href="/admin/reviews">Projects</a>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
          {p.group && (
            <>
              <a href={`/admin/reviews?folder=${p.group.id}`}>{p.group.name}</a>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            </>
          )}
          <b>{p.title}</b>
          {p.settings.reviewStatus && <span className={`mk-chip s-${p.settings.reviewStatus}`}><span className="dot" />{STATUS[p.settings.reviewStatus]}</span>}
        </div>
        <div className="mk-toolbar-r">
          <a className="mk-btn ghost" href={`${link}?as=client`} target="_blank" rel="noreferrer">Client view</a>
          <CopyLink text={invite} label="Copy invite" className="mk-btn" />
          <CopyLink path={link} label="Copy link" className="mk-btn" />
          <Uploader compact galleryId={p.id} folderId={ver || undefined} targetName={p.sections.length > 1 ? verName : undefined} demo={demo} onDone={refresh} say={say} />
        </div>
      </div>

      <div className="mk-subbar">
        <div className="mk-tabs" role="tablist">
          {([["drafts", "Files"], ["feedback", "Comments"], ["settings", "Settings"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => pick(id)}>
              {label}
              {id === "drafts" && <em>{latestFiles.length}</em>}
              {id === "feedback" && open.length > 0 && <em className="hot">{open.length}</em>}
            </button>
          ))}
        </div>
        {tab === "drafts" && (
          <div className="mk-vers">
            {p.sections.map((s, i) => (
              <button key={s.id} className={`chip ${ver === s.id ? "on" : ""}`} onClick={() => setVer(s.id)}>
                {s.name.replace(/^Version /, "V")}{i === p.sections.length - 1 && p.sections.length > 1 ? " · latest" : ""}
              </button>
            ))}
            <button className="chip add" onClick={newVersion} disabled={demo} title="Start the next round of drafts">+ New version</button>
            <span className="mk-sub-sep" />
            {files.length > 0 && (selecting ? (
              <>
                <button className="chip" onClick={() => setPicked(picked.size === files.length ? new Set() : new Set(files.map((f) => f.id)))}>{picked.size === files.length ? "Select none" : "Select all"}</button>
                {confirmBulk
                  ? <button className="chip danger on" disabled={!picked.size || demo} onClick={removePicked}>Delete {picked.size}? Yes</button>
                  : <button className="chip danger" disabled={!picked.size} onClick={() => setConfirmBulk(true)}>Delete {picked.size || ""} selected</button>}
                <button className="chip" onClick={() => { setSelecting(false); setPicked(new Set()); setConfirmBulk(false); }}>Done</button>
              </>
            ) : <button className="chip" onClick={() => setSelecting(true)}>Select drafts</button>)}
            {p.sections.length > 1 && !selecting && (confirmVer
              ? <><button className="chip danger on" disabled={demo} onClick={removeVersion}>Delete {verName} and its drafts?</button><button className="chip" onClick={() => setConfirmVer(false)}>Keep</button></>
              : <button className="chip danger" onClick={() => setConfirmVer(true)}>Delete {verName?.replace(/^Version /, "V")}</button>)}
          </div>
        )}
      </div>

      {tab === "drafts" && (
        files.length ? (
          <div className="mk-cards">
            {files.map((item) => (
              <DraftCard
                selecting={selecting}
                picked={picked.has(item.id)}
                onPick={() => setPicked((cur) => { const n = new Set(cur); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                key={item.id}
                item={item}
                href={`${link}?f=${encodeURIComponent(item.id)}`}
                comments={fb?.notes.filter((n) => n.fileId === item.id).length ?? 0}
                open={fb?.notes.filter((n) => n.fileId === item.id && !n.resolved).length ?? 0}
                approved={approved.has(item.id)}
                onRemove={() => remove(item)}
              />
            ))}
          </div>
        ) : (
          <div className="mk-blank">
            <span className="mk-empty-ico" aria-hidden><svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg></span>
            <h2>Upload {verName ? `${verName.toLowerCase()} ` : ""}drafts</h2>
            <p>Click <b>Upload</b> or drop films and photos anywhere on this page.</p>
          </div>
        )
      )}

      {tab === "feedback" && (
        <div className="mk-pane">
          <div className="mk-stat-row">
            <div><b>{approvedLatest}<small>/{latestFiles.length}</small></b><span>approved</span></div>
            <div><b>{open.length}</b><span>open comments</span></div>
            <div><b>{fb ? fb.notes.length - open.length : 0}</b><span>resolved</span></div>
          </div>
          {fb === null ? <p className="hint">Loading…</p> : fb.notes.length ? (
            <ul className="mk-list">
              {[...fb.notes].sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.at.localeCompare(a.at)).map((n) => {
                const f = p.items.find((i) => i.id === n.fileId);
                const v = p.sections.find((s) => s.id === f?.section)?.name;
                return (
                  <li key={n.id} className={n.resolved ? "done" : ""}>
                    <a href={`${link}?f=${encodeURIComponent(n.fileId)}`}>
                      <span className="mk-list-meta">{[v, f ? nameOf(f) : "File", n.t !== undefined ? formatDuration(n.t) || "0:00" : "", n.resolved ? "Resolved" : ""].filter(Boolean).join(" · ")}</span>
                      <span><b>{n.author}</b> {n.text}</span>
                      {n.replies.length > 0 && <span className="mk-list-meta">{plural(n.replies.length, "reply", "replies")}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : <p className="hint">No comments yet. Send the link and they&apos;ll show up here.</p>}
        </div>
      )}

      {tab === "settings" && <div className="mk-pane narrow"><ReviewSettings p={p} brands={brands} folders={folders} onMove={move} demo={demo} onSave={save} say={say} onDeleted={() => { router.push("/admin/reviews"); router.refresh(); }} /></div>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function DraftCard({ item, href, comments, open, approved, onRemove, selecting, picked, onPick }: {
  item: MediaItem; href: string; comments: number; open: number; approved: boolean; onRemove: () => void;
  selecting: boolean; picked: boolean; onPick: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={`mk-card ${picked ? "picked" : ""}`}>
      {selecting && (
        <button className={`mk-check ${picked ? "on" : ""}`} onClick={onPick} aria-pressed={picked} aria-label={`Select ${item.name}`}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
        </button>
      )}
      {!selecting && (
        <button className={`mk-trash ${confirm ? "on" : ""}`} onClick={() => (confirm ? onRemove() : setConfirm(true))} onMouseLeave={() => setConfirm(false)} title="Delete draft" aria-label={`Delete ${item.name}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
          {confirm && <span>Delete?</span>}
        </button>
      )}
      <a href={selecting ? undefined : href} onClick={selecting ? (e) => { e.preventDefault(); onPick(); } : undefined} className="mk-card-art">
        <span className="mk-card-frame">
          {item.thumb ? <img src={item.thumb} alt="" loading="lazy" /> : <span className="mk-card-blank">{item.kind === "video" ? <Film /> : <Photo />}</span>}
          {item.kind === "video" && <span className="mk-card-play"><Play /></span>}
        </span>
      </a>
      <div className="mk-card-body">
        <a href={href}><b>{nameOf(item)}</b></a>
        <span className="mk-card-sub">{item.kind === "video" ? "Film" : "Photo"}{approved ? " · Approved" : ""}</span>
        <span className="mk-stats">
          <span title="Approved" className={approved ? "ok" : ""}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5 9-10" /></svg>{approved ? 1 : 0}</span>
          <span title="Comments" className={open ? "hot" : ""}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v11H9l-5 4z" /></svg>{comments}</span>
          {item.kind === "video" && item.duration ? <span title="Length"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h8l4 4v14H6z" /><path d="M10 11v6l5-3z" /></svg>{formatDuration(item.duration)}</span> : null}
        </span>
        <div className="mk-card-menu">
          <button className="mk-icon" aria-label="More" onClick={() => setMenu(!menu)}>
            <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
          </button>
          {menu && (
            <div className="mk-pop" onMouseLeave={() => setMenu(false)}>
              <a href={href}>Open</a>
              <a href={item.download} download={item.name}>Download original</a>
              <button className="danger" onClick={() => { setMenu(false); setConfirm(true); }}>Delete draft…</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewSettings({ p, brands, folders, onMove, demo, onSave, say, onDeleted }: {
  p: P; brands: { id: string; name: string }[]; folders: Folder[]; onMove: (folderId: string) => void; demo: boolean;
  onSave: (patch: Partial<GallerySettings> & { title?: string }) => Promise<boolean>; say: (t: string) => void; onDeleted: () => void;
}) {
  const [f, setF] = useState({
    title: p.title, client: p.settings.client ?? "", clientEmail: p.settings.clientEmail ?? "", password: p.settings.password ?? "",
    message: p.settings.message ?? "", brandId: p.settings.brandId ?? "", downloads: p.settings.downloads === true, expires: p.settings.expires ?? "", hidden: p.hidden,
  });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({ ...f, brandId: f.brandId || undefined });
    setBusy(false);
  }
  async function remove() {
    setBusy(true);
    const res = await api(`/api/admin/galleries/${p.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onDeleted(); else say(res.error || "Couldn't delete");
  }

  return (
    <>
      <form className="mk-panel" onSubmit={submit}>
        <h3>Review settings</h3>
        <label className="field"><span>Project name</span><input required value={f.title} onChange={set("title")} /></label>
        <label className="field"><span>Folder</span>
          <select value={p.group?.id ?? ""} onChange={(e) => onMove(e.target.value)} disabled={demo}>
            <option value="">No folder</option>
            {folders.map((fo) => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
          </select>
          <small className="hint">Moves right away. Folders keep a client&apos;s projects together.</small>
        </label>
        <div className="field-row">
          <label className="field"><span>Client</span><input value={f.client} onChange={set("client")} /></label>
          <label className="field"><span>Client email</span><input value={f.clientEmail} onChange={set("clientEmail")} inputMode="email" /></label>
        </div>
        <label className="field"><span>Brand</span>
          <select value={f.brandId} onChange={set("brandId")}>
            <option value="">Your studio</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name} (white label)</option>)}
          </select>
        </label>
        <div className="field-row">
          <label className="field"><span>Password</span><input value={f.password} onChange={set("password")} placeholder="None — anyone with the link" autoComplete="off" /></label>
          <label className="field"><span>Link closes on</span><input type="date" value={f.expires} onChange={set("expires")} /></label>
        </div>
        <label className="field"><span>Note to the client</span><textarea value={f.message} onChange={set("message")} /></label>
        <label className="check"><input type="checkbox" checked={f.downloads} onChange={set("downloads")} /> Let the client download drafts</label>
        <label className="check"><input type="checkbox" checked={f.hidden} onChange={set("hidden")} /> Archive (the review link stops working)</label>
        <p className="hint">Drafts are always watermarked with your brand&apos;s watermark.</p>
        <div className="actions"><button className="mk-btn primary" disabled={busy || demo}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
      <div className="mk-panel danger-zone">
        <h3>Delete review</h3>
        <p className="hint">Moves the project folder and its drafts to your Google Drive trash (restorable for 30 days).</p>
        {del
          ? <div className="actions" style={{ justifyContent: "flex-start" }}><button className="btn danger" disabled={busy || demo} onClick={remove}>Delete “{p.title}”</button><button className="btn" onClick={() => setDel(false)}>Cancel</button></div>
          : <button className="btn danger" onClick={() => setDel(true)}>Delete…</button>}
      </div>
    </>
  );
}
