"use client";
import { useState } from "react";

/** Who can sign in to the dashboard, and a way to end every session. */
export default function AccessPanel({ owners, demo }: { owners: string[]; demo: boolean }) {
  const [state, setState] = useState<"" | "confirm" | "busy" | "done" | "error">("");
  const [error, setError] = useState("");

  async function signOutAll() {
    setState("busy");
    const res = await fetch("/api/admin/security", { method: "POST" }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (res.ok) setState("done");
    else { setError(res.error || "Couldn't sign out other devices"); setState("error"); }
  }

  return (
    <section className="panel access-panel">
      <h3>Access &amp; security</h3>
      <p className="hint" style={{ marginTop: 0 }}>Only these Google accounts can open the dashboard. Everyone else is turned away, even if they find the address.</p>
      <ul className="access-list">
        {owners.map((e) => <li key={e}><span className="dot" />{e}</li>)}
      </ul>
      <p className="hint">To give someone access, add their Gmail to <b>OWNER_EMAILS</b> in Vercel (comma-separated) and to the test users of your Google sign-in app. Remove it from both to take access away.</p>
      <div className="access-actions">
        {state === "confirm" ? (
          <>
            <span className="hint" style={{ margin: 0 }}>Every phone and computer signed in to the dashboard (except this one) will be signed out.</span>
            <button className="btn danger" onClick={signOutAll}>Yes, sign out everywhere</button>
            <button className="btn" onClick={() => setState("")}>Cancel</button>
          </>
        ) : (
          <button className="btn" disabled={demo || state === "busy"} onClick={() => setState("confirm")}>{state === "busy" ? "Signing out…" : "Sign out everywhere else"}</button>
        )}
        {state === "done" && <span className="hint" style={{ margin: 0 }}>Done. Only this browser is still signed in.</span>}
        {state === "error" && <span className="error" style={{ margin: 0 }}>{error}</span>}
      </div>
    </section>
  );
}
