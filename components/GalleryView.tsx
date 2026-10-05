"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Gallery, MediaItem, Section, Studio } from "@/lib/types";
import { formatDate, formatDuration, plural } from "@/lib/format";
import { Brand, Watermark } from "./Brand";
import Lightbox from "./Lightbox";
import ThemeToggle from "./ThemeToggle";
import { Check, Down, Download, Film, Heart, Lock, Note, Photo, Play, Send } from "./icons";

type Fav = { note: string };
type Filter = "all" | "photos" | "videos" | "favorites";

type Props = {
  gallery: Gallery;
  studio: Studio;
  /** set when the owner is viewing: shows a banner with a link to the client view */
  owner?: { clientView: string; notes: string[] };
};

export default function GalleryView({ gallery, studio, owner }: Props) {
  const favKey = `favs:${gallery.slug}`;
  const picksOn = gallery.picks;
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
    if (!picksOn) return;
    try { setFavs(JSON.parse(localStorage.getItem(favKey) || "{}")); } catch {}
    loadedFavs.current = true;
  }, [favKey, picksOn]);
  useEffect(() => {
    if (!loadedFavs.current) return;
    try { localStorage.setItem(favKey, JSON.stringify(favs)); } catch {}
  }, [favs, favKey]);

  // Let the studio know the gallery was opened (once per browser session).
  useEffect(() => {
    if (owner) return;
    const key = `seen:${gallery.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: gallery.slug }), keepalive: true }).catch(() => {});
  }, [gallery.slug, owner]);

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

  // Sections: main area first, then each section in order.
  const order = useMemo(() => ["", ...gallery.sections.map((s) => s.id)], [gallery.sections]);
  const groupOf = useCallback((i: MediaItem) => (order.includes(i.section) ? i.section : ""), [order]);

  const visible = useMemo(() => {
    const list = (() => {
      switch (filter) {
        case "photos": return gallery.items.filter((i) => i.kind === "photo");
        case "videos": return gallery.items.filter((i) => i.kind === "video");
        case "favorites": return gallery.items.filter((i) => favs[i.id]);
        default: return gallery.items;
      }
    })();
    return [...list].sort((a, b) => order.indexOf(groupOf(a)) - order.indexOf(groupOf(b)));
  }, [filter, gallery.items, favs, order, groupOf]);

  const groups = useMemo(() => {
    const named = new Map<string, Section>(gallery.sections.map((s) => [s.id, s]));
    return order
      .map((id) => ({ id, name: named.get(id)?.name ?? "", items: visible.filter((i) => groupOf(i) === id) }))
      .filter((g) => g.items.length);
  }, [order, visible, gallery.sections, groupOf]);
  const sectioned = gallery.sections.length > 0;

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
  const openItem = (item: MediaItem) => {
    setLbItems(visible);
    setOpen(visible.indexOf(item));
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
  const jump = (id: string) => document.getElementById(`sec-${id || "main"}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const meta = [gallery.client, formatDate(gallery.date)].filter(Boolean).join("  ·  ");
  const countLine = [photos && plural(photos, "photo"), videos && plural(videos, "film")].filter(Boolean).join(" · ");
  const cover = gallery.cover;
  const showTabs = (photos > 0 && videos > 0) || picksOn;
  let tileIndex = 0;

  return (
    <>
      {owner && (
        <div className="owner-bar">
          <span><b>Owner view.</b> {owner.notes.length ? owner.notes.join(" ") : "You see everything here."}</span>
          <a className="btn" href={owner.clientView}>See what clients see</a>
          <a className="btn" href="/admin">Dashboard</a>
        </div>
      )}
      <section className="hero" ref={heroRef}>
        {cover && <img className="hero-img" src={cover.full} alt="" fetchPriority="high" />}
        <div className="hero-top">
          <Brand studio={studio} />
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
        <div className="tabs" role="tablist" style={showTabs ? undefined : { visibility: "hidden" }}>
          <Tab on={filter === "all"} onClick={() => pick("all")} n={gallery.items.length}>All</Tab>
          {photos > 0 && videos > 0 && (
            <>
              <Tab on={filter === "photos"} onClick={() => pick("photos")} n={photos} icon={<Photo />}><span className="label-long">Photos</span></Tab>
              <Tab on={filter === "videos"} onClick={() => pick("videos")} n={videos} icon={<Film />}><span className="label-long">Films</span></Tab>
            </>
          )}
          {picksOn && (
            <Tab on={filter === "favorites"} onClick={() => pick("favorites")} n={favCount} icon={<Heart filled={filter === "favorites"} />}>
              <span className="label-long">Favorites</span>
            </Tab>
          )}
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
                {gallery.sections.map((sec) => {
                  const n = gallery.items.filter((i) => i.section === sec.id).length;
                  return n ? <a key={sec.id} href={`${gallery.zip}?section=${encodeURIComponent(sec.id)}`} download>{sec.name} <span>{n}</span></a> : null;
                })}
              </div>
            </details>
          )}
        </div>
      </nav>

      {gallery.hold && (
        <div className="hold-bar">
          <Lock /> <span><b>Preview only.</b> Full-resolution downloads unlock once the project is paid.</span>
        </div>
      )}

      <main className="wrap">
        {sectioned && groups.length > 1 && (
          <div className="sec-nav">
            {groups.map((g) => (
              <button key={g.id || "main"} className="chip" onClick={() => jump(g.id)}>
                {g.name || "Main"} <span>{g.items.length}</span>
              </button>
            ))}
          </div>
        )}
        {visible.length ? (
          groups.map((group) => (
            <section key={`${filter}-${group.id}`} id={`sec-${group.id || "main"}`} className="sec">
              {sectioned && group.id && (
                <header className="sec-head">
                  <h2 className="serif">{group.name || "Main"}</h2>
                  <span>{plural(group.items.length, "item")}</span>
                  {gallery.allowDownload && group.id && (
                    <a className="link-dl" href={`${gallery.zip}?section=${encodeURIComponent(group.id)}`} download><Download /> Download section</a>
                  )}
                </header>
              )}
              <div className="grid">
                {group.items.map((item) => (
                  <Tile
                    key={item.id}
                    item={item}
                    delay={Math.min(tileIndex++, 14) * 35}
                    fav={favs[item.id]}
                    picks={picksOn}
                    watermark={gallery.hold ? studio.name : undefined}
                    onOpen={() => openItem(item)}
                    onFav={() => toggleFav(item.id)}
                    canDownload={gallery.allowDownload}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="empty">
            {filter === "favorites" ? (
              <><div className="serif">No favorites yet</div>Tap the heart on anything you&apos;d like to keep or use.</>
            ) : (
              <><div className="serif">Nothing here yet</div>Check back soon.</>
            )}
          </div>
        )}
        <p className="foot">
          {studio.name}
          {studio.email && <> · <a href={`mailto:${studio.email}`}>{studio.email}</a></>}
        </p>
      </main>

      {picksOn && favCount > 0 && open === null && (
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
          picks={picksOn}
          watermark={gallery.hold ? studio.name : undefined}
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

type TileProps = {
  item: MediaItem; delay: number; fav?: Fav; picks: boolean; watermark?: string;
  onOpen: () => void; onFav: () => void; canDownload: boolean;
};

function Tile({ item, delay, fav, picks, watermark, onOpen, onFav, canDownload }: TileProps) {
  const [loaded, setLoaded] = useState(false);
  const r = item.width / item.height;
  return (
    <div
      className="tile"
      style={{ "--r": r.toFixed(4), "--d": `${delay}ms` } as React.CSSProperties}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
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
        draggable={false}
        className={loaded ? "loaded" : ""}
        onLoad={() => setLoaded(true)}
        ref={(el) => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true); }}
      />
      {watermark && <Watermark text={watermark} />}
      <span className="shade" />
      {item.kind === "video" && (
        <>
          <span className="play"><span><Play /></span></span>
          {item.duration ? <span className="dur">{formatDuration(item.duration)}</span> : null}
        </>
      )}
      {picks && fav?.note ? <span className="note-dot" title={fav.note}><Note /></span> : null}
      {picks && (
        <button
          className={`fav ${fav ? "on" : ""}`}
          onClick={(e) => { e.stopPropagation(); onFav(); }}
          aria-pressed={!!fav}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart filled={!!fav} />
        </button>
      )}
      {canDownload && (
        <a
          className={`dl ${picks ? "" : "top"}`}
          href={item.download}
          download={item.name}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Download ${item.name}`}
          title="Download"
        >
          <Download />
        </a>
      )}
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
