import "server-only";
import { isDemo } from "./config";
import { readActivity } from "./activity";

let cache: { at: number; ids: Set<string> } | null = null;

/** Galleries with a confirmed Stripe payment ("Paid" rows in the activity sheet). */
export async function paidGalleries(): Promise<Set<string>> {
  if (isDemo) return new Set();
  if (cache && Date.now() - cache.at < 15_000) return cache.ids;
  const rows = await readActivity();
  const ids = new Set(rows.filter((r) => r.event === "Paid").map((r) => r.galleryId));
  cache = { at: Date.now(), ids };
  return ids;
}

export function forgetPayments() {
  cache = null;
}
