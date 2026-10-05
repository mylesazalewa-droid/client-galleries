import { canView } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { findItem } from "@/lib/galleries";
import { drive, accessToken, driveMedia } from "@/lib/google";

export const runtime = "nodejs";

const SIZES = [400, 900, 1600, 2400];
const links = new Map<string, { at: number; link: string | null }>();

async function thumbnailLink(id: string) {
  const hit = links.get(id);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.link;
  const res = await drive().files.get({ fileId: id, fields: "thumbnailLink", supportsAllDrives: true });
  const link = res.data.thumbnailLink ?? null;
  links.set(id, { at: Date.now(), link });
  return link;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const found = await findItem(url.searchParams.get("g") ?? "", id);
  if (!found) return new Response("Not found", { status: 404 });
  if (!(await canView(found.gallery))) return new Response("Locked", { status: 401 });
  if (isDemo) return Response.redirect(new URL(found.item.full, req.url));

  const wanted = Number(url.searchParams.get("s")) || 900;
  const size = SIZES.find((s) => s >= wanted) ?? 2400;
  const cacheControl = found.gallery.settings.password
    ? "private, max-age=86400"
    : "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400";

  // Drive renders a resized JPEG for photos and a poster frame for videos.
  try {
    const link = await thumbnailLink(id);
    if (link) {
      const sized = link.replace(/=s\d+(-[a-z0-9-]+)?$/i, "") + `=s${size}`;
      const res = await fetch(sized, { headers: { Authorization: `Bearer ${await accessToken()}` } });
      if (res.ok && res.headers.get("content-type")?.startsWith("image/")) {
        return new Response(res.body, {
          headers: { "Content-Type": res.headers.get("content-type")!, "Cache-Control": cacheControl },
        });
      }
    }
  } catch (e) {
    console.warn("thumbnail failed", id, e);
  }

  // Fallback: serve the original photo (no resize) if Drive has no thumbnail yet.
  if (found.item.kind === "photo") {
    const res = await driveMedia(id);
    if (res.ok) {
      return new Response(res.body, {
        headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": cacheControl },
      });
    }
  }
  return new Response("Preview not ready", { status: 404 });
}
