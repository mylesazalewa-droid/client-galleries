"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Gallery, MediaItem, Studio } from "@/lib/types";
import { formatDate, formatDuration, plural } from "@/lib/format";
import Lightbox from "./Lightbox";
import ThemeToggle from "./ThemeToggle";
import { Check, Down, Download, Film, Heart, Note, Photo, Play, Send } from "./icons";

type Fav = { note: string };
type Filter = "all" | "photos" | "videos" | "favorites";

export default function GalleryView({ gallery, studio }: { gallery: Gallery; studio: Studio }) {
  const favKey = `favs:${gallery.slug}`;
  const [favs, setFavs] = useState<Record<string, Fav>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const gridTop = useRef<HTMLDivElement>(null);
  const loadedFavs = useRef(false);

  // favorites persist on this device until sent
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem(favKey) || "{}")); } catch {}
    loadedFavs.current = true;
  }, [favKey]);
  useEffect(() => {
    if (!loadedFavs.current) return;
    try { localStorage.setItem(favKey, JSON.stringify(favs)); } catch {}
  }, [favs, favKey]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const photos = gallery.items.filter((i) => i.kind === "photo").length;
  const videos = gallery.items.length - photos;
  const favCount = Object.keys(favs).filter((id) => gallery.items.some((i) => i.id === id)).length;

  const visible = useMemo(() => {
    switch (filter) {
      case "photos": return gallery.items.filter((i) => i.kind === "photo");
      case "videos": return gallery.items.filter((i) => i.kind === "video");
      case "favorites": return gallery.items.filter((i) => favs[i.id]);
      default: return gallery.items;
    }
  }, [filter, gallery.items, favs]);

  // the lightbox keeps the list it was opened with, so un-hearting in Favorites doesn't jump
  const [lbItems, setLbItems] = useState<MediaItem[]>([]);

  const toggleFav = useCallback((id: string) => {
    setFavs((f) => {
      const next = { ...f };
      if (next[id]) delete next[id];
      else next[id] = { note: "" };
      return next;
    });
  }, []);
  const setNote = useCallback((id: string, note: string) => {
    setFavs((f) => ({ ...f, [id]: { note } }));
  }, []);

  // Back button / swipe-back closes the lightbox instead of leaving the page.
  const openAt = (i: number) => {
    setLbItems(visible);
    setOpen(i);
    if (!history.state?.lb) history.pushState({ ...history.state, lb: true }, "");
  };
  const close = useCallback(() => {
    if (history.state?.lb) history.back();
    else setOpen(null);
  }, []);
  useEffect(() => {
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const scrollToGrid = () => gridTop.current?.scrollIntoView({ behavior: "smooth" });
  const pick = (f: Filter) => {
    setFilter(f);
    if (window.scrollY > (heroRef.current?.offsetHeight ?? 0)) scrollToGrid();
  };

  const meta = [gallery.client, formatDate(gallery.date)].filter(Boolean).join("  ·  ");
  const countLine = [photos && plural(photos, "photo"), videos && plural(videos, "film")].filter(Boolean).join(" · ");
  const cover = gallery.cover;

  return (
    <>
      <section className="hero" ref={heroRef}>
        {cover && <img className="hero-img" src={cover.full} alt="" fetchPriority="high" />}
        <div className="hero-top">
          {studio.url ? (
            <a href={studio.url} className="brand serif">{studio.name}</a>
          ) : (
            <span className="brand serif">{studio.name}</span>
          )}
          <ThemeToggle className="icon-btn" />
        </div>
        <div className="hero-body">
          {meta && <div className="eyebrow">{meta}</div>}
          <h1 className="serif">{gallery.title}</h1>
          {gallery.message && <p>{gallery.message}</p>}
          <div className="hero-actions">
            <button className="btn glass" onClick={scrollToGrid}>View gallery <Down /></button>
            <span className="hero-meta">{countLine}</span>
          </div>
        </div>
      </section>

      <div ref={gridTop} />
      <nav className="toolbar" aria-label="Gallery">
        <div className="title serif" style={{ opacity: pastHero ? 1 : 0, transition: "opacity .3s" }}>{gallery.title}</div>
        <div className="tabs" role="tablist">
          <Tab on={filter === "all"} onClick={() => pick("all")} n={gallery.items.length}>All</Tab>
          {photos > 0 && videos > 0 && (
            <>
              <Tab on={filter === "photos"} onClick={() => pick("photos")} n={photos} icon={<Photo />}><span className="label-long">Photos</span></Tab>
              <Tab on={filter === "videos"} onClick={() => pick("videos")} n={videos} icon={<Film />}><span className="label-long">Films</span></Tab>
            </>
          )}
          <Tab on={filter === "favorites"} onClick={() => pick("favorites")} n={favCount} icon={<Heart filled={filter === "favorites"} />}>
            <span className="label-long">Favorites</span>
          </Tab>
        </div>
        <div className="right">
          {gallery.allowDownload && (
            <details className="menu">
              <summary className="btn" aria-label="Download">
                <Download /><span className="label-long">Download</span>
              </summary>
              <div className="menu-pop">
                <a href={gallery.zip} download>Everything <span>.zip</span></a>
                {photos > 0 && videos > 0 && (
                  <>
                    <a href={`${gallery.zip}?only=photos`} download>Photos only <span>{photos}</span></a>
                    <a href={`${gallery.zip}?only=videos`} download>Films only <span>{videos}</span></a>
                  </>
                )}
              </div>
            </details>
          )}
        </div>
      </nav>

      <main className="wrap">
        {visible.length ? (
          <div className="grid" key={filter}>
            {visible.map((item, i) => (
              <Tile
                key={item.id}
                item={item}
                delay={Math.min(i, 14) * 35}
                fav={favs[item.id]}
                onOpen={() => openAt(i)}
                onFav={() => toggleFav(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="serif">No favorites yet</div>
            Tap the heart on anything you&apos;d like to keep or use.
          </div>
        )}
        <p className="foot">
          {studio.name}
          {studio.email && <> · <a href={`mailto:${studio.email}`}>{studio.email}</a></>}
        </p>
      </main>

      {favCount > 0 && open === null && (
        <div className="selbar">
          <span className="count"><Heart filled /> {favCount} selected</span>
          {filter !== "favorites" && <button className="btn" onClick={() => pick("favorites")}>Review</button>}
          <button className="btn primary" onClick={() => setSending(true)}><Send /> Send picks</button>
        </div>
      )}

      {open !== null && lbItems[open] && (
        <Lightbox
          items={lbItems}
          index={open}
          onIndex={setOpen}
          onClose={close}
          favs={favs}
          onToggleFav={toggleFav}
          onNote={setNote}
          allowDownload={gallery.allowDownload}
        />
      )}

      {sending && (
        <SendDialog
          gallery={gallery}
          studio={studio}
          favs={favs}
          onClose={() => setSending(false)}
        />
      )}
    </>
  );
}

function Tab({ on, onClick, n, icon, children }: { on: boolean; onClick: () => void; n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button className="tab" role="tab" aria-selected={on} onClick={onClick}>
      {icon}{children}<span className="n">{n}</span>
    </button>
  );
}

function Tile({ item, delay, fav, onOpen, onFav }: { item: MediaItem; delay: number; fav?: Fav; onOpen: () => void; onFav: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const r = item.width / item.height;
  return (
    <div
      className="tile"
      style={{ "--r": r.toFixed(4), "--d": `${delay}ms` } as React.CSSProperties}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      aria-label={`${item.kind === "video" ? "Play" : "Open"} ${item.name}`}
    >
      <i />
      <img
        src={item.thumb}
        alt=""
        loading="lazy"
        decoding="async"
        className={loaded ? "loaded" : ""}
        onLoad={() => setLoaded(true)}
        ref={(el) => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true); }}
      />
      <span className="shade" />
      {item.kind === "video" && (
        <>
          <span className="play"><span><Play /></span></span>
          {item.duration ? <span className="dur">{formatDuration(item.duration)}</span> : null}
        </>
      )}
      {fav?.note ? <span className="note-dot" title={fav.note}><Note /></span> : null}
      <button
        className={`fav ${fav ? "on" : ""}`}
        onClick={(e) => { e.stopPropagation(); onFav(); }}
        aria-pressed={!!fav}
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart filled={!!fav} />
      </button>
    </div>
  );
}

function SendDialog({ gallery, studio, favs, onClose }: { gallery: Gallery; studio: Studio; favs: Record<string, Fav>; onClose: () => void }) {
  const picks = gallery.items.filter((i) => favs[i.id]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const first = studio.name.split(" ")[0];

  useEffect(() => {
    try {
      const who = JSON.parse(localStorage.getItem("who") || "{}");
      if (who.name) setName(who.name);
      if (who.email) setEmail(who.email);
    } catch {}
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setErr("");
    try { localStorage.setItem("who", JSON.stringify({ name, email })); } catch {}
    const res = await fetch("/api/selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: gallery.slug, name, email, message, picks: picks.map((p) => ({ id: p.id, note: favs[p.id]?.note })) }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
    if (res.ok) setState("done");
    else { setState("idle"); setErr(res.error || "Something went wrong."); }
  }

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="send-title">
        {state === "done" ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div className="lock"><div className="badge" style={{ color: "var(--accent)" }}><Check /></div></div>
            <h2 id="send-title" className="serif">Sent — thank you</h2>
            <p className="sub">{first} has your {plural(picks.length, "pick")}. Your hearts stay saved here if you want to add more later.</p>
            <button className="btn primary" onClick={onClose}>Back to gallery</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="send-title" className="serif">Send your picks</h2>
            <p className="sub">{plural(picks.length, "item")} from {gallery.title}{picks.some((p) => favs[p.id]?.note) ? ", with your notes" : ""}.</p>
            <div className="thumbs">
              {picks.slice(0, 30).map((p) => <img key={p.id} src={p.thumb} alt={p.name} title={p.name} />)}
            </div>
            <label className="field"><span>Your name</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="field"><span>Email (so {first} can reply)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="field"><span>Anything else? (optional)</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We'd love the vertical cut for Instagram by Friday." />
            </label>
            {err && <p className="error" role="alert">{err}</p>}
            <div className="actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={state === "busy"}><Send /> {state === "busy" ? "Sending…" : "Send"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
