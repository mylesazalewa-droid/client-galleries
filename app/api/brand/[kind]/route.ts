import { loadBrand } from "@/lib/brand";
import { serveImage, serveStream } from "@/lib/serve";

export const runtime = "nodejs";

/** Your logo and landing-page background, read from CLIENTS/_brand. */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const { brand } = await loadBrand();
  const id = kind === "logo" ? brand.logoId : kind === "landing" ? brand.landingId : undefined;
  if (!id) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const cache = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
  if (kind === "landing" && brand.landingKind === "video" && url.searchParams.get("stream")) return serveStream(id, req, cache);
  return serveImage(id, { size: kind === "logo" ? 900 : 2400, isPhoto: true, cache });
}
