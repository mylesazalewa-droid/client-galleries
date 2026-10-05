"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration, plural } from "@/lib/format";
import type { GallerySettings, MediaItem } from "@/lib/types";
import { Check, Close, Download, Play } from "../icons";
import CopyLink from "./CopyLink";

type G = {
  id: string;
  slug: string;
  title: string;
  settings: GallerySettings;
  hidden: boolean;
  items: MediaItem[];
  cover: MediaItem | null;
};

type Job = { key: string; name: string; size: number; progress: number; state: "waiting" | "uploading" | "done" | "error"; error?: string };

const CONCURRENCY = 3;

async function api(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}

export default function GalleryManager({ gallery, demo }: { gallery: G; demo: boolean }) {
  const router = useRouter();
  const [g, setG] = useState(gallery);
  const [toast, setToast] = useState("");
  const say = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 3200); }, []);

  const media = [...(g.cover && !g.items.some((i) => i.id === g.cover!.id) ? [g.cover] : []), ...g.items];
  const coverId = g.cover?.id ?? g.items.find((i) => i.kind === "photo")?.id;
  const link = `/g/${g.slug}`;

  async function refresh() {
    const res = await api("/api/admin/refresh", { method: "POST", body: JSON.stringify({ galleryId: g.id }) });
    if (res.ok) setG((cur) => ({ ...cur, items: res.items, cover: res.cover }));
  }

  async function save(patch: Partial<GallerySettings> & { title?: string }, msg = "Saved") {
    const res = await api(`/api/admin/galleries/${g.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!res.ok) { say(res.error || "Couldn't save"); return false; }
    const { title, ...settings } = patch;
    setG((cur) => ({
      ...cur,
      title: title ?? cur.title,
      slug: res.slug ?? cur.slug,
      settings: { ...cur.settings, ...settings },
      hidden: settings.hidden ?? cur.hidden,
    }));
    say(msg);
    if ("cover" in patch) refresh();
    router.refresh();
    return true;
  }

  async function rename(item: MediaItem, name: string) {
    const res = await api(`/api/admin/files/${item.id}?g=${g.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    if (!res.ok) { say(res.error || "Couldn't rename"); return false; }
    const swap = (i: MediaItem) => (i.id === item.id ? { ...i, name: res.name } : i);
    setG((cur) => ({
      ...cur,
      items: cur.items.map(swap),
      cover: cur.cover ? swap(cur.cover) : cur.cover,
      settings: cur.settings.cover === item.name ? { ...cur.settings, cover: res.name } : cur.settings,
    }));
    say("Renamed");
    return true;
  }

  async function remove(item: MediaItem) {
    const res = await api(`/api/admin/files/${item.id}?g=${g.id}`, { method: "DELETE" });
    if (!res.ok) return say(res.error || "Couldn't remove");
    setG((cur) => ({ ...cur, items: cur.items.filter((i) => i.id !== item.id), cover: cur.cover?.id === item.id ? null : cur.cover }));
    say(`Removed ${item.name}`);
  }

  const invite = [
    `Hi${g.settings.client ? ` ${g.settings.client}` : ""}! Your gallery "${g.title}" is ready:`,
    typeof window !== "undefined" ? `${location.origin}${link}` : link,
    g.settings.password ? `Password: ${g.settings.password}` : "",
    "Tap the heart on anything you love and hit “Send picks” when you're done.",
  ].filter(Boolean).join("\n");

  return (
    <div className="mgr">
      <section className="mgr-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">
            {g.hidden ? "Draft — only you can see it" : "Published"} · {plural(g.items.length, "item")}
          </div>
          <h1 className="serif">{g.title}</h1>
        </div>
        <div className="mgr-share">
          <a className="btn" href={link} target="_blank" rel="noreferrer">View as client ↗</a>
          <CopyLink path={link} />
          <CopyLink text={invite} label="Copy invite" className="btn primary" />
        </div>
      </section>

      <div className="mgr-cols">
        <div className="mgr-main">
          <Uploader galleryId={g.id} demo={demo} onDone={refresh} say={say} />

          {media.length ? (
            <div className="mgr-grid">
              {media.map((item) => (
                <Thumb
                  key={item.id}
                  item={item}
                  isCover={item.id === coverId}
                  onCover={() => save({ cover: item.name }, "Cover updated")}
                  onRemove={() => remove(item)}
                  onRename={(name) => rename(item, name)}
                />
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: "50px 20px" }}>
              <div className="serif">Nothing here yet</div>
              Drop photos and films above. They upload straight into this gallery&apos;s folder in your Drive.
            </div>
          )}
        </div>

        <aside className="mgr-side">
          <Settings g={g} onSave={save} />
          <Danger g={g} demo={demo} say={say} onDeleted={() => { router.push("/admin"); router.refresh(); }} />
        </aside>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ uploader

function Uploader({ galleryId, demo, onDone, say }: { galleryId: string; demo: boolean; onDone: () => Promise<void> | void; say: (t: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const files = useRef(new Map<string, File>());
  const running = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const runOne = useCallback(async (job: Job) => {
    const file = files.current.get(job.key)!;
    update(job.key, { state: "uploading", progress: 0 });
    const start = await api("/api/admin/upload", {
      method: "POST",
      body: JSON.stringify({ galleryId, name: file.name, type: file.type, size: file.size }),
    });
    if (!start.ok) return update(job.key, { state: "error", error: start.error });

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", start.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => e.lengthComputable && update(job.key, { progress: e.loaded / e.total });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) update(job.key, { state: "done", progress: 1 });
        else update(job.key, { state: "error", error: `Upload failed (${xhr.status})` });
        resolve();
      };
      xhr.onerror = () => { update(job.key, { state: "error", error: "Network error — try again" }); resolve(); };
      xhr.send(file);
    });
    files.current.delete(job.key);
  }, [galleryId]);

  // simple queue: keep up to CONCURRENCY uploads going
  useEffect(() => {
    const waiting = jobs.filter((j) => j.state === "waiting");
    const active = jobs.filter((j) => j.state === "uploading").length;
    if (!waiting.length && !active && jobs.length && running.current === 0 && jobs.some((j) => j.state === "done")) {
      const ok = jobs.filter((j) => j.state === "done").length;
      const failed = jobs.filter((j) => j.state === "error").length;
      say(`${plural(ok, "file")} uploaded${failed ? `, ${failed} failed` : ""}. Drive is making previews…`);
      // Drive takes a moment to generate thumbnails; refresh now and again shortly.
      onDone();
      setTimeout(onDone, 6000);
      setJobs((js) => js.filter((j) => j.state === "error"));
      return;
    }
    for (const job of waiting.slice(0, Math.max(0, CONCURRENCY - active))) {
      running.current++;
      runOne(job).finally(() => { running.current--; setJobs((js) => [...js]); });
    }
  }, [jobs, runOne, onDone, say]);

  function add(list: FileList | null) {
    if (!list?.length) return;
    if (demo) return say("Demo mode — connect Google to upload.");
    const next: Job[] = [];
    for (const f of Array.from(list)) {
      if (!/^(image|video)\//.test(f.type)) { say(`${f.name} isn't a photo or video`); continue; }
      const key = `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
      files.current.set(key, f);
      next.push({ key, name: f.name, size: f.size, progress: 0, state: "waiting" });
    }
    setJobs((js) => [...js, ...next]);
  }

  const total = jobs.length;
  const done = jobs.filter((j) => j.state === "done").length;

  return (
    <div className="upl">
      <div
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      >
        <Download />
        <b>Drop photos and films here</b>
        <span>or click to choose · JPG, PNG, HEIC, MP4, MOV</span>
        <input ref={input} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>

      {total > 0 && (
        <div className="queue">
          <div className="queue-head">
            <span>Uploading {done} of {total}</span>
          </div>
          {jobs.map((j) => (
            <div key={j.key} className={`job ${j.state}`}>
              <div className="job-row">
                <span className="job-name">{j.name}</span>
                <span className="job-state">
                  {j.state === "done" ? <Check /> : j.state === "error" ? j.error : j.state === "waiting" ? "Waiting" : `${Math.round(j.progress * 100)}%`}
                </span>
                {j.state === "error" && (
                  <button className="icon-btn" aria-label="Dismiss" onClick={() => setJobs((js) => js.filter((x) => x.key !== j.key))}><Close /></button>
                )}
              </div>
              <div className="bar"><i style={{ width: `${Math.round(j.progress * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ thumbnails

function Thumb({ item, isCover, onCover, onRemove, onRename }: { item: MediaItem; isCover: boolean; onCover: () => void; onRemove: () => void; onRename: (name: string) => Promise<boolean> }) {
  const [confirm, setConfirm] = useState(false);
  const [broken, setBroken] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ext = item.name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "";
  const base = ext ? item.name.slice(0, -ext.length) : item.name;
  const busy = useRef(false);
  async function commit() {
    if (busy.current) return;
    const next = draft.trim();
    if (!next || next === base) return setEditing(false);
    busy.current = true;
    const ok = await onRename(next);
    busy.current = false;
    if (ok) setEditing(false);
  }
  function cancel() {
    busy.current = true; // keeps the blur that follows from saving
    setEditing(false);
    setTimeout(() => (busy.current = false), 0);
  }
  return (
    <figure className="mthumb">
      <div className="mthumb-img">
        {broken ? <span className="dash-empty">Preview processing…</span> : <img src={item.thumb} alt="" loading="lazy" onError={() => setBroken(true)} />}
        {item.kind === "video" && <span className="mthumb-play"><Play />{item.duration ? formatDuration(item.duration) : ""}</span>}
        {isCover && <span className="tag cover-tag">Cover</span>}
      </div>
      <figcaption>
        {editing ? (
          <form className="rename" onSubmit={(e) => { e.preventDefault(); commit(); }}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && cancel()}
              onBlur={commit}
              aria-label="New file name"
            />
            {ext && <span className="ext">{ext}</span>}
          </form>
        ) : (
          <button className="mthumb-name" title="Click to rename" onClick={() => { setDraft(base); setEditing(true); }}>{item.name}</button>
        )}
        <span className="mthumb-actions">
          {!editing && <button className="link-btn" onClick={() => { setDraft(base); setEditing(true); }}>Rename</button>}
          {item.kind === "photo" && !isCover && <button className="link-btn" onClick={onCover}>Make cover</button>}
          {confirm ? (
            <>
              <button className="link-btn danger" onClick={onRemove}>Remove?</button>
              <button className="link-btn" onClick={() => setConfirm(false)}>Keep</button>
            </>
          ) : (
            <button className="link-btn" onClick={() => setConfirm(true)}>Remove</button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

// ------------------------------------------------------------------ settings

function Settings({ g, onSave }: { g: G; onSave: (p: Partial<GallerySettings> & { title?: string }) => Promise<boolean> }) {
  const [f, setF] = useState({
    title: g.title,
    client: g.settings.client ?? "",
    date: g.settings.date ?? "",
    password: g.settings.password ?? "",
    message: g.settings.message ?? "",
    downloads: g.settings.downloads !== false,
    hidden: g.hidden,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave(f);
    setBusy(false);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h3>Gallery settings</h3>
      <label className="field"><span>Name</span><input required value={f.title} onChange={set("title")} /></label>
      <label className="field"><span>Client</span><input value={f.client} onChange={set("client")} /></label>
      <label className="field"><span>Date</span><input type="date" value={f.date} onChange={set("date")} /></label>
      <label className="field"><span>Password</span><input value={f.password} onChange={set("password")} placeholder="None — anyone with the link" autoComplete="off" /></label>
      <label className="field"><span>Welcome message</span><textarea value={f.message} onChange={set("message")} /></label>
      <label className="check"><input type="checkbox" checked={f.downloads} onChange={set("downloads")} /> Allow downloads</label>
      <label className="check"><input type="checkbox" checked={f.hidden} onChange={set("hidden")} /> Draft (hide from client)</label>
      <p className="hint">Renaming changes the link. Changing the password signs out anyone using the old one.</p>
      <button className="btn primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

function Danger({ g, demo, say, onDeleted }: { g: G; demo: boolean; say: (t: string) => void; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true);
    const res = await api(`/api/admin/galleries/${g.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onDeleted();
    else say(res.error || "Couldn't delete");
  }
  return (
    <div className="panel danger-zone">
      <h3>Delete gallery</h3>
      <p className="hint">Moves the folder to your Google Drive trash. You can restore it from Drive for 30 days.</p>
      {open ? (
        <>
          <label className="field"><span>Type the gallery name to confirm</span><input value={typed} onChange={(e) => setTyped(e.target.value)} /></label>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn danger" disabled={typed.trim() !== g.title || busy || demo} onClick={del}>{busy ? "Deleting…" : "Delete"}</button>
            <button className="btn" onClick={() => { setOpen(false); setTyped(""); }}>Cancel</button>
          </div>
        </>
      ) : (
        <button className="btn danger" onClick={() => setOpen(true)}>Delete…</button>
      )}
    </div>
  );
}
