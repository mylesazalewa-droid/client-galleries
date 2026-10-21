"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { BrandProfile } from "@/lib/brand";
import type { MarkOption, WatermarkLayout } from "@/lib/types";
import WatermarkPanel from "./WatermarkPanel";

const PRESETS = ["#e9b07b", "#d4a24c", "#8fb8a8", "#9db4e0", "#c99bd6", "#e7e2d8", "#e05d5d", "#5db0e0"];

async function api(url: string, init: RequestInit) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}

/** One white-label brand: what an agency's clients see instead of your studio. */
export default function BrandProfileEditor({ profile, logo: initialLogo, galleries, marks, demo }: {
  profile: BrandProfile; logo?: string; demo: boolean;
  galleries: { id: string; title: string; slug: string }[];
  marks: { options: MarkOption[]; defaultId: string; opacity: number; layout: WatermarkLayout };
}) {
  const router = useRouter();
  const [f, setF] = useState({
    name: profile.name,
    tagline: profile.tagline ?? "",
    email: profile.email ?? "",
    website: profile.website ?? "",
    accent: profile.accent ?? "#e9b07b",
  });
  const [logo, setLogo] = useState(initialLogo);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const say = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const url = `/api/admin/brands/${profile.id}`;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (demo) return say("Demo mode — connect Google to save.");
    setBusy("save");
    const res = await api(url, { method: "PATCH", body: JSON.stringify(f) });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't save");
    say("Brand saved. Galleries using it update right away.");
    router.refresh();
  }

  async function uploadLogo(file: File) {
    if (demo) return say("Demo mode — connect Google to upload.");
    setBusy("logo");
    const start = await api("/api/admin/brand", { method: "POST", body: JSON.stringify({ kind: "logo", name: `${profile.name}-${file.name}`, type: file.type, size: file.size }) });
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
    const res = await api(url, { method: "PATCH", body: JSON.stringify({ logoId: id }) });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't save");
    setLogo(URL.createObjectURL(file));
    say("Logo updated. It's also available as a watermark below.");
    router.refresh();
  }

  async function removeLogo() {
    if (demo) return;
    const res = await api(url, { method: "PATCH", body: JSON.stringify({ logoId: null }) });
    if (!res.ok) return say(res.error || "Couldn't remove");
    setLogo(undefined);
    router.refresh();
  }

  async function remove() {
    if (demo) return say("Demo mode — nothing to delete.");
    setBusy("delete");
    const res = await api(url, { method: "DELETE" });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't delete");
    router.push("/admin/brands");
    router.refresh();
  }

  return (
    <div className="brand-ed">
      <div className="admin-head">
        <div>
          <div className="eyebrow"><Link href="/admin/brands">Client brands</Link></div>
          <h1 className="serif">{f.name || "Untitled brand"}</h1>
          <p className="hint" style={{ margin: "8px 0 0" }}>Galleries set to this brand show it instead of yours.</p>
        </div>
      </div>

      {/* How the top of a gallery will look */}
      <div className="wl-preview" style={{ "--accent": f.accent } as React.CSSProperties}>
        <div className="wl-bar">
          {logo ? <img src={logo} alt="" /> : <span className="serif">{f.name}</span>}
          <span className="wl-pill">Preview</span>
        </div>
        <div className="wl-hero">
          <div className="eyebrow">Client name · Date</div>
          <div className="serif wl-title">Your gallery title</div>
          <span className="btn primary" style={{ pointerEvents: "none" }}>Download all</span>
        </div>
        <div className="wl-foot">{f.name}{f.email ? ` · ${f.email}` : ""}</div>
      </div>

      <div className="brand-cols">
        <form className="panel" onSubmit={save}>
          <h3>Brand details</h3>
          <label className="field"><span>Brand name</span><input required value={f.name} onChange={set("name")} /></label>
          <label className="field"><span>Tagline (optional)</span><input value={f.tagline} onChange={set("tagline")} placeholder="Brand films & live events" /></label>
          <div className="field-row">
            <label className="field"><span>Contact email</span><input type="email" value={f.email} onChange={set("email")} placeholder="hello@agency.com" /></label>
            <label className="field"><span>Website</span><input value={f.website} onChange={set("website")} placeholder="agency.com" /></label>
          </div>
          <p className="hint" style={{ marginTop: -4 }}>Emails still go out from your Gmail, but under this brand&apos;s name, and replies go to the contact email above.</p>
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
            {busy === "save" ? "Saving…" : "Save brand"}
          </button>
        </form>

        <div className="brand-media">
          <div className="panel">
            <h3>Logo</h3>
            {logo ? <div className="logo-prev"><img src={logo} alt="Logo" /></div> : <div className="slot-empty">No logo — the brand name is shown instead</div>}
            <p className="hint">A white or light logo on a transparent background (PNG) looks best.</p>
            <div className="actions" style={{ justifyContent: "flex-start", marginTop: 0 }}>
              <button type="button" className="btn" disabled={busy === "logo"} onClick={() => input.current?.click()}>{busy === "logo" ? "Uploading…" : "Upload"}</button>
              {logo && <button type="button" className="btn danger" onClick={removeLogo}>Remove</button>}
            </div>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLogo(file); e.target.value = ""; }} />
          </div>

          <WatermarkPanel
            key={marks.options.map((o) => o.id).join()}
            options={marks.options}
            defaultId={marks.defaultId}
            opacity={marks.opacity}
            layout={marks.layout}
            demo={demo}
            say={say}
            saveUrl={url}
            fallbackId={logo ? `logo:${profile.id}` : "text"}
            intro="Shown over previews while one of this brand's galleries is held for payment. Your own SOW mark is never offered here."
          />

          <div className="panel">
            <h3>Used by</h3>
            {galleries.length ? (
              <ul className="wl-used">
                {galleries.map((g) => <li key={g.id}><Link href={`/admin/g/${g.id}`}>{g.title}</Link> <a href={`/g/${g.slug}?as=client`} target="_blank" rel="noreferrer">View as client ↗</a></li>)}
              </ul>
            ) : (
              <p className="hint" style={{ marginTop: 0 }}>No galleries yet. Open a gallery, go to <b>Gallery settings → Brand</b> and pick “{f.name}”.</p>
            )}
          </div>

          <div className="panel">
            <h3>Delete brand</h3>
            <p className="hint" style={{ marginTop: 0 }}>Galleries using it switch back to your own studio brand. Nothing in Drive is deleted.</p>
            {confirmDelete ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn danger" disabled={busy === "delete"} onClick={remove}>Yes, delete “{f.name}”</button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>Delete…</button>
            )}
          </div>
        </div>
      </div>
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}
