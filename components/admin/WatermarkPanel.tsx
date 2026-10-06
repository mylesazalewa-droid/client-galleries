"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { MarkOption, WatermarkLayout } from "@/lib/types";
import { Watermark } from "../Brand";

async function api(url: string, init: RequestInit) {
  return fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
}

const LAYOUTS: { id: WatermarkLayout; label: string }[] = [
  { id: "tile", label: "Tiled" },
  { id: "center", label: "Center" },
  { id: "corner", label: "Corner" },
];

/** Your watermark library: pick the default, upload more, set layout and opacity. Galleries can pick their own. */
export default function WatermarkPanel({ options: initial, defaultId, opacity: initialOpacity, layout: initialLayout, demo, say }: {
  options: MarkOption[]; defaultId: string; opacity: number; layout: WatermarkLayout; demo: boolean; say: (t: string) => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState(initial);
  const [selected, setSelected] = useState(defaultId);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [layout, setLayout] = useState<WatermarkLayout>(initialLayout);
  const [busy, setBusy] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const saved = { defaultId, opacity: initialOpacity, layout: initialLayout };
  const [base, setBase] = useState(saved);
  const dirty = selected !== base.defaultId || opacity !== base.opacity || layout !== base.layout;
  const current = options.find((o) => o.id === selected) ?? options[0];

  async function save() {
    if (demo) return say("Demo mode — connect Google to save.");
    setBusy("save");
    const res = await api("/api/admin/brand", { method: "PATCH", body: JSON.stringify({ markDefault: selected, markOpacity: opacity, markLayout: layout }) });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't save");
    setBase({ defaultId: selected, opacity, layout });
    say("Watermark saved. Galleries on hold use it right away (unless they have their own).");
    router.refresh();
  }

  async function upload(file: File) {
    if (demo) return say("Demo mode — connect Google to upload.");
    setBusy("upload");
    const start = await api("/api/admin/brand", { method: "POST", body: JSON.stringify({ kind: "watermark", name: file.name, type: file.type, size: file.size }) });
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
    const name = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60);
    const res = await api("/api/admin/brand", { method: "PATCH", body: JSON.stringify({ addMark: { id, name } }) });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't save");
    setOptions((o) => [...o, { id, name, src: URL.createObjectURL(file), uploaded: true }]);
    setSelected(id);
    say(`Added “${name}”. Save to make it your default.`);
  }

  async function remove(o: MarkOption) {
    if (demo) return;
    setBusy(o.id);
    const res = await api("/api/admin/brand", { method: "PATCH", body: JSON.stringify({ removeMark: o.id }) });
    setBusy("");
    if (!res.ok) return say(res.error || "Couldn't remove");
    setOptions((list) => list.filter((x) => x.id !== o.id));
    if (selected === o.id) setSelected("builtin");
    if (base.defaultId === o.id) setBase((b) => ({ ...b, defaultId: "builtin" }));
    say(`Removed “${o.name}”.`);
    router.refresh();
  }

  return (
    <div className="panel wm-panel">
      <h3>Watermark</h3>
      <p className="hint" style={{ marginTop: 0 }}>Shown over previews while a gallery is held for payment. This is your default; each gallery can pick a different one in its settings.</p>

      <div className="wm-stage">
        <div className="wm-stage-img" />
        <Watermark spec={{ src: current?.src, text: current?.text, opacity, layout }} />
      </div>

      <div className="wm-options" role="radiogroup" aria-label="Watermark">
        {options.map((o) => (
          <div key={o.id} className={`wm-opt ${o.id === selected ? "on" : ""}`}>
            <button type="button" role="radio" aria-checked={o.id === selected} onClick={() => setSelected(o.id)}>
              <span className="wm-thumb">{o.src ? <img src={o.src} alt="" /> : <span className="serif">Aa</span>}</span>
              <span className="wm-name">{o.name}{o.id === base.defaultId && <em> · default</em>}</span>
            </button>
            {o.uploaded && <button type="button" className="link-btn wm-del" disabled={busy === o.id} onClick={() => remove(o)} aria-label={`Remove ${o.name}`}>Remove</button>}
          </div>
        ))}
        <button type="button" className="wm-opt add" disabled={busy === "upload"} onClick={() => input.current?.click()}>
          <span className="wm-thumb">+</span>
          <span className="wm-name">{busy === "upload" ? "Uploading…" : "Upload a watermark"}</span>
        </button>
        <input ref={input} type="file" accept="image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>

      <div className="field">
        <span>Layout</span>
        <div className="seg" role="radiogroup" aria-label="Layout">
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={layout === l.id} className={layout === l.id ? "on" : ""} onClick={() => setLayout(l.id)}>{l.label}</button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Opacity <b className="wm-pct">{Math.round(opacity * 100)}%</b></span>
        <input type="range" min={5} max={80} step={1} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="range" />
        <span className="range-ends"><small>Subtle</small><small>Strong</small></span>
      </label>

      <button type="button" className="btn primary" disabled={!dirty || busy === "save"} onClick={save} style={{ width: "100%", justifyContent: "center" }}>
        {busy === "save" ? "Saving…" : dirty ? "Save watermark" : "Saved"}
      </button>
      <p className="hint">PNG with a transparent background works best. White marks read well over most photos.</p>
    </div>
  );
}
