import "server-only";
import { accessToken, drive, driveMedia } from "./google";

const SIZES = [400, 900, 1200, 1600, 2400];
const links = new Map<string, { at: number; link: string | null }>();

async function thumbnailLink(id: string) {
  const hit = links.get(id);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.link;
  const res = await drive().files.get({ fileId: id, fields: "thumbnailLink", supportsAllDrives: true });
  const link = res.data.thumbnailLink ?? null;
  links.set(id, { at: Date.now(), link });
  return link;
}

/** A resized JPEG of a Drive photo (or a video's poster frame), via Drive's thumbnail service. */
export async function serveImage(id: string, opts: { size: number; cache: string; isPhoto: boolean; maxSize?: number }) {
  const cap = opts.maxSize ?? 2400;
  const size = Math.min(SIZES.find((s) => s >= opts.size) ?? 2400, cap);
  try {
    const link = await thumbnailLink(id);
    if (link) {
      const sized = link.replace(/=s\d+(-[a-z0-9-]+)?$/i, "") + `=s${size}`;
      const res = await fetch(sized, { headers: { Authorization: `Bearer ${await accessToken()}` } });
      if (res.ok && res.headers.get("content-type")?.startsWith("image/")) {
        return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type")!, "Cache-Control": opts.cache } });
      }
    }
  } catch (e) {
    console.warn("thumbnail failed", id, e);
  }
  // No thumbnail yet: fall back to the original photo, unless previews must stay small.
  if (opts.isPhoto && cap >= 2400) {
    const res = await driveMedia(id);
    if (res.ok) {
      return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": opts.cache } });
    }
  }
  return new Response("Preview not ready", { status: 404, headers: { "Cache-Control": "no-store" } });
}

const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

/** Streams a Drive video with HTTP Range support, so players can seek. */
export async function serveStream(id: string, req: Request, cache = "private, max-age=3600") {
  const upstream = await driveMedia(id, { range: req.headers.get("range") ?? "bytes=0-", signal: req.signal });
  if (!upstream.ok && upstream.status !== 206) return new Response("Video unavailable", { status: upstream.status });
  const headers = new Headers({ "Cache-Control": cache, "Accept-Ranges": "bytes" });
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
