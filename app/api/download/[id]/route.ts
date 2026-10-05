import { canView } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { findItem } from "@/lib/galleries";
import { driveMedia } from "@/lib/google";
import { disposition } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const found = await findItem(url.searchParams.get("g") ?? "", id);
  if (!found) return new Response("Not found", { status: 404 });
  if (!(await canView(found.gallery))) return new Response("Locked", { status: 401 });
  if (found.gallery.settings.downloads === false) return new Response("Downloads are off", { status: 403 });
  if (isDemo) return Response.redirect(new URL(found.item.download, req.url));

  const upstream = await driveMedia(id, { signal: req.signal });
  if (!upstream.ok) return new Response("Download failed", { status: upstream.status });
  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "Content-Disposition": disposition(found.item.name),
    "Cache-Control": "private, no-store",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new Response(upstream.body, { headers });
}
