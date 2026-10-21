"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Clients type the code from their link (or paste the whole link) to open their gallery. */
export default function CodeEntry({ kind }: { kind?: "delivery" | "review" } = {}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "missing" | "wrong">("idle");
  const [other, setOther] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setState("busy");
    const res = await fetch(`/api/find?code=${encodeURIComponent(code.trim())}`).then((r) => r.json()).catch(() => ({ ok: false }));
    if (res.ok && kind && (kind === "review") !== !!res.review) { setOther(res.href); setState("wrong"); return; }
    if (res.ok) router.push(res.href);
    else setState("missing");
  }

  return (
    <form className="code" onSubmit={submit}>
      <label htmlFor="code">{kind === "review" ? "Open your review" : "Open your gallery"}</label>
      <div className="code-row">
        <input
          id="code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setState("idle"); }}
          placeholder={kind === "review" ? "Review code or link" : "Gallery code or link"}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={state === "missing"}
          aria-describedby={state === "missing" ? "code-err" : undefined}
        />
        <button disabled={state === "busy"}>{state === "busy" ? "Opening…" : "Open"}</button>
      </div>
      {state === "wrong" && (
        <p className="code-err" role="alert">
          {kind === "review" ? "That project is finished and ready to download." : "That project is still in review."}{" "}
          <a href={other} style={{ color: "inherit" }}>{kind === "review" ? "Open your gallery" : "Open the review page"} →</a>
        </p>
      )}
      {state === "missing" && <p id="code-err" className="code-err" role="alert">No gallery matches that code. Check the link in your email.</p>}
    </form>
  );
}
