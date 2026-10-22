"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDuration, plural } from "@/lib/format";
import type { GallerySettings, MediaItem, Section } from "@/lib/types";
import { Film, Photo, Play } from "../../icons";
import CopyLink from "../CopyLink";
import { Uploader } from "../GalleryManager";

type P = { id: string; slug: string; title: string; settings: GallerySettings; hidden: boolean; items: MediaItem[]; sections: Section[] };
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
export default function ReviewManager({ project, brands, demo }: { project: P; brands: { id: string; name: string }[]; demo: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(project);
  const [tab, setTab] = useState<Tab>("drafts");
  const [ver, setVer] = useState(project.sections.at(-1)?.id ?? "");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [toast, setToast] = useState("");
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

  async function remove(item: MediaItem) {
    const res = await api(`/api/admin/files/${item.id}?g=${p.id}`, { method: "DELETE" });
    if (!res.ok) return say(res.error || "Couldn't remove");
    setP((cur) => ({ ...cur, items: cur.items.filter((i) => i.id !== item.id) }));
    say(`Removed ${item.name}`);
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

  return (
    <div className="mgr">
      <section className="mgr-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Markup · {[p.settings.client, p.sections.at(-1)?.name, p.hidden && "Archived"].filter(Boolean).join(" · ") || "Review project"}</div>
          <h1 className="serif">{p.title}</h1>
        </div>
        <div className="mgr-share">
          <a className="btn" href={`${link}?as=client`} target="_blank" rel="noreferrer">View as client ↗</a>
          <a className="btn" href={link} target="_blank" rel="noreferrer">Open & reply ↗</a>
          <CopyLink path={link} label="Copy review link" />
          <CopyLink text={invite} label="Copy invite" className="btn primary" />
        </div>
      </section>

      <nav className="mgr-tabs" role="tablist">
        {([["drafts", "Drafts"], ["feedback", "Feedback"], ["settings", "Settings"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => pick(id)}>
            {label}
            {id === "drafts" && <span className="count">{latestFiles.length}</span>}
            {id === "feedback" && open.length > 0 && <span className="count">{open.length}</span>}
          </button>
        ))}
      </nav>

      {tab === "drafts" && (
        <div className="mgr-tab-body wide">
          <div className="mk-vers">
            {p.sections.map((s, i) => (
              <button key={s.id} className={`chip ${ver === s.id ? "on" : ""}`} onClick={() => setVer(s.id)}>
                {s.name}{i === p.sections.length - 1 ? " · latest" : ""}
              </button>
            ))}
            <button className="chip add" onClick={newVersion} disabled={demo}>+ New version</button>
          </div>
          <Uploader galleryId={p.id} folderId={ver || undefined} targetName={verName} demo={demo} onDone={refresh} say={say} />
          {files.length ? (
            <div className="mgr-grid">
              {files.map((item) => <DraftThumb key={item.id} item={item} notes={fb?.notes.filter((n) => n.fileId === item.id && !n.resolved).length ?? 0} approved={approved.has(item.id)} onRemove={() => remove(item)} />)}
            </div>
          ) : (
            <div className="empty" style={{ padding: "40px 20px" }}>
              <div className="serif">No drafts in {verName ?? "this project"} yet</div>
              Drop films and photos above. Clients only see the newest version unless they switch.
            </div>
          )}
        </div>
      )}

      {tab === "feedback" && (
        <div className="mgr-tab-body">
          <div className="panel">
            <div className="rv-stats">
              <span><b>{approvedLatest}</b>/{latestFiles.length} approved</span>
              <span><b>{open.length}</b> open</span>
              <span><b>{fb ? fb.notes.length - open.length : 0}</b> resolved</span>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>To reply or resolve, use <a href={link} target="_blank" rel="noreferrer">Open &amp; reply</a>. Your replies are labeled Studio.</p>
            {fb === null ? <p className="hint">Loading…</p> : fb.notes.length ? (
              <ul className="rv-mini">
                {[...fb.notes].sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.at.localeCompare(a.at)).map((n) => {
                  const f = p.items.find((i) => i.id === n.fileId);
                  const v = p.sections.find((s) => s.id === f?.section)?.name;
                  return (
                    <li key={n.id} style={{ opacity: n.resolved ? 0.55 : 1 }}>
                      <span className="rv-mini-file">{[v, f ? nameOf(f) : "File", n.t !== undefined ? formatDuration(n.t) || "0:00" : n.x !== undefined ? "pin" : "", n.resolved ? "resolved" : ""].filter(Boolean).join(" · ")}</span>
                      <span><b>{n.author}:</b> {n.text}</span>
                      {n.replies.length > 0 && <span className="rv-mini-file">{plural(n.replies.length, "reply", "replies")}</span>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="hint">No notes yet. Send the review link and they&apos;ll show up here.</p>}
          </div>
        </div>
      )}

      {tab === "settings" && <div className="mgr-tab-body"><ReviewSettings p={p} brands={brands} demo={demo} onSave={save} say={say} onDeleted={() => { router.push("/admin/reviews"); router.refresh(); }} /></div>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function DraftThumb({ item, notes, approved, onRemove }: { item: MediaItem; notes: number; approved: boolean; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <figure className="mthumb">
      <div className="mthumb-img">
        {item.thumb ? <img src={item.thumb} alt="" loading="lazy" /> : item.kind === "video" ? <Film /> : <Photo />}
        {item.kind === "video" && <span className="mthumb-play"><Play />{item.duration ? formatDuration(item.duration) : ""}</span>}
        <span className="dash-tags" style={{ position: "absolute", top: 8, left: 8 }}>
          {approved && <span className="tag" style={{ color: "#3fa66b" }}>✓ Approved</span>}
          {notes > 0 && <span className="tag review">{notes} open</span>}
        </span>
      </div>
      <figcaption>
        <span className="mthumb-name" title={item.name}>{item.name}</span>
        <span className="mthumb-actions">
          {confirm
            ? <><button className="link-btn danger" onClick={onRemove}>Remove?</button><button className="link-btn" onClick={() => setConfirm(false)}>Keep</button></>
            : <button className="link-btn" onClick={() => setConfirm(true)}>Remove</button>}
        </span>
      </figcaption>
    </figure>
  );
}

function ReviewSettings({ p, brands, demo, onSave, say, onDeleted }: {
  p: P; brands: { id: string; name: string }[]; demo: boolean;
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
      <form className="panel" onSubmit={submit}>
        <h3>Review settings</h3>
        <label className="field"><span>Project name</span><input required value={f.title} onChange={set("title")} /></label>
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
        <div className="actions"><button className="btn primary" disabled={busy || demo}>{busy ? "Saving…" : "Save"}</button></div>
      </form>
      <div className="panel danger-zone">
        <h3>Delete review</h3>
        <p className="hint">Moves the project folder and its drafts to your Google Drive trash (restorable for 30 days).</p>
        {del
          ? <div className="actions" style={{ justifyContent: "flex-start" }}><button className="btn danger" disabled={busy || demo} onClick={remove}>Delete “{p.title}”</button><button className="btn" onClick={() => setDel(false)}>Cancel</button></div>
          : <button className="btn danger" onClick={() => setDel(true)}>Delete…</button>}
      </div>
    </>
  );
}
