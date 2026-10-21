"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { id: string; name: string; tagline?: string; accent?: string; logo?: string; galleries: number };

/** White-label brands: when you edit for an agency, their clients see the agency's brand, not yours. */
export default function BrandList({ profiles, demo }: { profiles: Row[]; demo: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (demo) return setError("Demo mode — connect Google to create brands.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Couldn't connect" }));
    setBusy(false);
    if (!res.ok) return setError(res.error || "Couldn't create the brand");
    router.push(`/admin/brands/${res.profile.id}`);
  }

  return (
    <div className="brands">
      <div className="admin-head">
        <div>
          <h1 className="serif">Client brands</h1>
          <p className="hint" style={{ margin: "8px 0 0", maxWidth: "62ch" }}>
            Editing for an agency or production company? Set up their brand here, then pick it in a gallery&apos;s settings. Their clients
            see the agency&apos;s name, logo, colors and watermark everywhere, including the gallery, film links, link previews and emails, and nothing from Sow Creative Studios.
          </p>
        </div>
      </div>

      <form className="panel brand-new" onSubmit={create}>
        <label className="field" style={{ margin: 0, flex: 1 }}><span>New brand</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MDT Productions" required maxLength={80} />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create brand"}</button>
        {error && <p className="error" style={{ flexBasis: "100%", margin: 0 }}>{error}</p>}
      </form>

      {profiles.length ? (
        <div className="brand-grid">
          {profiles.map((p) => (
            <Link key={p.id} href={`/admin/brands/${p.id}`} className="brand-card" style={{ "--b-accent": p.accent ?? "var(--accent)" } as React.CSSProperties}>
              <div className="brand-card-top">
                {p.logo ? <img src={p.logo} alt="" /> : <span className="serif">{p.name}</span>}
              </div>
              <div className="brand-card-body">
                <b>{p.name}</b>
                <span>{p.tagline || "No tagline"}</span>
                <span className="brand-uses">{p.galleries === 1 ? "1 gallery" : `${p.galleries} galleries`}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: "50px 20px" }}>
          <div className="serif">No client brands yet</div>
          Create one above for each agency you edit for.
        </div>
      )}
    </div>
  );
}
