import { isDemo } from "@/lib/config";
import { coverFor, loadPortal } from "@/lib/portal";
import { serveImage } from "@/lib/serve";

export const runtime = "nodejs";

/** Cover image for a gallery card on a client portal (the portal link itself is the secret). */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const portal = await loadPortal(slug);
  const g = portal?.records.find((r) => r.id === id);
  const cover = g && coverFor(g);
  if (!cover) return new Response("Not found", { status: 404 });
  if (isDemo) return Response.redirect(new URL(cover.thumb, req.url));
  // Held galleries only get a small preview here too.
  return serveImage(cover.id, { size: 900, maxSize: g!.settings.hold ? 1200 : 2400, isPhoto: cover.kind === "photo", cache: "private, max-age=3600" });
}
