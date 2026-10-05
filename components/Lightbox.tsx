"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";
import { plural } from "@/lib/format";
import { Close, Download, Heart, Left, Note, Right } from "./icons";
import { Watermark } from "./Brand";

type Fav = { note: string };

type Props = {
  items: MediaItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  favs: Record<string, Fav>;
  onToggleFav: (id: string) => void;
  onNote: (id: string, note: string) => void;
  allowDownload: boolean;
  /** favorites and notes */
  picks: boolean;
  /** studio name to overlay while a payment hold is on */
  watermark?: string;
};

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MAX_ZOOM = 4;

export default function Lightbox({ items, index, onIndex, onClose, favs, onToggleFav, onNote, allowDownload, picks, watermark }: Props) {
  const item = items[index];
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [hiLoaded, setHiLoaded] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // zoom/pan state lives in a ref so gestures don't re-render
  const z = useRef({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{
    start?: Pt; startZ?: { s: number; x: number; y: number }; t0?: number;
    pinch?: { d: number; s: number; m: Pt; x: number; y: number };
    mode?: "pan" | "swipe-x" | "swipe-y" | "pinch" | null; dx?: number; dy?: number;
  }>({});
  const lastTap = useRef(0);

  const go = useCallback((d: 1 | -1) => {
    const n = index + d;
    if (n < 0 || n >= items.length) return;
    setDir(d > 0 ? "next" : "prev");
    onIndex(n);
  }, [index, items.length, onIndex]);

  // ----- transforms
  const applyZoom = useCallback((animate = false) => {
    const el = mediaRef.current;
    if (!el) return;
    const { s, x, y } = z.current;
    el.style.transition = animate ? "transform .3s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    el.style.cursor = s > 1 ? "grab" : "";
  }, []);

  const clampPan = () => {
    const st = stageRef.current;
    if (!st) return;
    const { s } = z.current;
    const mx = ((s - 1) * st.clientWidth) / 2, my = ((s - 1) * st.clientHeight) / 2;
    z.current.x = clamp(z.current.x, -mx, mx);
    z.current.y = clamp(z.current.y, -my, my);
  };

  const zoomAt = (p: Pt, s: number) => {
    const st = stageRef.current!.getBoundingClientRect();
    const c = { x: p.x - st.left - st.width / 2, y: p.y - st.top - st.height / 2 };
    const prev = z.current;
    // keep the point under the finger fixed while scaling
    const k = s / prev.s;
    z.current = { s, x: c.x - (c.x - prev.x) * k, y: c.y - (c.y - prev.y) * k };
    if (s <= 1) z.current = { s: 1, x: 0, y: 0 };
    clampPan();
  };

  const setSlide = (x: number, y: number, animate = false) => {
    const el = slideRef.current, root = rootRef.current;
    if (!el || !root) return;
    el.style.transition = animate ? "transform .3s cubic-bezier(.2,.8,.2,1), opacity .3s" : "none";
    el.style.transform = x || y ? `translate3d(${x}px, ${y}px, 0)` : "";
    const fade = clamp(1 - Math.abs(y) / 500, 0.35, 1);
    root.style.transition = animate ? "background .3s" : "none";
    root.style.background = `rgba(5,5,5,${fade})`;
  };

  // ----- reset on item change
  useEffect(() => {
    z.current = { s: 1, x: 0, y: 0 };
    applyZoom();
    setSlide(0, 0);
    setHiLoaded(false);
    setNoteOpen(false);
  }, [index, applyZoom]);

  // ----- preload neighbours
  useEffect(() => {
    for (const n of [items[index + 1], items[index - 1]]) {
      if (n?.kind === "photo") { const img = new Image(); img.src = n.full; }
    }
  }, [index, items]);

  // ----- keyboard + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === noteRef.current) {
        if (e.key === "Escape") { (document.activeElement as HTMLElement).blur(); setNoteOpen(false); }
        return;
      }
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
      else if (picks && e.key.toLowerCase() === "f") onToggleFav(item.id);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, onClose, onToggleFav, item.id]);

  // ----- trackpad pinch / ctrl+wheel zoom
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent) => {
      if (item.kind !== "photo") return;
      if (e.ctrlKey || z.current.s > 1) {
        e.preventDefault();
        if (e.ctrlKey) zoomAt({ x: e.clientX, y: e.clientY }, clamp(z.current.s * Math.exp(-e.deltaY * 0.01), 1, MAX_ZOOM));
        else { z.current.x -= e.deltaX; z.current.y -= e.deltaY; clampPan(); }
        applyZoom();
      }
    };
    st.addEventListener("wheel", onWheel, { passive: false });
    return () => st.removeEventListener("wheel", onWheel);
  });

  // ----- pointer gestures: swipe, swipe-down to close, pinch, pan, double-tap
  const onDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("video, button, a, textarea")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 1) {
      Object.assign(g, { start: { x: e.clientX, y: e.clientY }, startZ: { ...z.current }, t0: Date.now(), mode: null, dx: 0, dy: 0 });
    } else if (pointers.current.size === 2 && item.kind === "photo") {
      const [a, b] = [...pointers.current.values()];
      g.pinch = { d: dist(a, b), s: z.current.s, m: mid(a, b), x: z.current.x, y: z.current.y };
      g.mode = "pinch";
      setSlide(0, 0, true);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (g.mode === "pinch" && g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const m = mid(a, b);
      const s = clamp((g.pinch.s * dist(a, b)) / g.pinch.d, 1, MAX_ZOOM);
      z.current = { s: g.pinch.s, x: g.pinch.x + (m.x - g.pinch.m.x), y: g.pinch.y + (m.y - g.pinch.m.y) };
      zoomAt(m, s);
      applyZoom();
      return;
    }
    if (!g.start || pointers.current.size !== 1) return;
    const dx = e.clientX - g.start.x, dy = e.clientY - g.start.y;
    g.dx = dx; g.dy = dy;

    if (z.current.s > 1 || g.mode === "pan") {
      g.mode = "pan";
      z.current.x = g.startZ!.x + dx;
      z.current.y = g.startZ!.y + dy;
      clampPan();
      applyZoom();
      return;
    }
    if (!g.mode && Math.hypot(dx, dy) > 8) g.mode = Math.abs(dx) > Math.abs(dy) ? "swipe-x" : dy > 0 ? "swipe-y" : null;
    if (g.mode === "swipe-x") {
      // resist at the ends
      const atEnd = (dx > 0 && index === 0) || (dx < 0 && index === items.length - 1);
      setSlide(atEnd ? dx * 0.3 : dx, 0);
    } else if (g.mode === "swipe-y") setSlide(0, Math.max(0, dy));
  };

  const onUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.mode === "pinch") {
      if (pointers.current.size === 1) {
        // continue as a pan with the remaining finger
        const [p] = [...pointers.current.values()];
        Object.assign(g, { start: p, startZ: { ...z.current }, mode: "pan" });
      } else if (pointers.current.size === 0) {
        if (z.current.s < 1.05) { z.current = { s: 1, x: 0, y: 0 }; applyZoom(true); }
        g.mode = null;
      }
      return;
    }
    if (pointers.current.size) return;

    const dx = g.dx ?? 0, dy = g.dy ?? 0;
    const quick = Date.now() - (g.t0 ?? 0) < 260;
    if (g.mode === "swipe-x") {
      if (dx < -70 || (quick && dx < -30)) go(1);
      else if (dx > 70 || (quick && dx > 30)) go(-1);
      else setSlide(0, 0, true);
      if ((dx < 0 && index === items.length - 1) || (dx > 0 && index === 0)) setSlide(0, 0, true);
    } else if (g.mode === "swipe-y") {
      if (dy > 120 || (quick && dy > 50)) onClose();
      else setSlide(0, 0, true);
    } else if (!g.mode && Math.hypot(dx, dy) < 8 && item.kind === "photo") {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        zoomAt({ x: e.clientX, y: e.clientY }, z.current.s > 1 ? 1 : 2.5);
        applyZoom(true);
        lastTap.current = 0;
      } else lastTap.current = now;
    }
    g.mode = null;
  };

  const fav = favs[item.id];
  const hasNote = !!fav?.note;

  return (
    <div ref={rootRef} className={`lb ${item.kind === "video" ? "is-video" : ""}`} role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="lb-top">
        <div className="meta">
          <b>{item.name}</b>
          <small>{index + 1} of {plural(items.length, "item")}</small>
        </div>
        {picks && (
          <>
            <button className={`icon-btn ${fav ? "on" : ""}`} onClick={() => onToggleFav(item.id)} aria-pressed={!!fav} aria-label={fav ? "Remove from favorites" : "Add to favorites"} title="Favorite (F)">
              <Heart filled={!!fav} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setNoteOpen((o) => !o)}
              aria-label="Add a note" title="Note"
              style={hasNote ? { color: "var(--accent)" } : undefined}
            >
              <Note />
            </button>
          </>
        )}
        {allowDownload && (
          <a className="icon-btn" href={item.download} download={item.name} aria-label="Download" title="Download">
            <Download />
          </a>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)"><Close /></button>
      </div>

      <div
        ref={stageRef}
        className="lb-stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div key={item.id} ref={slideRef} className={`lb-slide ${dir ? `enter-${dir}` : ""}`}>
          <div ref={mediaRef} className="lb-photo" style={{ transformOrigin: "center center" }}>
            {item.kind === "photo" ? (
              <>
                <img src={item.thumb} alt="" draggable={false} onContextMenu={watermark ? (e) => e.preventDefault() : undefined} />
                <img
                  className={`hi ${hiLoaded ? "loaded" : ""}`}
                  src={item.full}
                  alt={item.name}
                  draggable={false}
                  onLoad={() => setHiLoaded(true)}
                  ref={(el) => { if (el?.complete && el.naturalWidth && !hiLoaded) setHiLoaded(true); }}
                />
              </>
            ) : (
              <video
                src={item.src}
                poster={item.full}
                controls
                autoPlay
                playsInline
                preload="metadata"
                controlsList={allowDownload ? undefined : "nodownload"}
                disablePictureInPicture={!!watermark}
                onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
                style={{ position: "absolute", inset: 0 }}
              />
            )}
            {watermark && <Watermark text={watermark} count={48} />}
          </div>
        </div>
        <button className="lb-arrow prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous"><Left /></button>
        <button className="lb-arrow next" onClick={() => go(1)} disabled={index === items.length - 1} aria-label="Next"><Right /></button>
      </div>

      {noteOpen && (
        <div className="lb-note">
          <div className="box">
            <textarea
              ref={noteRef}
              autoFocus
              rows={1}
              placeholder={item.kind === "video" ? "Note for this clip — e.g. trim the intro, use 0:12–0:20" : "Note for this photo — e.g. crop tighter, use for the cover"}
              value={fav?.note ?? ""}
              onChange={(e) => onNote(item.id, e.target.value)}
            />
            <button className="btn primary" style={{ height: 36 }} onClick={() => setNoteOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
