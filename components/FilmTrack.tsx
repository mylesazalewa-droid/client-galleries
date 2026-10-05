"use client";
import { useEffect } from "react";

/** Logs that a single-film link was opened (once per page load). */
export default function FilmTrack({ slug, film }: { slug: string; film: string }) {
  useEffect(() => {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, film }), keepalive: true }).catch(() => {});
  }, [slug, film]);
  return null;
}
