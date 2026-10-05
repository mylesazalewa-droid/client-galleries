import { canView, viewerState } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { findItem } from "@/lib/galleries";
import { serveStream } from "@/lib/serve";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Streams a video from Drive with HTTP Range support, so the player can seek. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const found = await findItem(url.searchParams.get("g") ?? "", id);
  if (!found || found.item.kind !== "video") return new Response("Not found", { status: 404 });
  if (!(await canView(found.gallery))) return new Response("Locked", { status: 401 });
  if ((await viewerState(found.gallery)).expired) return new Response("This gallery has closed", { status: 410 });
  if (isDemo) return Response.redirect(new URL(found.item.src!, req.url));
  return serveStream(id, req);
}
