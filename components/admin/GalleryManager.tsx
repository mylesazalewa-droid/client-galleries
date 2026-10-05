"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration, plural } from "@/lib/format";
import type { GallerySettings, MediaItem, Section } from "@/lib/types";
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
  sections: Section[];
  expired: boolean;
  clientLogo?: string;
  paid?: boolean;
};

const LICENSES: { label: string; text: (client: string) => string }[] = [
  { label: "Unlimited", text: (c) => `Licensed to ${c || "the client"} for unlimited use, worldwide and in perpetuity: website, social, paid ads, broadcast, events and internal communications. Music is cleared for these uses. Raw footage and project files aren't included.` },
  { label: "Web & social · 1 yr", text: (c) => `Licensed to ${c || "the client"} for organic and paid web and social media for 12 months from delivery. Broadcast, out-of-home and use by third parties need a separate license. Music is cleared for the same term.` },
  { label: "Internal only", text: (c) => `Licensed to ${c || "the client"} for internal use only: staff meetings, training, intranet and board presentations. Not for public posting or advertising.` },
  { label: "Event", text: (c) => `Licensed to ${c || "the client"} for screening at the event and for posting a recap on your own website and social channels. Not for paid advertising.` },
];

export type ActivityItem = { time: string; event: string; detail: string; visitor: string };

type Job = { key: string; name: string; size: number; folderId?: string; progress: number; state: "waiting" | "uploading" | "done" | "error"; error?: string };

const CONCURRENCY = 3;

async function api(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}

