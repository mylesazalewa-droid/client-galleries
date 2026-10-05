import type { Studio } from "./types";

export const studio: Studio = {
  name: process.env.STUDIO_NAME || "Myles Zalewa",
  tagline: process.env.STUDIO_TAGLINE || "Film & photo",
  url: process.env.STUDIO_URL || undefined,
  email: process.env.STUDIO_EMAIL || undefined,
};

/** Demo mode runs on bundled sample media until Google credentials are set. */
export const isDemo = !process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.DRIVE_ROOT_FOLDER_ID;

export const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID || "";

/** Show a public list of (unlocked) galleries on the home page. Off by default. */
export const showIndex = isDemo || process.env.SHOW_INDEX === "true";

export const cookieSecret = process.env.GALLERY_SECRET || "change-me-in-production";

/** How long gallery listings are cached in memory, in ms. New uploads appear after this. */
export const cacheTtl = Number(process.env.CACHE_SECONDS || 60) * 1000;
