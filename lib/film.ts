import "server-only";
import { canView } from "./access";
import { getStudio } from "./brand";
import { getRecord, isExpired, loadAll, toGallery, type GalleryRecord } from "./galleries";
import { readSession } from "./owner";
import { shareAllowed, signItem, validKey } from "./share";
import type { MediaItem } from "./types";

export type FilmResult =
  | { ok: true; g: GalleryRecord; item: MediaItem; canDownload: boolean; clientLogo?: string; owner: boolean }
  | { ok: false; g?: GalleryRecord; reason: "missing" | "closed" | "private" };

/** Loads one film for the single-film page and website embeds, checking the share key. */
export async function loadFilm(slug: string, id: string, key: string | null): Promise<FilmResult> {
  if (id.includes("%")) {
    try { id = decodeURIComponent(id); } catch {}
  }
  const owner = !!(await readSession());
  const g = (await getRecord(slug)) ?? (owner ? (await loadAll()).find((r) => r.slug === slug) ?? null : null);
  if (!g) return { ok: false, reason: "missing" };
  const raw = g.items.find((i) => i.id === id && i.kind === "video");
  if (!raw) return { ok: false, g, reason: "missing" };
  if (!owner) {
    if (isExpired(g.settings)) return { ok: false, g, reason: "closed" };
    const allowed = shareAllowed(g) && (validKey(g.slug, id, key) || (await canView(g, { ignoreOwner: true })));
    if (!allowed) return { ok: false, g, reason: "private" };
  }
  return {
    ok: true,
    g,
    owner,
    item: signItem(g.slug, raw),
    canDownload: owner || (g.settings.downloads !== false && !g.settings.hold),
    clientLogo: toGallery(g).clientLogo,
  };
}

export { getStudio };
