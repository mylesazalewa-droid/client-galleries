import { canView } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { findItem } from "@/lib/galleries";
import { driveMedia } from "@/lib/google";

export const runtime = "nodejs";
export const maxDuration = 300;

const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

/** Streams a video from Drive with HTTP Range support, so the player can seek. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const found = await findItem(url.searchParams.get("g") ?? "", id);
  if (!found || found.item.kind !== "video") return new Response("Not found", { status: 404 });
  if (!(await canView(found.gallery))) return new Response("Locked", { status: 401 });
  if (isDemo) return Response.redirect(new URL(found.item.src!, req.url));

  const upstream = await driveMedia(id, { range: req.headers.get("range") ?? "bytes=0-", signal: req.signal });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Video unavailable", { status: upstream.status });
  }
  const headers = new Headers({ "Cache-Control": "private, max-age=3600", "Accept-Ranges": "bytes" });
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
