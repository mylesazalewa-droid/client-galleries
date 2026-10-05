"use client";
import { useState } from "react";
import { Check } from "../icons";

/** Copies a text (or this site's URL + path) to the clipboard. */
export default function CopyLink({ path, text, label = "Copy link", className = "btn" }: { path?: string; text?: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    const value = text ?? `${location.origin}${path ?? ""}`;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {done ? <><Check /> Copied</> : label}
    </button>
  );
}
