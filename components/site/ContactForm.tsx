"use client";
import { useState } from "react";

const TYPES = ["Brand or story film", "Conference or event", "Photography", "Editing only", "Something else"];
const BUDGETS = ["Not sure yet", "Under $2,500", "$2,500 – $5,000", "$5,000 – $10,000", "$10,000+"];

export default function ContactForm({ initialType }: { initialType?: string }) {
  const [f, setF] = useState({ name: "", email: "", org: "", type: initialType && TYPES.includes(initialType) ? initialType : "", date: "", budget: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
      .then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't send. Check your connection and try again." }));
    if (!res.ok) { setState("idle"); setError(res.error || "Couldn't send. Try again."); return; }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="site-sent">
        <h2 className="serif">Thanks, {f.name.split(" ")[0] || "friend"}.</h2>
        <p>Your message is in. You&apos;ll hear back within a couple of business days at <b>{f.email}</b>.</p>
      </div>
    );
  }

  return (
    <form className="site-form" onSubmit={submit}>
      <div className="field-row">
        <label className="field"><span>Your name</span><input required value={f.name} onChange={set("name")} autoComplete="name" maxLength={80} /></label>
        <label className="field"><span>Email</span><input required type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={120} /></label>
      </div>
      <label className="field"><span>Organization <em>(optional)</em></span><input value={f.org} onChange={set("org")} autoComplete="organization" maxLength={120} /></label>
      <div className="field-row">
        <label className="field"><span>What do you need?</span>
          <select required value={f.type} onChange={set("type")}>
            <option value="" disabled>Choose one</option>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="field"><span>Date or deadline <em>(optional)</em></span><input value={f.date} onChange={set("date")} placeholder="e.g. March 12, or spring" maxLength={80} /></label>
      </div>
      <label className="field"><span>Budget <em>(optional)</em></span>
        <select value={f.budget} onChange={set("budget")}>
          <option value="">Choose a range</option>
          {BUDGETS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      <label className="field"><span>Tell me about the project</span><textarea required value={f.message} onChange={set("message")} rows={6} maxLength={4000} placeholder="What it's for, who it's for, where and when, and anything else that helps." /></label>
      <label className="site-hp" aria-hidden>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary site-submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send request"}</button>
    </form>
  );
}
