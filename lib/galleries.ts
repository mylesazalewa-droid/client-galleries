import "server-only";
import { createHash } from "crypto";
import { cacheTtl, isDemo, rootFolderIdEnv, rootFolderName } from "./config";
import { demoGalleries } from "./demo";
import { drive } from "./google";
import type { Gallery, GallerySettings, GallerySummary, MediaItem } from "./types";

/**
 * Internal record of a gallery. Holds the password, which never leaves the server.
 */
export type GalleryRecord = {
  id: string;
  slug: string;
  title: string;
  settings: GallerySettings;
  items: MediaItem[];
  cover?: MediaItem;
  /** Drafts: folder name starts with "_" or gallery.json has "hidden": true. Only the owner sees them. */
  hidden?: boolean;
  settingsFileId?: string;
};

export const SETTINGS_FILE = "gallery.json";
const IMAGE = /^image\/(jpeg|png|webp|heic|heif|gif|tiff)$/;
const VIDEO = /^video\//;

export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Each link gets a short code derived from the Drive folder ID, so clients can't guess other galleries. */
export function linkCode(folderId: string) {
  return createHash("sha256").update(folderId).digest("hex").slice(0, 6);
}

export function slugFor(title: string, folderId: string) {
  return `${slugify(title).slice(0, 60) || "gallery"}-${linkCode(folderId)}`;
}

// ---------------------------------------------------------------- caching

let cache: { at: number; data: Promise<GalleryRecord[]> } | null = null;

export function loadAll(force = false): Promise<GalleryRecord[]> {
  if (!force && cache && Date.now() - cache.at < cacheTtl) return cache.data;
  const data = isDemo ? Promise.resolve(demoGalleries()) : loadFromDrive();
  cache = { at: Date.now(), data };
  data.catch(() => (cache = null));
  return data;
}

export function clearCache() {
  cache = null;
  rootCache = null;
}

/** Public lookup by link. Drafts are only reachable from the dashboard. */
export async function getRecord(slug: string) {
  const all = await loadAll();
  return all.find((g) => g.slug === slug && !g.hidden) ?? null;
}

/** Dashboard lookup by Drive folder ID (includes drafts). */
export async function getRecordById(id: string, force = false) {
  const all = await loadAll(force);
  return all.find((g) => g.id === id) ?? null;
}

/** Look up a file only within the given gallery, so file IDs can't reach anything else in Drive. */
export async function findItem(slug: string, id: string) {
  // Includes drafts so the dashboard can show their thumbnails; the link code + file ID are both unguessable.
  const g = (await loadAll()).find((r) => r.slug === slug);
  if (!g) return null;
  const item = g.items.find((i) => i.id === id) ?? (g.cover?.id === id ? g.cover : undefined);
  return item ? { gallery: g, item } : null;
}

// ---------------------------------------------------------------- public shapes

export function toSummary(g: GalleryRecord): GallerySummary {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    client: g.settings.client,
    date: g.settings.date,
    locked: !!g.settings.password,
    coverThumb: (g.cover ?? g.items.find((i) => i.kind === "photo"))?.thumb,
  };
}

export function toGallery(g: GalleryRecord): Gallery {
  return {
    ...toSummary(g),
    message: g.settings.message,
    allowDownload: g.settings.downloads !== false,
    cover: g.cover ?? g.items.find((i) => i.kind === "photo") ?? g.items[0],
    items: g.items,
    zip: `/api/zip/${g.slug}`,
  };
}

// ---------------------------------------------------------------- Google Drive

type DriveFile = {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  imageMediaMetadata?: { width?: number | null; height?: number | null; rotation?: number | null } | null;
  videoMediaMetadata?: { width?: number | null; height?: number | null; durationMillis?: string | null } | null;
};

