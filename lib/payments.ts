import "server-only";
import { isDemo } from "./config";
import { readActivity } from "./activity";
import type { GallerySettings, PayPart } from "./types";

type Paid = { galleries: Set<string>; links: Set<string> };
let cache: { at: number; paid: Paid } | null = null;

/**
 * Confirmed payments ("Paid" rows in the activity sheet). A gallery whose request came from the
 * dashboard is unlocked by a payment on that exact link, so sending a new request re-locks it.
 */
export async function paidGalleries(): Promise<Paid> {
  if (isDemo) return { galleries: new Set(), links: new Set() };
  if (cache && Date.now() - cache.at < 15_000) return cache.paid;
  const rows = (await readActivity()).filter((r) => r.event === "Paid" || r.event === "Marked paid");
  const paid: Paid = {
    galleries: new Set(rows.filter((r) => r.event === "Paid").map((r) => r.galleryId)),
    links: new Set(rows.flatMap((r) => r.detail.match(/plink_[A-Za-z0-9]+/g) ?? [])),
  };
  cache = { at: Date.now(), paid };
  return paid;
}

export function forgetPayments() {
  cache = null;
}


/** The parts of a gallery's payment request (older single requests count as one part). */
export function payParts(s: GallerySettings): PayPart[] {
  if (s.payParts?.length) return s.payParts;
  if (s.payLinkId && s.payUrl) return [{ id: s.payLinkId, url: s.payUrl, amount: s.payAmount ?? 0, label: s.payLabel ?? "" }];
  return [];
}

export function usd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
