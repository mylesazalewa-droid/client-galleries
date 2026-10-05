"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Studio } from "@/lib/types";
import { Lock } from "./icons";

export default function LockScreen({ slug, title, client, studio }: { slug: string; title: string; client?: string; studio: Studio }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, password: pw }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      setErr(res.error || "That password didn't work.");
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
  }

  return (
    <main className="center-page">
      <div className="lock">
        <div className="badge"><Lock /></div>
        <div className="eyebrow">{client || studio.name}</div>
        <h1 className="serif">{title}</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>This gallery is private. Enter the password from your email.</p>
        <form onSubmit={submit} className={shake ? "shake" : ""}>
          <label className="sr" htmlFor="pw">Password</label>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoFocus autoComplete="off" />
          <button className="btn primary" disabled={busy}>{busy ? "Opening…" : "Open"}</button>
        </form>
        {err && <p className="error" role="alert" style={{ marginTop: 12 }}>{err}</p>}
        <p className="foot">{studio.name}</p>
      </div>
    </main>
  );
}
