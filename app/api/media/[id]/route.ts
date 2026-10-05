import { canView, viewerState } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { findItem } from "@/lib/galleries";
import { serveImage } from "@/lib/serve";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const found = await findItem(url.searchParams.get("g") ?? "", id);
  if (!found) return new Response("Not found", { status: 404 });
  if (!(await canView(found.gallery))) return new Response("Locked", { status: 401 });
  const v = await viewerState(found.gallery);
  if (v.expired) return new Response("This gallery has closed", { status: 410 });
  if (isDemo) return Response.redirect(new URL(found.item.full, req.url));

  // While a payment hold is on, clients only get small previews.
  const private_ = !!found.gallery.settings.password || !!found.gallery.settings.hold || v.owner;
  return serveImage(id, {
    size: Number(url.searchParams.get("s")) || 900,
    maxSize: v.hold ? 1200 : 2400,
    isPhoto: found.item.kind === "photo",
    cache: private_ ? "private, max-age=86400" : "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
  });
}
