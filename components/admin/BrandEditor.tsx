"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Brand } from "@/lib/brand";
import type { Studio } from "@/lib/types";

const PRESETS = ["#e9b07b", "#d4a24c", "#8fb8a8", "#9db4e0", "#c99bd6", "#e7e2d8"];

async function api(url: string, init: RequestInit) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}

export default function BrandEditor({ brand, studio, demo }: { brand: Brand; studio: Studio; demo: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: brand.name ?? studio.name,
    tagline: brand.tagline ?? studio.tagline,
    headline: brand.headline ?? "",
    email: brand.email ?? studio.email ?? "",
    website: brand.website ?? studio.url ?? "",
    accent: brand.accent ?? "#e9b07b",
  });
  const [logo, setLogo] = useState(studio.logo);
  const [landing, setLanding] = useState(studio.landing);
  const [mark, setMark] = useState(studio.watermark);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const say = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (demo) return say("Demo mode — connect Google to save branding.");
    setBusy("save");
    const res = await api("/api/admin/brand", { method: "PATCH", body: JSON.stringify(f) });
    setBusy("");
    if (res.ok) { say("Branding saved. It shows on every page within a minute."); router.refresh(); }
    else say(res.error || "Couldn't save");
  }

  async function upload(kind: "logo" | "landing" | "watermark", file: File) {
    if (demo) return say("Demo mode — connect Google to upload.");
    setBusy(kind);
    const start = await api("/api/admin/brand", { method: "POST", body: JSON.stringify({ kind, name: file.name, type: file.type, size: file.size }) });
    if (!start.ok) { setBusy(""); return say(start.error || "Couldn't start the upload"); }
    const id = await new Promise<string | null>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", start.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.onload = () => { try { resolve(xhr.status < 300 ? JSON.parse(xhr.responseText).id : null); } catch { resolve(null); } };
      xhr.onerror = () => resolve(null);
      xhr.send(file);
    });
    if (!id) { setBusy(""); return say("Upload failed. Try again."); }
    const isVideo = file.type.startsWith("video/");
    const res = await api("/api/admin/brand", {
      method: "PATCH",
      body: JSON.stringify(kind === "logo" ? { logoId: id } : kind === "watermark" ? { watermarkId: id } : { landingId: id, landingKind: isVideo ? "video" : "photo" }),
    });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't save");
    const local = URL.createObjectURL(file);
    if (kind === "logo") setLogo(local);
    else if (kind === "watermark") setMark(local);
    else setLanding({ kind: isVideo ? "video" : "photo", src: local });
    say(kind === "logo" ? "Logo updated." : kind === "watermark" ? "Watermark updated." : "Landing background updated.");
    router.refresh();
  }

  async function remove(kind: "logo" | "landing" | "watermark") {
    if (demo) return;
    const res = await api("/api/admin/brand", { method: "PATCH", body: JSON.stringify(kind === "logo" ? { logoId: null } : kind === "watermark" ? { watermarkId: null } : { landingId: null }) });
    if (!res.ok) return say(res.error || "Couldn't remove");
    if (kind === "logo") setLogo(undefined);
    else if (kind === "watermark") setMark("/watermark.png");
    else setLanding(undefined);
    router.refresh();
  }

  return (
    <div className="brand-ed">
      <div className="admin-head">
        <div>
          <h1 className="serif">Branding</h1>
          <p className="hint" style={{ margin: "8px 0 0" }}>Shown on your landing page and every client gallery.</p>
        </div>
        <a className="btn" href="/" target="_blank" rel="noreferrer">View landing page ↗</a>
      </div>

      <div className="brand-cols">
        <form className="panel" onSubmit={save}>
          <h3>Studio details</h3>
          <label className="field"><span>Studio name</span><input required value={f.name} onChange={set("name")} /></label>
          <label className="field"><span>Tagline</span><input value={f.tagline} onChange={set("tagline")} placeholder="Brand films, events and stills" /></label>
          <label className="field"><span>Landing headline (optional)</span><input value={f.headline} onChange={set("headline")} placeholder={f.name || "Uses your studio name"} /></label>
          <div className="field-row">
            <label className="field"><span>Contact email</span><input type="email" value={f.email} onChange={set("email")} /></label>
            <label className="field"><span>Website</span><input value={f.website} onChange={set("website")} placeholder="mylesmedia.com" /></label>
          </div>
          <div className="field">
            <span>Accent color</span>
            <div className="swatches">
              {PRESETS.map((c) => (
                <button type="button" key={c} className={`swatch ${f.accent.toLowerCase() === c ? "on" : ""}`} style={{ background: c }} onClick={() => setF({ ...f, accent: c })} aria-label={`Use ${c}`} />
              ))}
              <label className="swatch custom" title="Pick any color">
                <input type="color" value={f.accent} onChange={set("accent")} aria-label="Custom accent color" />
              </label>
              <code>{f.accent}</code>
            </div>
          </div>
          <button className="btn primary" disabled={busy === "save"} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
            {busy === "save" ? "Saving…" : "Save details"}
          </button>
        </form>

        <div className="brand-media">
          <MediaSlot
            title="Logo"
            hint="A white or light logo on a transparent background (PNG) looks best over your photos."
            accept="image/*"
            busy={busy === "logo"}
            onPick={(file) => upload("logo", file)}
            onRemove={logo ? () => remove("logo") : undefined}
          >
            {logo ? <div className="logo-prev"><img src={logo} alt="Logo" /></div> : <div className="slot-empty">No logo — your studio name is shown instead</div>}
          </MediaSlot>
          <MediaSlot
            title="Watermark"
            hint="Tiled over previews while a gallery is held for payment. A white mark on a transparent PNG works best."
            accept="image/png,image/webp"
            busy={busy === "watermark"}
            onPick={(file) => upload("watermark", file)}
            onRemove={mark && mark !== "/watermark.png" ? () => remove("watermark") : undefined}
          >
            <div className="wm-prev"><span className="wm-img" style={{ backgroundImage: `url("${mark}")` }} /></div>
          </MediaSlot>
          <MediaSlot
            title="Landing background"
            hint="A short, muted reel (MP4 under ~30 MB) or a wide photo. It fills the frame on your landing page."
            accept="image/*,video/*"
            busy={busy === "landing"}
            onPick={(file) => upload("landing", file)}
            onRemove={landing ? () => remove("landing") : undefined}
          >
            {landing?.kind === "video" ? (
              <video className="land-prev" src={landing.src} poster={landing.poster} muted loop autoPlay playsInline />
            ) : landing ? (
              <img className="land-prev" src={landing.src} alt="" />
            ) : (
              <div className="slot-empty">No background — a soft glow in your accent color is used</div>
            )}
          </MediaSlot>
        </div>
      </div>
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}

function MediaSlot({ title, hint, accept, busy, onPick, onRemove, children }: {
  title: string; hint: string; accept: string; busy: boolean; onPick: (f: File) => void; onRemove?: () => void; children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="panel">
      <h3>{title}</h3>
      {children}
      <p className="hint">{hint}</p>
      <div className="actions" style={{ justifyContent: "flex-start", marginTop: 0 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload"}</button>
        {onRemove && <button type="button" className="btn danger" onClick={onRemove}>Remove</button>}
      </div>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </div>
  );
}
