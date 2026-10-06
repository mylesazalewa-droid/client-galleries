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
/** Owner sign-in only turns on with a real GALLERY_SECRET (it seals the login cookie); never with the built-in placeholder. */
export const strongSecret = !!process.env.GALLERY_SECRET && process.env.GALLERY_SECRET !== "change-me-in-production";
export const oauthReady = !!(oauthClientId && oauthClientSecret && ownerEmails.length && strongSecret);

/** The site's main address. Google sign-in only accepts this one, so other Vercel URLs hand off to it. */
export function siteOrigin(fallback: string) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return fallback;
}