export default function GalleryManager({ gallery, demo, activity, stripe }: { gallery: G; demo: boolean; activity: ActivityItem[]; stripe: boolean }) {
  const router = useRouter();
  const [g, setG] = useState(gallery);
  const [target, setTarget] = useState(""); // "" = main area, otherwise a section id
  const [toast, setToast] = useState("");
  const [formKey, setFormKey] = useState(0); // remounts the settings form after payment changes
  const say = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 3200); }, []);

  const media = [...(g.cover && !g.items.some((i) => i.id === g.cover!.id) ? [g.cover] : []), ...g.items];
  const coverId = g.cover?.id ?? g.items.find((i) => i.kind === "photo")?.id;
  const link = `/g/${g.slug}`;

  async function refresh() {
    const res = await api("/api/admin/refresh", { method: "POST", body: JSON.stringify({ galleryId: g.id }) });
    if (res.ok) setG((cur) => ({ ...cur, items: res.items, cover: res.cover, sections: res.sections ?? cur.sections }));
  }

  async function addSection(name: string) {
    const res = await api("/api/admin/sections", { method: "POST", body: JSON.stringify({ galleryId: g.id, name }) });
    if (!res.ok) { say(res.error || "Couldn't add section"); return false; }
    setG((cur) => ({ ...cur, sections: [...cur.sections, res.section] }));
    setTarget(res.section.id);
    say(`Added “${res.section.name}”`);
    return true;
  }

  async function renameSection(sec: Section, name: string) {
    const res = await api(`/api/admin/sections/${sec.id}?g=${g.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    if (!res.ok) { say(res.error || "Couldn't rename"); return false; }
    setG((cur) => ({ ...cur, sections: cur.sections.map((x) => (x.id === sec.id ? { ...x, name: res.name } : x)) }));
    return true;
  }

  async function deleteSection(sec: Section) {
    const res = await api(`/api/admin/sections/${sec.id}?g=${g.id}`, { method: "DELETE" });
    if (!res.ok) return say(res.error || "Couldn't delete");
    setG((cur) => ({ ...cur, sections: cur.sections.filter((x) => x.id !== sec.id), items: cur.items.filter((i) => i.section !== sec.id) }));
    if (target === sec.id) setTarget("");
    say(`Deleted “${sec.name}” (it's in your Drive trash)`);
  }

  async function move(item: MediaItem, section: string) {
    const res = await api(`/api/admin/files/${item.id}?g=${g.id}`, { method: "PATCH", body: JSON.stringify({ section }) });
    if (!res.ok) return say(res.error || "Couldn't move");
    setG((cur) => ({ ...cur, items: cur.items.map((i) => (i.id === item.id ? { ...i, section } : i)) }));
    say(`Moved to ${section ? g.sections.find((x) => x.id === section)?.name : "Main"}`);
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

  async function markPaid() {
    const res = await api(`/api/admin/galleries/${g.id}/payment`, { method: "PATCH", body: JSON.stringify({ action: "paid" }) });
    if (!res.ok) { say(res.error || "Couldn't update"); return; }
    paymentChanged(res.settings, "Marked as paid. Downloads are on.");
  }

  function paymentChanged(settings: GallerySettings, msg: string) {
    setG((cur) => ({ ...cur, settings, paid: settings.hold ? false : cur.paid }));
    setFormKey((k) => k + 1);
    say(msg);
    router.refresh();
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
    `Hi${g.settings.client ? ` ${g.settings.client}` : ""}! Your files for "${g.title}" are ready:`,
    typeof window !== "undefined" ? `${location.origin}${link}` : link,
    g.settings.password ? `Password: ${g.settings.password}` : "",
    g.settings.expires ? `The gallery is available until ${new Date(`${g.settings.expires}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}, so download what you need before then.` : "",
    g.settings.picks ? "Tap the heart on anything you love and hit “Send picks” when you're done." : "",
  ].filter(Boolean).join("\n");

  const status = [
    g.hidden ? "Draft — only you can see it" : "Published",
    g.expired && "Expired",
    g.settings.hold && "Awaiting payment",
    g.paid && "Paid via Stripe",
    plural(g.items.length, "item"),
  ].filter(Boolean).join(" · ");

  // main area first, then sections
  const groups = [{ id: "", name: "Main" }, ...g.sections].map((sec) => ({
    ...sec,
    items: media.filter((i) => (sec.id ? i.section === sec.id : !g.sections.some((x) => x.id === i.section))),
  }));

  return (
    <div className="mgr">
      <section className="mgr-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{status}</div>
          <h1 className="serif">{g.title}</h1>
        </div>
        <div className="mgr-share">
          {g.settings.hold && <button className="btn" onClick={() => markPaid()}>Mark as paid</button>}
          <a className="btn" href={`${link}?as=client`} target="_blank" rel="noreferrer">View as client ↗</a>
          <CopyLink path={link} />
          <CopyLink text={invite} label="Copy invite" className="btn primary" />
        </div>
      </section>

      <div className="mgr-cols">
        <div className="mgr-main">
          <SectionBar sections={g.sections} target={target} onTarget={setTarget} onAdd={addSection} demo={demo} />
          <Uploader
            galleryId={g.id}
            folderId={target || undefined}
            targetName={target ? g.sections.find((x) => x.id === target)?.name : undefined}
            demo={demo}
            onDone={refresh}
            say={say}
          />

          {media.length || g.sections.length ? (
            groups.map((grp) =>
              !grp.id && !grp.items.length && g.sections.length ? null : (
                <section key={grp.id || "main"} className="mgr-sec">
                  {g.sections.length > 0 && (
                    <SectionHead
                      name={grp.name}
                      count={grp.items.length}
                      editable={!!grp.id}
                      onRename={(name) => renameSection({ id: grp.id, name: grp.name }, name)}
                      onDelete={() => deleteSection({ id: grp.id, name: grp.name })}
                    />
                  )}
                  {grp.items.length ? (
                    <div className="mgr-grid">
                      {grp.items.map((item) => (
                        <Thumb
                          key={item.id}
                          item={item}
                          isCover={item.id === coverId}
                          sections={g.sections}
                          onCover={() => save({ cover: item.name }, "Cover updated")}
                          onRemove={() => remove(item)}
                          onRename={(name) => rename(item, name)}
                          onMove={(sec) => move(item, sec)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="hint">Empty. Choose this section above, then drop files in.</p>
                  )}
                </section>
              ),
            )
          ) : (
            <div className="empty" style={{ padding: "50px 20px" }}>
              <div className="serif">Nothing here yet</div>
              Drop photos and films above. They upload straight into this gallery&apos;s folder in your Drive.
            </div>
          )}
        </div>

        <aside className="mgr-side">
          <Payment g={g} stripe={stripe} demo={demo} say={say} onChange={paymentChanged} onMarkPaid={markPaid} onSave={save} />
          <Settings key={formKey} g={g} onSave={save} />
          <ClientLogo g={g} demo={demo} say={say} onChange={(clientLogo) => setG((cur) => ({ ...cur, clientLogo }))} />
          <Activity items={activity} />
          <Danger g={g} demo={demo} say={say} onDeleted={() => { router.push("/admin"); router.refresh(); }} />
        </aside>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ uploader

function Uploader({ galleryId, folderId, targetName, demo, onDone, say }: {
  galleryId: string; folderId?: string; targetName?: string; demo: boolean; onDone: () => Promise<void> | void; say: (t: string) => void;
}) {
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
      body: JSON.stringify({ galleryId, folderId: job.folderId, name: file.name, type: file.type, size: file.size }),
    });
    if (!start.ok) return update(job.key, { state: "error", error: start.error });

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", start.uploadUrl);
      xhr.setRequestHeader("Content-Type", start.type || file.type || "application/octet-stream");
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
      if (!/^(image|video)\//.test(f.type) && !/\.(srt|vtt)$/i.test(f.name)) { say(`${f.name} isn't a photo, video or caption file`); continue; }
      const key = `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
      files.current.set(key, f);
      next.push({ key, name: f.name, size: f.size, folderId, progress: 0, state: "waiting" });
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
        <b>Drop photos and films here{targetName ? ` — into “${targetName}”` : ""}</b>
        <span>or click to choose · JPG, PNG, HEIC, MP4, MOV, SRT captions</span>
        <span className="drop-tip">Name formats like “Hero — 16x9.mp4”, “Hero — 9x16.mp4” and they become one film with a format switcher. “Hero.srt” adds captions.</span>
        <input ref={input} type="file" multiple accept="image/*,video/*,.srt,.vtt" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
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

function Thumb({ item, isCover, sections, onCover, onRemove, onRename, onMove }: {
  item: MediaItem; isCover: boolean; sections: Section[];
  onCover: () => void; onRemove: () => void; onRename: (name: string) => Promise<boolean>; onMove: (section: string) => void;
}) {
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
          {sections.length > 0 && !editing && (
            <select
              className="move"
              value=""
              onChange={(e) => e.target.value && onMove(e.target.value === "__main" ? "" : e.target.value)}
              aria-label={`Move ${item.name} to a section`}
            >
              <option value="">Move…</option>
              {item.section && <option value="__main">Main</option>}
              {sections.filter((x) => x.id !== item.section).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
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
    expires: g.settings.expires ?? "",
    hold: !!g.settings.hold,
    picks: !!g.settings.picks,
    share: g.settings.share !== false,
    license: g.settings.license ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave(f); // an empty date clears the expiry
    setBusy(false);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h3>Gallery settings</h3>
      <label className="field"><span>Name</span><input required value={f.title} onChange={set("title")} /></label>
      <label className="field"><span>Client</span><input value={f.client} onChange={set("client")} /></label>
      <label className="field"><span>Date</span><input type="date" value={f.date} onChange={set("date")} /></label>
      <label className="field"><span>Password</span><input value={f.password} onChange={set("password")} placeholder="None — anyone with the link" autoComplete="off" /></label>
      <label className="field"><span>Closes on</span>
        <span className="field-inline">
          <input type="date" value={f.expires} onChange={set("expires")} />
          {f.expires && <button type="button" className="link-btn" onClick={() => setF({ ...f, expires: "" })}>Never</button>}
        </span>
      </label>
      <label className="field"><span>Welcome message</span><textarea value={f.message} onChange={set("message")} /></label>
      <label className="check"><input type="checkbox" checked={f.downloads} onChange={set("downloads")} /> Allow downloads</label>
      <label className="check"><input type="checkbox" checked={f.hold} onChange={set("hold")} /> Hold downloads until paid (watermarked previews)</label>
      <label className="check"><input type="checkbox" checked={f.picks} onChange={set("picks")} /> Let clients heart favorites and send picks</label>
      <label className="check"><input type="checkbox" checked={f.share} onChange={set("share")} /> Let clients share single films and embed them on their website</label>
      <label className="check"><input type="checkbox" checked={f.hidden} onChange={set("hidden")} /> Draft (hide from client)</label>
      <div className="field"><span>Usage rights</span>
        <div className="presets">
          {LICENSES.map((l) => (
            <button key={l.label} type="button" className="chip" onClick={() => setF({ ...f, license: l.text(f.client.trim()) })}>{l.label}</button>
          ))}
          {f.license && <button type="button" className="link-btn" onClick={() => setF({ ...f, license: "" })}>Clear</button>}
        </div>
        <textarea value={f.license} onChange={set("license")} placeholder="Optional. Shown to the client as a “Usage rights” card." rows={4} />
      </div>
      <p className="hint">Renaming changes the link. Changing the password signs out anyone using the old one. After the closing date, clients see a “gallery closed” page.</p>
      <button className="btn primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

// ------------------------------------------------------------------ payment

type Pay = { id: string; label: string; email?: string; created: number };

function Payment({ g, stripe, demo, say, onChange, onMarkPaid, onSave }: {
  g: G; stripe: boolean; demo: boolean; say: (t: string) => void;
  onChange: (s: GallerySettings, msg: string) => void; onMarkPaid: () => void;
  onSave: (p: Partial<GallerySettings>, msg?: string) => Promise<boolean>;
}) {
  const s = g.settings;
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [payments, setPayments] = useState<Pay[] | null>(null);
  const [manual, setManual] = useState(s.payUrl && !s.payLinkId ? s.payUrl : "");
  const [copied, setCopied] = useState(false);
  const open = !!s.payLinkId && !!s.hold;
  const paid = !!s.payLinkId && !s.hold;

  useEffect(() => {
    if (!stripe || !s.payLinkId) return setPayments(null);
    api(`/api/admin/galleries/${g.id}/payment`).then((r) => setPayments(r.ok ? r.payments : []));
  }, [g.id, s.payLinkId, s.hold, stripe]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (demo) return say("Demo mode — connect Google to request payments.");
    setBusy(true);
    const res = await api(`/api/admin/galleries/${g.id}/payment`, { method: "POST", body: JSON.stringify({ amount, label }) });
    setBusy(false);
    if (!res.ok) return say(res.error || "Couldn't create the payment");
    setEditing(false); setAmount(""); setLabel("");
    onChange(res.settings, "Payment request created. The gallery is on hold until it's paid.");
  }

  async function cancel() {
    setBusy(true);
    const res = await api(`/api/admin/galleries/${g.id}/payment`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return say(res.error || "Couldn't cancel");
    onChange(res.settings, "Payment request canceled. The old link no longer works.");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(s.payUrl ?? ""); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const amountLabel = s.payAmount ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(s.payAmount / 100) : "";

  if (!stripe) {
    return (
      <div className="panel">
        <h3>Payment</h3>
        <p className="hint" style={{ marginTop: 0 }}>Connect Stripe to create payment requests here: add <code>STRIPE_SECRET_KEY</code> in Vercel. Until then you can paste a Stripe payment link.</p>
        <label className="field"><span>Payment link</span><input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="https://buy.stripe.com/…" /></label>
        <button className="btn" disabled={busy} onClick={async () => { setBusy(true); await onSave({ payUrl: manual.trim() }, manual.trim() ? "Payment link saved" : "Payment link removed"); setBusy(false); }}>Save link</button>
      </div>
    );
  }

  const form = (
    <form onSubmit={create} className="pay-form">
      <label className="field"><span>Amount (USD)</span>
        <span className="money-input"><b>$</b><input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2,500" /></span>
      </label>
      <label className="field"><span>What it&apos;s for</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${g.title} — final payment`} /></label>
      <p className="hint" style={{ marginTop: 0 }}>Clients see watermarked previews and a “Pay {amount ? `$${amount.replace(/^\$/, "")}` : "invoice"}” button. Downloads unlock automatically once Stripe confirms payment.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={busy}>{busy ? "Creating…" : open ? "Replace request" : "Request payment"}</button>
        {editing && <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );

  return (
    <div className="panel pay-panel">
      <h3>Payment</h3>
      {open && !editing && (
        <>
          <div className="pay-status wait"><span className="dot" /> Waiting for payment</div>
          <div className="pay-amount">{amountLabel}</div>
          {s.payLabel && <div className="pay-label">{s.payLabel}</div>}
          <div className="copy-row" style={{ margin: "12px 0" }}>
            <input readOnly value={s.payUrl ?? ""} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={busy} onClick={onMarkPaid}>Mark as paid</button>
            <button type="button" className="btn" disabled={busy} onClick={() => setEditing(true)}>Change amount</button>
            <button type="button" className="link-btn" disabled={busy} onClick={cancel}>Cancel request</button>
          </div>
          <p className="hint">Paid by check or another way? “Mark as paid” unlocks the gallery and turns off the Stripe link.</p>
        </>
      )}
      {paid && !editing && (
        <>
          <div className="pay-status ok"><span className="dot" /> Paid{amountLabel ? ` · ${amountLabel}` : ""}</div>
          {s.payLabel && <div className="pay-label">{s.payLabel}</div>}
          {payments?.length ? (
            <ul className="pay-list">
              {payments.map((p) => (
                <li key={p.id}><b>{p.label}</b> {p.email && <span>{p.email}</span>} <span>{new Date(p.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></li>
              ))}
            </ul>
          ) : payments ? <p className="hint">Marked as paid by you.</p> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => setEditing(true)}>New payment request</button>
            <button type="button" className="link-btn" disabled={busy} onClick={cancel}>Clear</button>
          </div>
        </>
      )}
      {(!s.payLinkId || editing) && form}
    </div>
  );
}

// ------------------------------------------------------------------ client logo

function ClientLogo({ g, demo, say, onChange }: { g: G; demo: boolean; say: (t: string) => void; onChange: (url?: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    if (demo) return say("Demo mode — connect Google to upload.");
    setBusy(true);
    const start = await api(`/api/admin/galleries/${g.id}/logo`, { method: "POST", body: JSON.stringify({ type: file.type, size: file.size }) });
    if (!start.ok) { setBusy(false); return say(start.error || "Couldn't upload"); }
    const ok = await fetch(start.uploadUrl, { method: "PUT", headers: { "Content-Type": start.type }, body: file }).then((r) => r.ok).catch(() => false);
    setBusy(false);
    if (!ok) return say("Upload failed — try again");
    onChange(URL.createObjectURL(file));
    say("Client logo added");
  }

  async function remove() {
    setBusy(true);
    const res = await api(`/api/admin/galleries/${g.id}/logo`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return say(res.error || "Couldn't remove");
    onChange(undefined);
    say("Client logo removed");
  }

  return (
    <div className="panel">
      <h3>Client logo</h3>
      <p className="hint" style={{ marginTop: 0 }}>Shows as “Prepared for” next to your logo on the gallery, film pages and link previews.</p>
      {g.clientLogo ? (
        <div className="logo-prev"><img src={g.clientLogo} alt="" /></div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Working…" : g.clientLogo ? "Replace" : "Upload logo"}</button>
        {g.clientLogo && <button type="button" className="btn" disabled={busy} onClick={remove}>Remove</button>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
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

// ------------------------------------------------------------------ sections

function SectionBar({ sections, target, onTarget, onAdd, demo }: {
  sections: Section[]; target: string; onTarget: (id: string) => void; onAdd: (name: string) => Promise<boolean>; demo: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setAdding(false);
    if (await onAdd(name.trim())) { setName(""); setAdding(false); }
  }
  return (
    <div className="sec-bar">
      <span className="sec-bar-label">Upload to</span>
      <button className={`chip ${target === "" ? "on" : ""}`} onClick={() => onTarget("")}>Main</button>
      {sections.map((s) => (
        <button key={s.id} className={`chip ${target === s.id ? "on" : ""}`} onClick={() => onTarget(s.id)}>{s.name}</button>
      ))}
      {adding ? (
        <form onSubmit={submit} className="sec-add">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Social cuts" onKeyDown={(e) => e.key === "Escape" && setAdding(false)} />
          <button className="btn primary" style={{ height: 32 }}>Add</button>
        </form>
      ) : (
        <button className="chip add" disabled={demo} onClick={() => setAdding(true)}>+ Section</button>
      )}
    </div>
  );
}

function SectionHead({ name, count, editable, onRename, onDelete }: {
  name: string; count: number; editable: boolean; onRename: (name: string) => Promise<boolean>; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirm, setConfirm] = useState(false);
  return (
    <header className="mgr-sec-head">
      {editing ? (
        <form onSubmit={async (e) => { e.preventDefault(); if (await onRename(draft.trim())) setEditing(false); }} className="sec-add">
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
          <button className="btn primary" style={{ height: 32 }}>Save</button>
        </form>
      ) : (
        <h2 className="serif">{name}</h2>
      )}
      <span className="count">{plural(count, "item")}</span>
      {editable && !editing && (
        <span className="mthumb-actions" style={{ marginLeft: "auto" }}>
          <button className="link-btn" onClick={() => { setDraft(name); setEditing(true); }}>Rename</button>
          {confirm ? (
            <>
              <button className="link-btn danger" onClick={onDelete}>Delete section and its files?</button>
              <button className="link-btn" onClick={() => setConfirm(false)}>Keep</button>
            </>
          ) : (
            <button className="link-btn" onClick={() => setConfirm(true)}>Delete</button>
          )}
        </span>
      )}
    </header>
  );
}

// ------------------------------------------------------------------ activity

function Activity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="panel">
      <h3>Recent activity</h3>
      {items.length ? (
        <ul className="activity">
          {items.map((a, i) => (
            <li key={i}>
              <b>{a.event}</b>
              {a.detail && <span className="a-detail">{a.detail}</span>}
              <span className="a-meta">{a.time}{a.visitor ? ` · ${a.visitor}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint" style={{ margin: 0 }}>Nothing yet. You&apos;ll see when the client opens the gallery, unlocks it and downloads files. Your own visits aren&apos;t counted.</p>
      )}
    </div>
  );
}
