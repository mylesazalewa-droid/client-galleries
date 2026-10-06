"use client";
import { useEffect, useState } from "react";
import { Check, Close } from "./icons";

/** Link to one film, plus an embed code for the client's website. */
export default function ShareDialog({ title, path, embedPath, downloadKey, onClose }: {
  title: string; path: string; embedPath: string; downloadKey?: string; onClose: () => void;
}) {
  const [allowDl, setAllowDl] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    setOrigin(location.origin);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link = `${origin}${path}${allowDl && downloadKey ? `${path.includes("?") ? "&" : "?"}d=${downloadKey}` : ""}`;
  const embed = `<iframe src="${origin}${embedPath}" title="${title.replace(/"/g, "&quot;")}" style="width:100%;aspect-ratio:16/9;border:0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;

  async function copy(what: string, text: string) {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(what);
    setTimeout(() => setCopied(""), 1600);
  }

  return (
    <div className="scrim share-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <h2 id="share-title" className="serif">Share this film</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Close /></button>
        </div>
        <p className="sub">Anyone with this link can watch {title}{allowDl ? " and download it" : ""}. They won&apos;t see the rest of the gallery.</p>
        {downloadKey && (
          <label className="switch-row">
            <span>
              <b>Allow downloads</b>
              <small>{allowDl ? "People with the link can download the film." : "View only. The link can't be used to download."}</small>
            </span>
            <input type="checkbox" role="switch" className="switch" checked={allowDl} onChange={(e) => setAllowDl(e.target.checked)} />
          </label>
        )}
        <label className="field"><span>Link</span>
          <div className="copy-row">
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn primary" onClick={() => copy("link", link)}>{copied === "link" ? <><Check /> Copied</> : "Copy"}</button>
          </div>
        </label>
        <label className="field"><span>Embed on a website{downloadKey ? " (always view only)" : ""}</span>
          <textarea readOnly value={embed} rows={4} onFocus={(e) => e.target.select()} className="code-box" />
        </label>
        <div className="actions">
          <button className="btn" onClick={() => copy("embed", embed)}>{copied === "embed" ? <><Check /> Copied</> : "Copy embed code"}</button>
        </div>
      </div>
    </div>
  );
}
