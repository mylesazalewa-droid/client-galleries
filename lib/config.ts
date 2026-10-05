import type { Studio } from "./types";

export const studio: Studio = {
  name: process.env.STUDIO_NAME || "Myles Zalewa",
  tagline: process.env.STUDIO_TAGLINE || "Film & photo",
  url: process.env.STUDIO_URL || undefined,
  email: process.env.STUDIO_EMAIL || undefined,
};

/** Demo mode runs on bundled sample media until the Google service account is set. */
export const isDemo = !process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

/** Optional. If unset, the app uses (or creates) a Drive folder named ROOT_FOLDER_NAME. */
export const rootFolderIdEnv = process.env.DRIVE_ROOT_FOLDER_ID || "";
export const rootFolderName = process.env.DRIVE_ROOT_FOLDER_NAME || "CLIENTS";

/** Show a public list of (unlocked) galleries on the home page. Off by default. */
export const showIndex = process.env.SHOW_INDEX === "true";

export const cookieSecret = process.env.GALLERY_SECRET || "change-me-in-production";

/** How long gallery listings are cached in memory, in ms. New uploads appear after this. */
export const cacheTtl = Number(process.env.CACHE_SECONDS || 15) * 1000;

// ---- Owner sign-in (Google OAuth) ----
export const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
export const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
/** Comma-separated Google accounts allowed into /admin. */
export const ownerEmails = (process.env.OWNER_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
export const oauthReady = !!(oauthClientId && oauthClientSecret && ownerEmails.length);
