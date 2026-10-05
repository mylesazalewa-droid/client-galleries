import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookieSecret } from "./config";
import type { GalleryRecord } from "./galleries";
import type { MediaItem } from "./types";

/**
 * Signed access for a single shared film: lets the film page and website embeds play one file
 * without the gallery password. Only issued when sharing is on and the gallery isn't on hold.
 */
export function fileKey(slug: string, id: string) {
  return createHmac("sha256", `share:${cookieSecret}`).update(`${slug}:${id}`).digest("base64url").slice(0, 22);
}

export function validKey(slug: string, id: string, key: string | null) {
  if (!key) return false;
  const want = fileKey(slug, id);
  return key.length === want.length && timingSafeEqual(Buffer.from(key), Buffer.from(want));
}

export function shareAllowed(g: GalleryRecord) {
  return g.settings.share !== false && !g.settings.hold && !g.hidden;
}

/** Adds the signature to every URL of a film (and its formats and captions). */
export function signItem(slug: string, item: MediaItem): MediaItem {
  const add = (url: string, id: string) => (url ? `${url}${url.includes("?") ? "&" : "?"}k=${fileKey(slug, id)}` : url);
  return {
    ...item,
    thumb: add(item.thumb, item.id),
    full: add(item.full, item.id),
    src: item.src ? add(item.src, item.id) : undefined,
    download: add(item.download, item.id),
    versions: item.versions?.map((v) => ({ ...v, src: add(v.src, v.id), download: add(v.download, v.id) })),
    captions: item.captions?.map((c) => ({ ...c, src: add(c.src, c.id), download: add(c.download, c.id) })),
  };
}
