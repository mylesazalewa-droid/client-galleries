"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** "+ New review" button and dialog for Markup. */
export default function NewReview({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", client: "", clientEmail: "", password: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
      .then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't connect. Try again." }));
    if (res.ok) router.push(`/admin/reviews/${res.id}`);
    else { setBusy(false); setErr(res.error || "Something went wrong."); }
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>+ New review</button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="nr-title">
            <h2 id="nr-title" className="serif">New review</h2>
            <p className="sub">A private page where your client watches drafts and leaves notes. You&apos;ll upload the first version next.</p>
            <label className="field"><span>Project name</span><input required autoFocus value={f.title} onChange={set("title")} placeholder="Harbor Health — Brand Film" /></label>
            <div className="field-row">
              <label className="field"><span>Client</span><input value={f.client} onChange={set("client")} placeholder="Harbor Health" /></label>
              <label className="field"><span>Client email (optional)</span><input value={f.clientEmail} onChange={set("clientEmail")} placeholder="name@company.com" inputMode="email" /></label>
            </div>
            <label className="field"><span>Password (optional)</span><input value={f.password} onChange={set("password")} placeholder="Link-only access" autoComplete="off" /></label>
            <label className="field"><span>Note to the client (optional)</span><textarea value={f.message} onChange={set("message")} placeholder="Here's the first cut. Pause anywhere to leave a note." /></label>
            {demo && <p className="error">Demo mode — connect Google to create reviews.</p>}
            {err && <p className="error" role="alert">{err}</p>}
            <div className="actions">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || demo}>{busy ? "Creating…" : "Create review"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
