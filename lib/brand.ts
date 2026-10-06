import "server-only";
import { cacheTtl, isDemo, studio as envStudio } from "./config";
import { BRAND_FOLDER, FOLDER_MIME, listChildren, resolveRoot } from "./galleries";
import { drive } from "./google";
import type { MediaKind, Studio } from "./types";

/** Saved as brand.json inside the CLIENTS folder. */
export type Brand = {
  name?: string;
  tagline?: string;
  headline?: string;
  email?: string;
  website?: string;
  accent?: string;
  logoId?: string;
  watermarkId?: string;
  landingId?: string;
  landingKind?: MediaKind;
  /** sessions that started before this time (ms) are signed out */
  signoutBefore?: number;
};

export const BRAND_FILE = "brand.json";

type Loaded = { brand: Brand; fileId?: string; folderId?: string };
let cache: { at: number; data: Promise<Loaded> } | null = null;

export function clearBrandCache() {
  cache = null;
}

async function load(): Promise<Loaded> {
  if (isDemo) return { brand: {} };
  const root = await resolveRoot();
  if (!root) return { brand: {} };
  const files = await listChildren(`'${root}' in parents and trashed=false and (name='${BRAND_FILE}' or name='${BRAND_FOLDER}')`);
  const file = files.find((f) => f.name === BRAND_FILE && f.mimeType !== FOLDER_MIME);
  const folder = files.find((f) => f.name === BRAND_FOLDER && f.mimeType === FOLDER_MIME);
  let brand: Brand = {};
  if (file?.id) {
    try {
      const res = await drive().files.get({ fileId: file.id, alt: "media", supportsAllDrives: true }, { responseType: "text" });
      brand = JSON.parse(String(res.data));
    } catch (e) {
      console.warn("Could not read brand.json", e);
    }
  }
  return { brand, fileId: file?.id ?? undefined, folderId: folder?.id ?? undefined };
}

export function loadBrand(force = false): Promise<Loaded> {
  if (!force && cache && Date.now() - cache.at < cacheTtl) return cache.data;
  const data = load();
  cache = { at: Date.now(), data };
  data.catch(() => (cache = null));
  return data;
}

/** Studio details for every page: what you set in the dashboard, falling back to the Vercel settings. */
export async function getStudio(): Promise<Studio> {
  const { brand } = await loadBrand().catch(() => ({ brand: {} as Brand }));
  const v = (id?: string) => (id ? id.slice(-8) : "");
  return {
    name: brand.name || envStudio.name,
    tagline: brand.tagline || envStudio.tagline,
    headline: brand.headline || undefined,
    url: brand.website || envStudio.url,
    email: brand.email || envStudio.email,
    accent: brand.accent || undefined,
    logo: brand.logoId ? `/api/brand/logo?v=${v(brand.logoId)}` : undefined,
    watermark: brand.watermarkId ? `/api/brand/watermark?v=${v(brand.watermarkId)}` : "/watermark.png",
    landing: brand.landingId
      ? brand.landingKind === "video"
        ? { kind: "video", src: `/api/brand/landing?stream=1&v=${v(brand.landingId)}`, poster: `/api/brand/landing?v=${v(brand.landingId)}` }
        : { kind: "photo", src: `/api/brand/landing?v=${v(brand.landingId)}` }
      : undefined,
  };
}

/** Readable text color on top of the accent. */
export function inkFor(hex?: string) {
  const m = hex?.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#16110b" : "#fffaf3";
}

/** Owner sessions started before this moment are no longer valid ("Sign out everywhere"). */
export async function signedOutBefore() {
  const { brand } = await loadBrand();
  return brand.signoutBefore ?? 0;
}
