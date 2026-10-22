"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import type { Gallery, MediaItem, Studio } from "@/lib/types";
import { Brand, Watermark } from "./Brand";
import { Check, Download, Film, Left, Photo, Right } from "./icons";

type Reply = { id: string; author: string; text: string; at: string; owner: boolean };
type Note = Reply & { fileId: string; t?: number; x?: number; y?: number; resolved: boolean; replies: Reply[] };
type Approval = { fileId: string; author: string; at: string };
type Feedback = { notes: Note[]; approvals: Approval[] };
type Status = "" | "progress" | "changes" | "approved";

const STATUS: Record<Status, string> = { "": "No status", progress: "In progress", changes: "Needs changes", approved: "Approved" };
const NAME_KEY = "review-name";
const SPEEDS = [1, 1.5, 2, 0.5];
const clock = (t: number) => {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const initials = (n: string) => n.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const titleOf = (i: MediaItem) => i.title ?? i.name.replace(/\.[^.]+$/, "");

/**
 * Markup review page: click anywhere on a film or photo to leave a comment pinned to that spot
 * (and moment), reply, resolve, approve, and tell the studio when you're done.
 */
export default function ReviewView({ gallery, studio, owner, review }: {
  gallery: Gallery; studio: Studio;
  owner?: { clientView: string; notes: string[] };
  review?: { id: string; status?: Status; paused?: boolean; message?: string };
}) {
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
  const [pin, setPin] = useState<{ x?: number; y?: number; t?: number } | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(review?.status ?? "");
  const [paused, setPaused] = useState(!!review?.paused);
  const [done, setDone] = useState(false);
  const [panel, setPanel] = useState(true);
  // player
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [vol, setVol] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>();
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef("");
  nameRef.current = name;
  const api = `/api/review/${gallery.slug}`;

  const load = useCallback(() => {
    fetch(api, { cache: "no-store" }).then((r) => r.json()).then((r) => r.ok && setFb({ notes: r.notes, approvals: r.approvals })).catch(() => {});
  }, [api]);
  // ?f=<file id> opens straight to that file (links from the dashboard).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    const f = new URLSearchParams(location.search).get("f");
    if (!f) { opened.current = true; return; }
    const it = gallery.items.find((i) => i.id === f);
    if (!it) return;
    if (versions.length && it.section !== ver) { setVer(it.section); return; }
    const i = items.findIndex((x) => x.id === f);
    if (i >= 0) setIndex(i);
    opened.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver]);
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch {}
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    setPin(null); setDraft(""); setActive(null); setError(""); setTime(0); setDur(0); setPlaying(false); setAspect(undefined);
  }, [index, ver]);
  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed, item?.id]);
  useEffect(() => { if (video.current) video.current.volume = vol; }, [vol, item?.id]);

  const notesFor = (id: string) => fb.notes.filter((n) => n.fileId === id);
  const approvalFor = (id: string) => fb.approvals.find((a) => a.fileId === id);
  const mine = notesFor(item?.id ?? "").sort((a, b) => (a.t ?? -1) - (b.t ?? -1) || a.at.localeCompare(b.at));
  const numbered = new Map(mine.map((n, i) => [n.id, i + 1]));
  const listed = mine.filter((n) => filter === "all" || !n.resolved);
  const people = Array.from(new Set(fb.notes.flatMap((n) => [n.author, ...n.replies.map((r) => r.author)]))).slice(0, 4);
  const locked = paused && !owner;

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
      body: JSON.stringify({ author: nameRef.current.trim(), fileId: item?.id, ...body }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
    setBusy(false);
    if (!res.ok) { setError(res.error || "Couldn't save"); return false; }
    if (res.feedback) setFb(res.feedback);
    return (res.id as string) || true;
  }

  async function ownerSave(patch: Record<string, unknown>) {
    if (!review) return;
    await fetch(`/api/admin/galleries/${review.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
  }

  function post(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim()) return;
    withName(async () => {
      const id = await send({ action: "comment", text: draft, t: pin?.t, x: pin?.x, y: pin?.y });
      if (id) { setDraft(""); setPin(null); if (typeof id === "string") setActive(id); }
    });
  }

  /** Click on the picture: pause, remember the spot (and moment), and open the comment box. */
  function placePin(e: React.MouseEvent<HTMLDivElement>) {
    if (locked) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    const v = video.current;
    if (v) v.pause();
    setPin({ x, y, t: v ? Math.round(v.currentTime * 10) / 10 : undefined });
    setActive(null);
    setPanel(true);
    setTimeout(() => box.current?.focus(), 0);
  }

  function seek(t?: number) {
    const v = video.current;
    if (v && t !== undefined) { v.currentTime = t; v.pause(); setTime(t); }
  }

  function select(n: Note) {
    setActive(n.id);
    seek(n.t);
  }

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) { v.play(); setPin(null); } else v.pause();
  }

  // Space to play/pause when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.code === "Space" && video.current) { e.preventDefault(); toggle(); }
      if (e.key === "ArrowRight" && e.shiftKey) setIndex((i) => Math.min(items.length - 1, i + 1));
      if (e.key === "ArrowLeft" && e.shiftKey) setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!item) {
    return (
      <div className="mk mk-review">
        <main className="center-page"><div className="lock"><h1 className="serif">Nothing to review yet</h1><p style={{ color: "var(--muted)" }}>Drafts will show up here soon.</p></div></main>
      </div>
    );
  }
  const approval = approvalFor(item.id);
  const duration = dur || item.duration || 0;
  const isVideo = item.kind === "video";
  // On films, pins show while paused near their moment (or when selected).
  const pinsShown = mine.filter((n) => n.x !== undefined && n.y !== undefined && (filter === "all" || !n.resolved) &&
    (!isVideo || active === n.id || (!playing && n.t !== undefined && Math.abs(n.t - time) < 0.6)));
  const ar = aspect ?? (item.width && item.height ? item.width / item.height : 16 / 9);

  return (
    <div className="mk mk-review">
      <header className="mk-top">
        <div className="mk-top-l">
          {owner && review && <a className="mk-back" href={`/admin/reviews/${review.id}`} title="Back to the project"><Left /> Project</a>}
          <Brand studio={studio} className="mk-brand serif" />
          {owner ? (
            <label className={`mk-status s-${status || "none"}`}>
              <span className="dot" />
              <select value={status} onChange={(e) => { const s = e.target.value as Status; setStatus(s); ownerSave({ reviewStatus: s || undefined }); }} aria-label="Status">
                {(Object.keys(STATUS) as Status[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
              </select>
            </label>
          ) : status ? (
            <span className={`mk-status s-${status}`}><span className="dot" />{STATUS[status]}</span>
          ) : null}
          {versions.length > 1 && (
            <select className="mk-ver" value={ver} onChange={(e) => { setVer(e.target.value); setIndex(0); }} aria-label="Version">
              {versions.map((v, i) => <option key={v.id} value={v.id}>{v.name}{i === versions.length - 1 ? " (latest)" : ""}</option>)}
            </select>
          )}
        </div>
        <div className="mk-top-r">
          <div className="mk-people" aria-label="People commenting">
            {people.map((p) => <span key={p} className="mk-av" title={p}>{initials(p)}</span>)}
          </div>
          {owner && <a className="mk-btn ghost" href={owner.clientView}>Client view</a>}
          {owner && <ShareButton />}
        </div>
      </header>

      <div className={`mk-body ${panel ? "" : "no-panel"}`}>
        <aside className="mk-side">
          <div className="mk-side-head">
            <h1>{gallery.title}</h1>
            {review?.message && <p className="mk-note-for">{review.message}</p>}
            {owner && (
              <label className="mk-switch">
                <span>Pause new comments</span>
                <input type="checkbox" checked={paused} onChange={(e) => { setPaused(e.target.checked); ownerSave({ paused: e.target.checked }); }} />
                <i aria-hidden />
              </label>
            )}
            {locked && <p className="mk-locked">Comments are paused for now.</p>}
          </div>

          <div className="mk-comments-bar">
            <b>Comments{mine.length ? ` (${mine.filter((n) => !n.resolved).length})` : ""}</b>
            <div className="mk-seg">
              <button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>Open</button>
              <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
            </div>
          </div>

          <div className="mk-comments">
            {pin && (
              <form className="mk-compose" onSubmit={post}>
                <div className="mk-compose-head">
                  <span className="mk-av me">{initials(owner ? studio.name : name || "You")}</span>
                  <span>{pin.t !== undefined ? <b>{clock(pin.t)}</b> : null}{pin.x !== undefined ? " · pinned spot" : ""}</span>
                  <button type="button" className="mk-x" onClick={() => setPin(null)} aria-label="Cancel">×</button>
                </div>
                <textarea
                  ref={box}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }}
                  placeholder="Write a comment…  (Enter to send)"
                  rows={3}
                />
                <div className="mk-compose-foot">
                  <span>{owner ? `as ${studio.name}` : name ? <>as {name} · <button type="button" className="link-btn" onClick={() => setAskName(() => () => {})}>change</button></> : ""}</span>
                  <button className="mk-btn primary sm" disabled={busy || !draft.trim()}>{busy ? "Saving…" : "Comment"}</button>
                </div>
                {error && <p className="error" style={{ margin: "6px 0 0" }}>{error}</p>}
              </form>
            )}

            {listed.length ? (
              <ol className="mk-thread-list">
                {listed.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    num={numbered.get(n.id)!}
                    active={active === n.id}
                    owner={!!owner}
                    busy={busy}
                    locked={locked}
                    onSelect={() => select(n)}
                    onReply={(text) => new Promise<boolean>((resolve) => withName(async () => resolve(!!(await send({ action: "reply", parentId: n.id, text })))))}
                    onResolve={() => withName(() => send({ action: n.resolved ? "reopen" : "resolve", parentId: n.id }))}
                    onDelete={() => send({ action: "delete", parentId: n.id })}
                  />
                ))}
              </ol>
            ) : !pin ? (
              <div className="mk-empty-c">
                <span className="mk-empty-ico" aria-hidden>
                  <svg viewBox="0 0 48 40" width="64" height="54"><rect x="6" y="4" width="36" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 28l4 6 4-6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 12h18M12 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </span>
                <p>{mine.length ? "All comments are resolved." : locked ? "No comments on this file." : <>Click anywhere on the {isVideo ? "video" : "photo"}<br />to leave a comment</>}</p>
                {!locked && <button className="link-btn" onClick={() => { setPin({ t: video.current ? Math.round(video.current.currentTime * 10) / 10 : undefined }); setTimeout(() => box.current?.focus(), 0); }}>or write a general comment</button>}
              </div>
            ) : null}
          </div>

          {!owner && (
            <div className="mk-finish">
              {done ? (
                <span className="mk-finished"><Check /> Thanks! {studio.name} has been told you&apos;re done.</span>
              ) : (
                <>
                  <span>Let {studio.name} know you finished reviewing</span>
                  <button className="mk-go" aria-label="I'm done reviewing" disabled={busy} onClick={() => withName(async () => { if (await send({ action: "finished" })) setDone(true); })}>
                    <Right />
                  </button>
                </>
              )}
            </div>
          )}
          {owner && owner.notes.length > 0 && <div className="mk-finish owner"><span>{owner.notes.join(" ")}</span></div>}
        </aside>

        <button className="mk-collapse" onClick={() => setPanel(!panel)} aria-label={panel ? "Hide comments" : "Show comments"}>{panel ? <Left /> : <Right />}</button>

        <main className="mk-main">
          <div className="mk-filebar">
            <span className="mk-filename">{isVideo ? <Film /> : <Photo />} {item.name}</span>
            <div className="mk-pager">
              <button className="mk-btn soft sm" disabled={index === 0} onClick={() => setIndex(index - 1)}><Left /> Prev</button>
              <select value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="File">
                {items.map((it, i) => <option key={it.id} value={i}>{i + 1} of {items.length} · {titleOf(it)}</option>)}
              </select>
              <button className="mk-btn soft sm" disabled={index >= items.length - 1} onClick={() => setIndex(index + 1)}>Next <Right /></button>
            </div>
            <div className="mk-file-actions">
              {approval ? (
                <button className="mk-btn ok sm" disabled={busy} onClick={() => withName(() => send({ action: "unapprove" }))} title={`Approved by ${approval.author} — click to undo`}><Check /> Approved</button>
              ) : (
                <button className="mk-btn primary sm" disabled={busy} onClick={() => withName(() => send({ action: "approve" }))}><Check /> Approve</button>
              )}
              {gallery.allowDownload && <a className="mk-icon" href={item.download} download={item.name} title="Download"><Download /></a>}
              <button className="mk-icon" title="Full screen" onClick={() => stage.current?.requestFullscreen?.()}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
              </button>
            </div>
          </div>

          <div className="mk-stage" ref={stage}>
            <div className="mk-frame" style={{ "--ar": ar } as React.CSSProperties}>
              {isVideo ? (
                <video
                  key={item.id}
                  ref={video}
                  src={item.src}
                  poster={item.full || undefined}
                  playsInline
                  preload="metadata"
                  onContextMenu={gallery.allowDownload ? undefined : (e) => e.preventDefault()}
                  onLoadedMetadata={(e) => {
                    setDur(e.currentTarget.duration || 0);
                    if (e.currentTarget.videoWidth) setAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight);
                  }}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                >
                  {item.captions?.map((c) => <track key={c.id} kind="captions" src={c.src} srcLang={c.lang ?? "en"} label={c.label} />)}
                </video>
              ) : (
                <img src={item.full} alt={titleOf(item)} draggable={false} onContextMenu={gallery.allowDownload ? undefined : (e) => e.preventDefault()} />
              )}
              {gallery.watermark && <Watermark spec={gallery.watermark} big />}
              <div className={`mk-hit ${locked ? "locked" : ""}`} onClick={placePin} title={locked ? undefined : "Click to comment here"}>
                {pinsShown.map((n) => (
                  <button
                    key={n.id}
                    className={`mk-pin ${n.resolved ? "done" : ""} ${active === n.id ? "on" : ""}`}
                    style={{ left: `${n.x}%`, top: `${n.y}%` }}
                    onClick={(e) => { e.stopPropagation(); select(n); document.getElementById(`note-${n.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}
                    aria-label={`Comment ${numbered.get(n.id)}`}
                  >{numbered.get(n.id)}</button>
                ))}
                {pin?.x !== undefined && <span className="mk-pin new" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>+</span>}
              </div>
              {isVideo && !playing && !pin && time === 0 && (
                <button className="mk-bigplay" onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label="Play">
                  <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                </button>
              )}
            </div>
          </div>

          {isVideo && (
            <div className="mk-controls">
              <div className="mk-scrub">
                <input
                  type="range" min={0} max={duration || 0} step={0.05} value={Math.min(time, duration || 0)}
                  onChange={(e) => { const t = Number(e.target.value); if (video.current) video.current.currentTime = t; setTime(t); }}
                  style={{ "--p": `${duration ? (time / duration) * 100 : 0}%` } as React.CSSProperties}
                  aria-label="Seek"
                />
                {duration > 0 && mine.filter((n) => n.t !== undefined && (filter === "all" || !n.resolved)).map((n) => (
                  <button key={n.id} className={`mk-mark ${n.resolved ? "done" : ""} ${active === n.id ? "on" : ""}`} style={{ left: `${Math.min(100, ((n.t ?? 0) / duration) * 100)}%` }}
                    onClick={() => { select(n); document.getElementById(`note-${n.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}
                    title={`${clock(n.t ?? 0)} · ${n.author}: ${n.text.slice(0, 60)}`} aria-label={`Comment ${numbered.get(n.id)}`} />
                ))}
              </div>
              <div className="mk-ctl-row">
                <div className="mk-ctl-l">
                  <button className="mk-icon" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                    {playing
                      ? <svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
                      : <svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
                  </button>
                  <button className="mk-icon" onClick={() => seek(Math.max(0, time - 5))} aria-label="Back 5 seconds" title="Back 5 seconds">
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
                  </button>
                  <button className="mk-speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label="Playback speed">{speed}x</button>
                </div>
                <span className="mk-time"><b>{clock(time)}</b> / {clock(duration)}</span>
                <div className="mk-ctl-r">
                  <button className="mk-icon" onClick={() => setVol(vol ? 0 : 1)} aria-label={vol ? "Mute" : "Unmute"}>
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />{vol ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>
                  </button>
                  <input className="mk-vol" type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume" style={{ "--p": `${vol * 100}%` } as React.CSSProperties} />
                </div>
              </div>
            </div>
          )}
        </main>
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
            <p className="sub">So {studio.name} knows who left each comment.</p>
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

function ShareButton() {
  const [done, setDone] = useState(false);
  return (
    <button className="mk-btn primary" onClick={async () => { try { await navigator.clipboard.writeText(location.href.split("?")[0]); setDone(true); setTimeout(() => setDone(false), 2000); } catch {} }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" /></svg>
      {done ? "Link copied" : "Share"}
    </button>
  );
}

function NoteCard({ note, num, active, owner, busy, locked, onSelect, onReply, onResolve, onDelete }: {
  note: Note; num: number; active: boolean; owner: boolean; busy: boolean; locked: boolean;
  onSelect: () => void; onReply: (text: string) => Promise<boolean>; onResolve: () => void; onDelete: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <li id={`note-${note.id}`} className={`mk-c ${note.resolved ? "done" : ""} ${active ? "on" : ""}`} onClick={onSelect}>
      <div className="mk-c-head">
        <span className="mk-num">{num}</span>
        <span className={`mk-av ${note.owner ? "studio" : ""}`}>{initials(note.author)}</span>
        <span className="mk-c-who"><b>{note.author}</b><span>{ago(note.at)}</span></span>
        <button
          className={`mk-resolve ${note.resolved ? "on" : ""}`}
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onResolve(); }}
          title={note.resolved ? "Reopen" : "Mark resolved"}
          aria-label={note.resolved ? "Reopen" : "Mark resolved"}
        ><Check /></button>
      </div>
      <p className="mk-c-text">{note.t !== undefined && <span className="mk-tc">{clock(note.t)}</span>}{note.text}</p>
      {note.replies.map((r) => (
        <div key={r.id} className="mk-reply">
          <span className={`mk-av sm ${r.owner ? "studio" : ""}`}>{initials(r.author)}</span>
          <div><b>{r.author}</b> <span className="mk-when">{ago(r.at)}</span><p className="mk-c-text">{r.text}</p></div>
        </div>
      ))}
      {replying ? (
        <form
          className="mk-reply-form"
          onClick={(e) => e.stopPropagation()}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            if (await onReply(text)) { setText(""); setReplying(false); }
          }}
        >
          <textarea autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button type="button" className="mk-btn ghost sm" onClick={() => setReplying(false)}>Cancel</button>
            <button className="mk-btn primary sm" disabled={busy || !text.trim()}>Reply</button>
          </div>
        </form>
      ) : (
        <div className="mk-c-actions" onClick={(e) => e.stopPropagation()}>
          {!locked && <button type="button" className="link-btn" onClick={() => setReplying(true)}>Reply</button>}
          {owner && (confirm
            ? <><button type="button" className="link-btn danger" onClick={onDelete}>Delete?</button><button type="button" className="link-btn" onClick={() => setConfirm(false)}>Keep</button></>
            : <button type="button" className="link-btn" onClick={() => setConfirm(true)}>Delete</button>)}
        </div>
      )}
    </li>
  );
}
