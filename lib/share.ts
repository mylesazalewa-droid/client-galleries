import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookieSecret } from "./config";
import type { GalleryRecord } from "./galleries";
import type { MediaItem } from "./types";

/**
 * Signed access for a single shared film: lets the film page and website embeds play one file
 * without the gallery password. Only issued when sharing is on and the gallery isn't on hold.
 */
export function fileKey(slug: string, id: string, download = false) {
  return createHmac("sha256", `share:${cookieSecret}`).update(`${slug}:${id}${download ? ":download" : ""}`).digest("base64url").slice(0, 22);
}

/** `download` checks the separate key that also allows downloading (the "d" link parameter). */
export function validKey(slug: string, id: string, key: string | null | undefined, download = false) {
  if (!key) return false;
  const want = fileKey(slug, id, download);
  return key.length === want.length && timingSafeEqual(Buffer.from(key), Buffer.from(want));
}

export function shareAllowed(g: GalleryRecord) {
  return g.settings.share !== false && !g.settings.hold && !g.hidden;
}

/** Adds the signature to every URL of a film (and its formats and captions). Download links get the download key, or are removed. */
export function signItem(slug: string, item: MediaItem, download = false): MediaItem {
  const add = (url: string, id: string) => (url ? `${url}${url.includes("?") ? "&" : "?"}k=${fileKey(slug, id)}` : url);
  const dl = (url: string, id: string) => (download && url ? `${url}${url.includes("?") ? "&" : "?"}d=${fileKey(slug, id, true)}` : "");
  return {
    ...item,
    thumb: add(item.thumb, item.id),
    full: add(item.full, item.id),
    src: item.src ? add(item.src, item.id) : undefined,
    download: dl(item.download, item.id),
    versions: item.versions?.map((v) => ({ ...v, src: add(v.src, v.id), download: dl(v.download, v.id) })),
    captions: item.captions?.map((c) => ({ ...c, src: add(c.src, c.id), download: dl(c.download, c.id) })),
  };
}
