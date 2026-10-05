import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cookieSecret } from "./config";
import type { GalleryRecord } from "./galleries";

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

export async function canView(g: GalleryRecord) {
  if (!g.settings.password) return true;
  const jar = await cookies();
  const value = jar.get(cookieName(g.slug))?.value;
  if (!value) return false;
  const expected = tokenFor(g);
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
