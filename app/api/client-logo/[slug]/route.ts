import { loadAll } from "@/lib/galleries";
import { serveImage } from "@/lib/serve";

export const runtime = "nodejs";

/** The client's logo for "Prepared for …" (not secret, so no password needed). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = (await loadAll()).find((r) => r.slug === slug);
  if (!g?.clientLogoId) return new Response("Not found", { status: 404 });
  return serveImage(g.clientLogoId, { size: 900, isPhoto: true, cache: "public, max-age=3600, s-maxage=86400" });
}
