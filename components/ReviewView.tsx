"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import type { Gallery, MediaItem, Studio } from "@/lib/types";
import { Brand, Watermark } from "./Brand";
import { Check, Download, Film, Photo } from "./icons";
import ThemeToggle from "./ThemeToggle";

type Reply = { id: string; author: string; text: string; at: string; owner: boolean };
type Note = Reply & { fileId: string; t?: number; x?: number; y?: number; resolved: boolean; replies: Reply[] };
type Approval = { fileId: string; author: string; at: string };
type Feedback = { notes: Note[]; approvals: Approval[] };

const NAME_KEY = "review-name";
const clock = (t: number) => formatDuration(t) || "0:00";
const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
const titleOf = (i: MediaItem) => i.title ?? i.name.replace(/\.[^.]+$/, "");

/**
 * Review page for drafts: timestamped notes on films, pinned notes on photos,
 * replies, resolve, and approve. Markup review projects only; never used for delivery galleries.
 */
export default function ReviewView({ gallery, studio, owner }: {
  gallery: Gallery; studio: Studio;
  owner?: { clientView: string; notes: string[] };
}) {
  // Versions are the project's subfolders ("Version 1", "Version 2"…); the newest opens first.
  const versions = useMemo(() => gallery.sections.filter((s) => gallery.items.some((i) => i.section === s.id)), [gallery.sections, gallery.items]);
  const [ver, setVer] = useState(versions.at(-1)?.id ?? "");
  const items = useMemo(
    () => gallery.items.filter((i) => i.kind !== "caption" && (!versions.length || i.section === ver)),
    [gallery.items, versions.length, ver],
  );
  const [index, setIndex] = useState(0);
  const item = items[index];
  const [fb, setFb] = useState<Feedback>({ notes: [], approvals: [] });
  const [name, setName] = useState("");
  const [askName, setAskName] = useState<null | (() => void)>(null);
  const [draft, setDraft] = useState("");
  const [at, setAt] = useState<number | null>(null); // video time for the next note
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null); // photo spot for the next note
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedDuration, setDuration] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>();
  const [active, setActive] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef("");
  nameRef.current = name;
  const api = `/api/review/${gallery.slug}`;

  const load = useCallback(() => {
    fetch(api, { cache: "no-store" }).then((r) => r.json()).then((r) => r.ok && setFb({ notes: r.notes, approvals: r.approvals })).catch(() => {});
  }, [api]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch {}
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setAt(null); setPin(null); setDraft(""); setDuration(0); setAspect(undefined); setActive(null); setError("");
  }, [index, ver]);

  const notesFor = (id: string) => fb.notes.filter((n) => n.fileId === id);
  const approvalFor = (id: string) => fb.approvals.find((a) => a.fileId === id);
  const mine = notesFor(item?.id ?? "")
    .sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || a.at.localeCompare(b.at));
  const numbered = new Map(mine.map((n, i) => [n.id, i + 1]));
  const visible = mine.filter((n) => showResolved || !n.resolved);
  const approvedCount = items.filter((i) => approvalFor(i.id)).length;
  const openTotal = fb.notes.filter((n) => !n.resolved).length;

  function withName(run: () => void) {
    if (owner || nameRef.current.trim()) return run();
    setAskName(() => run);
  }

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: nameRef.current.trim(), fileId: item.id, ...body }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
    setBusy(false);
    if (!res.ok) { setError(res.error || "Couldn't save"); return false; }
    setFb(res.feedback);
    return res.id as string;
  }

  function post(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim()) return;
    withName(async () => {
      const id = await send({ action: "comment", text: draft, t: at ?? undefined, x: pin?.x, y: pin?.y });
      if (id) { setDraft(""); setAt(null); setPin(null); setActive(id); }
    });
  }

  function captureTime() {
    const v = video.current;
    if (v && item.kind === "video" && at === null) {
      v.pause();
      setAt(Math.round(v.currentTime * 10) / 10);
    }
  }

  function seek(t?: number) {
    const v = video.current;
    if (v && t !== undefined) { v.currentTime = t; v.pause(); }
  }

  function placePin(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setPin({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 });
    setActive(null);
    setTimeout(() => box.current?.focus(), 0);
  }

  if (!item) {
    return <main className="center-page"><div className="lock"><h1 className="serif">Nothing to review yet</h1><p style={{ color: "var(--muted)" }}>Check back soon.</p></div></main>;
  }
  const approval = approvalFor(item.id);
  const duration = loadedDuration || item.duration || 0;

  return (
    <div className="rv">
      {owner && (
        <div className="owner-bar">
          <span><b>Owner view.</b> Your replies post as {studio.name}. {owner.notes.join(" ")}</span>
          <a className="btn" href={owner.clientView}>See what clients see</a>
        </div>
      )}
      <header className="rv-top">
        <Brand studio={studio} />
        <div className="rv-title">
          <span className="rv-pill">Review</span>
          <b>{gallery.title}</b>
          {versions.length > 1 && (
            <select className="rv-ver" value={ver} onChange={(e) => { setVer(e.target.value); setIndex(0); }} aria-label="Version">
              {versions.map((v, i) => <option key={v.id} value={v.id}>{v.name}{i === versions.length - 1 ? " (latest)" : ""}</option>)}
            </select>
          )}
          {versions.length === 1 && <span className="rv-ver-tag">{versions[0].name}</span>}
        </div>
        <div className="rv-top-right">
          <span className="rv-progress">{approvedCount}/{items.length} approved{openTotal ? ` · ${openTotal} open note${openTotal === 1 ? "" : "s"}` : ""}</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="rv-body">
        <nav className="rv-list" aria-label="Files to review">
          {items.map((it, i) => {
            const open = notesFor(it.id).filter((n) => !n.resolved).length;
            return (
              <button key={it.id} className={`rv-item ${i === index ? "on" : ""}`} onClick={() => setIndex(i)}>
                <span className="rv-thumb">
                  {it.thumb ? <img src={it.thumb} alt="" loading="lazy" /> : it.kind === "video" ? <Film /> : <Photo />}
                  {it.kind === "video" && it.duration ? <span className="rv-dur">{formatDuration(it.duration)}</span> : null}
                </span>
                <span className="rv-item-text">
                  <span className="rv-item-name">{titleOf(it)}</span>
                  <span className="rv-item-meta">
                    {approvalFor(it.id) ? <span className="rv-ok"><Check /> Approved</span> : open ? <span className="rv-open">{open} open</span> : <span>No notes</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <main className="rv-stage">
          <div className="rv-media">
            {item.kind === "video" ? (
              <div className="rv-video">
                <video
                  key={item.id}
                  ref={video}
                  src={item.src}
                  poster={item.full || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList={gallery.allowDownload ? undefined : "nodownload"}
                  onContextMenu={gallery.allowDownload ? undefined : (e) => e.preventDefault()}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration || 0);
                    if (e.currentTarget.videoWidth) setAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight);
                  }}
                >
                  {item.captions?.map((c) => <track key={c.id} kind="captions" src={c.src} srcLang={c.lang ?? "en"} label={c.label} />)}
                </video>
                {gallery.watermark && <Watermark spec={gallery.watermark} big aspect={aspect ?? (item.width && item.height ? item.width / item.height : 16 / 9)} />}
              </div>
            ) : (
              <div className="rv-photo-wrap">
                <div className="rv-photo" onClick={placePin} title="Click to pin a note here">
                  <img src={item.full} alt={titleOf(item)} draggable={false} onContextMenu={gallery.allowDownload ? undefined : (e) => e.preventDefault()} />
                  {gallery.watermark && <Watermark spec={gallery.watermark} big />}
                  {mine.filter((n) => n.x !== undefined && n.y !== undefined && (showResolved || !n.resolved)).map((n) => (
                    <button
                      key={n.id}
                      className={`rv-pin ${n.resolved ? "done" : ""} ${active === n.id ? "on" : ""}`}
                      style={{ left: `${n.x}%`, top: `${n.y}%` }}
                      onClick={(e) => { e.stopPropagation(); setActive(n.id); document.getElementById(`note-${n.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}
                      aria-label={`Note ${numbered.get(n.id)}`}
                    >{numbered.get(n.id)}</button>
                  ))}
                  {pin && <span className="rv-pin new" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>+</span>}
                </div>
              </div>
            )}
          </div>

          {item.kind === "video" && duration > 0 && (
            <div className="rv-timeline" aria-label="Notes on the timeline">
              <div className="rv-track" />
              {mine.filter((n) => n.t !== undefined && (showResolved || !n.resolved)).map((n) => (
                <button
                  key={n.id}
                  className={`rv-mark ${n.resolved ? "done" : ""} ${active === n.id ? "on" : ""}`}
                  style={{ left: `${Math.min(100, ((n.t ?? 0) / duration) * 100)}%` }}
                  onClick={() => { seek(n.t); setActive(n.id); document.getElementById(`note-${n.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}
                  title={`${clock(n.t ?? 0)} · ${n.text.slice(0, 60)}`}
                >{numbered.get(n.id)}</button>
              ))}
            </div>
          )}

          <div className="rv-under">
            <div style={{ minWidth: 0 }}>
              <h1 className="serif">{titleOf(item)}</h1>
              <span className="rv-sub">{index + 1} of {items.length}{item.kind === "video" ? " · Pause anywhere and write a note to pin it to that moment" : " · Click the photo to pin a note to a spot"}</span>
            </div>
            <div className="rv-actions">
              {gallery.allowDownload && <a className="btn" href={item.download} download={item.name}><Download /> Download</a>}
              {approval ? (
                <button className="btn rv-approved" disabled={busy} onClick={() => withName(() => send({ action: "unapprove" }))} title="Click to undo">
                  <Check /> Approved by {approval.author}
                </button>
              ) : (
                <button className="btn primary" disabled={busy} onClick={() => withName(() => send({ action: "approve" }))}><Check /> Approve</button>
              )}
            </div>
          </div>
        </main>

        <section className="rv-notes" aria-label="Notes">
          <form className="rv-compose" onSubmit={post}>
            <div className="rv-compose-tags">
              {item.kind === "video" && (at !== null
                ? <span className="rv-chip">at {clock(at)} <button type="button" onClick={() => setAt(null)} aria-label="Make it a general note">×</button></span>
                : <span className="rv-chip muted">General note — pause the video to pin one</span>)}
              {item.kind === "photo" && (pin
                ? <span className="rv-chip">Pinned to the photo <button type="button" onClick={() => setPin(null)} aria-label="Remove pin">×</button></span>
                : <span className="rv-chip muted">General note — click the photo to pin one</span>)}
            </div>
            <textarea
              ref={box}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={captureTime}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(); }}
              placeholder={item.kind === "video" ? "e.g. Trim this pause, or swap to the wide shot here" : "e.g. Brighten her face a touch"}
              rows={3}
            />
            <div className="rv-compose-foot">
              <span className="hint" style={{ margin: 0 }}>{owner ? `Posting as ${studio.name}` : name ? <>Posting as <b>{name}</b> · <button type="button" className="link-btn" onClick={() => setAskName(() => () => {})}>change</button></> : "You'll be asked for your name"}</span>
              <button className="btn primary" disabled={busy || !draft.trim()}>{busy ? "Saving…" : "Add note"}</button>
            </div>
            {error && <p className="error" style={{ margin: "6px 0 0" }}>{error}</p>}
          </form>

          <div className="rv-notes-head">
            <b>{mine.filter((n) => !n.resolved).length} open</b>
            {mine.some((n) => n.resolved) && (
              <label className="check" style={{ margin: 0, fontSize: 13 }}><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved ({mine.filter((n) => n.resolved).length})</label>
            )}
          </div>

          {visible.length ? (
            <ol className="rv-thread-list">
              {visible.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  num={numbered.get(n.id)!}
                  active={active === n.id}
                  owner={!!owner}
                  busy={busy}
                  onSelect={() => { setActive(n.id); seek(n.t); }}
                  onReply={(text) => new Promise<boolean>((resolve) => withName(async () => resolve(!!(await send({ action: "reply", parentId: n.id, text }))))) }
                  onResolve={() => withName(() => send({ action: n.resolved ? "reopen" : "resolve", parentId: n.id }))}
                  onDelete={() => send({ action: "delete", parentId: n.id })}
                />
              ))}
            </ol>
          ) : (
            <p className="rv-empty">{mine.length ? "All notes are resolved." : "No notes yet. Add the first one above."}</p>
          )}
        </section>
      </div>

      {askName && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setAskName(null)}>
          <form
            className="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              try { localStorage.setItem(NAME_KEY, n); } catch {}
              nameRef.current = n;
              const run = askName;
              setAskName(null);
              run();
            }}
          >
            <h2 className="serif">Your name</h2>
            <p className="sub">So {studio.name} knows who left each note.</p>
            <label className="field"><span>Name</span><input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan from Marketing" maxLength={60} /></label>
            <div className="actions">
              <button type="button" className="btn" onClick={() => setAskName(null)}>Cancel</button>
              <button className="btn primary">Continue</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, num, active, owner, busy, onSelect, onReply, onResolve, onDelete }: {
  note: Note; num: number; active: boolean; owner: boolean; busy: boolean;
  onSelect: () => void; onReply: (text: string) => Promise<boolean>; onResolve: () => void; onDelete: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <li id={`note-${note.id}`} className={`rv-note ${note.resolved ? "done" : ""} ${active ? "on" : ""}`}>
      <div className="rv-note-head" onClick={onSelect}>
        <span className="rv-num">{num}</span>
        {note.t !== undefined && <span className="rv-time">{clock(note.t)}</span>}
        {note.x !== undefined && <span className="rv-time">Pin</span>}
        <b>{note.author}</b>
        {note.owner && <span className="rv-studio">Studio</span>}
        <span className="rv-when">{when(note.at)}</span>
      </div>
      <p className="rv-text">{note.text}</p>
      {note.replies.map((r) => (
        <div key={r.id} className="rv-reply">
          <div><b>{r.author}</b>{r.owner && <span className="rv-studio">Studio</span>} <span className="rv-when">{when(r.at)}</span></div>
          <p className="rv-text">{r.text}</p>
        </div>
      ))}
      {replying ? (
        <form
          className="rv-reply-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            if (await onReply(text)) { setText(""); setReplying(false); }
          }}
        >
          <textarea autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn primary" disabled={busy || !text.trim()}>Reply</button>
            <button type="button" className="btn" onClick={() => setReplying(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="rv-note-actions">
          <button type="button" className="link-btn" onClick={() => setReplying(true)}>Reply</button>
          <button type="button" className="link-btn" disabled={busy} onClick={onResolve}>{note.resolved ? "Reopen" : "Mark resolved"}</button>
          {owner && (confirm
            ? <><button type="button" className="link-btn danger" onClick={onDelete}>Delete note?</button><button type="button" className="link-btn" onClick={() => setConfirm(false)}>Keep</button></>
            : <button type="button" className="link-btn" onClick={() => setConfirm(true)}>Delete</button>)}
        </div>
      )}
    </li>
  );
}
