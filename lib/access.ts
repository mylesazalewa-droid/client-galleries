import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cookieSecret } from "./config";
import { isExpired, type GalleryRecord } from "./galleries";
import { readSession } from "./owner";

export const cookieName = (slug: string) => `gal_${slug}`;

/** Token is tied to the current password, so changing it in gallery.json signs everyone out. */
export function tokenFor(g: GalleryRecord) {
  return createHmac("sha256", cookieSecret).update(`${g.slug}:${g.settings.password ?? ""}`).digest("base64url");
}

export function passwordMatches(g: GalleryRecord, attempt: string) {
  const a = Buffer.from(attempt.trim());
  const b = Buffer.from(String(g.settings.password ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function canView(g: GalleryRecord, opts: { ignoreOwner?: boolean } = {}) {
  if (!g.settings.password) return true;
  if (!opts.ignoreOwner && (await readSession())) return true; // the owner sees everything
  const jar = await cookies();
  const value = jar.get(cookieName(g.slug))?.value;
  if (!value) return false;
  const expected = tokenFor(g);
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

/** Who is looking and what they're allowed: the owner bypasses expiry, payment hold and passwords. */
export async function viewerState(g: GalleryRecord) {
  const owner = !!(await readSession());
  return {
    owner,
    expired: !owner && isExpired(g.settings),
    hold: !owner && !!g.settings.hold,
    canDownload: owner || (g.settings.downloads !== false && !g.settings.hold),
  };
}

/**
 * Access check for file routes: the gallery password cookie, the owner, or a valid share key
 * for this exact file (single-film links and website embeds).
 */
export async function canAccessFile(g: GalleryRecord, fileId: string, req: Request, opts: { download?: boolean } = {}) {
  if (await canView(g)) return true;
  const { shareAllowed, validKey } = await import("./share");
  if (!shareAllowed(g)) return false;
  const q = new URL(req.url).searchParams;
  const canDl = validKey(g.slug, fileId, q.get("d"), true);
  return opts.download ? canDl : canDl || validKey(g.slug, fileId, q.get("k"));
}