async function listChildren(q: string) {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive().files.list({
      q,
      pageSize: 1000,
      pageToken,
      orderBy: "name_natural",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields:
        "nextPageToken, files(id,name,mimeType,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height,durationMillis))",
    });
    files.push(...((res.data.files as DriveFile[]) ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

async function readSettings(fileId: string): Promise<GallerySettings> {
  try {
    const res = await drive().files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "text" },
    );
    return JSON.parse(String(res.data));
  } catch (e) {
    console.warn(`Could not read ${SETTINGS_FILE} (${fileId}):`, e);
    return {};
  }
}

function toItem(f: DriveFile, slug: string): MediaItem | null {
  if (!f.id || !f.name || !f.mimeType) return null;
  const q = `g=${encodeURIComponent(slug)}`;
  const base = {
    id: f.id,
    name: f.name,
    thumb: `/api/media/${f.id}?${q}&s=900`,
    full: `/api/media/${f.id}?${q}&s=2400`,
    download: `/api/download/${f.id}?${q}`,
  };
  if (IMAGE.test(f.mimeType)) {
    const m = f.imageMediaMetadata ?? {};
    const rotated = m.rotation === 1 || m.rotation === 3;
    const w = m.width || 3, h = m.height || 2;
    return { ...base, kind: "photo", width: rotated ? h : w, height: rotated ? w : h };
  }
  if (VIDEO.test(f.mimeType)) {
    const m = f.videoMediaMetadata ?? {};
    return {
      ...base,
      kind: "video",
      width: m.width || 16,
      height: m.height || 9,
      duration: m.durationMillis ? Number(m.durationMillis) / 1000 : undefined,
      src: `/api/stream/${f.id}?${q}`,
    };
  }
  return null;
}

let rootCache: { at: number; id: string | null } | null = null;

/** The parent "Client Galleries" folder: from DRIVE_ROOT_FOLDER_ID, or found by name among folders shared with the service account. */
export async function resolveRoot(force = false): Promise<string | null> {
  if (rootFolderIdEnv) return rootFolderIdEnv;
  if (!force && rootCache && Date.now() - rootCache.at < 10 * 60_000) return rootCache.id;
  const name = rootFolderName.replace(/'/g, "\\'");
  const found = await listChildren(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const id = found[0]?.id ?? null;
  rootCache = { at: Date.now(), id };
  return id;
}

async function loadFromDrive(): Promise<GalleryRecord[]> {
  const root = await resolveRoot();
  if (!root) return [];
  const folders = await listChildren(
    `'${root}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );

  const records = await Promise.all(
    folders
      .filter((f) => f.id && f.name)
      .map(async (folder): Promise<GalleryRecord> => {
        const title = folder.name!.replace(/^_+\s*/, "");
        const slug = slugFor(title, folder.id!);
        const files = await listChildren(`'${folder.id}' in parents and trashed=false`);
        const settingsFile = files.find((f) => f.name === SETTINGS_FILE);
        const settings = settingsFile?.id ? await readSettings(settingsFile.id) : {};

        const media = files
          .filter((f) => !f.name?.startsWith("_") && !f.name?.startsWith("."))
          .map((f) => toItem(f, slug))
          .filter((x): x is MediaItem => !!x);

        // A file named cover.* (or the one named in gallery.json) becomes the hero, not a grid item.
        const coverName = settings.cover?.toLowerCase();
        const isCover = (i: MediaItem) =>
          i.kind === "photo" &&
          (coverName ? i.name.toLowerCase() === coverName : /^cover\.[a-z]+$/i.test(i.name));
        const cover = media.find(isCover);
        const items = settings.cover ? media : media.filter((i) => i !== cover);

        const hidden = folder.name!.startsWith("_") || settings.hidden === true;
        return { id: folder.id!, slug, title, settings, items, cover, hidden, settingsFileId: settingsFile?.id ?? undefined };
      }),
  );

  return records.sort((a, b) => (b.settings.date ?? "").localeCompare(a.settings.date ?? ""));
}
