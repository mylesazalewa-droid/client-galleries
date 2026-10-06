import "server-only";
import { createHmac } from "crypto";
import { cookieSecret } from "./config";
import { isExpired, loadAll, slugify, toGallery, type GalleryRecord } from "./galleries";

/** One private link per client that lists every gallery made for them (matched by the Client field). */
export const clientKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function portalSlug(client: string) {
  const sig = createHmac("sha256", `portal:${cookieSecret}`).update(clientKey(client)).digest("hex").slice(0, 8);
  return `${slugify(client) || "client"}-${sig}`;
}

export type PortalGallery = {
  slug: string;
  title: string;
  date?: string;
  cover?: string;
  locked: boolean;
  hold: boolean;
  closed: boolean;
  expires?: string;
  counts: { photos: number; films: number };
};

export async function loadPortal(slug: string) {
  const all = (await loadAll()).filter((g) => !g.hidden && g.settings.client?.trim());
  const mine = all.filter((g) => portalSlug(g.settings.client!) === slug);
  if (!mine.length) return null;
  const client = mine[0].settings.client!.trim();
  const logoFrom = mine.find((g) => g.clientLogoId);
  const galleries: PortalGallery[] = mine.map((g) => ({
    slug: g.slug,
    title: g.title,
    date: g.settings.date,
    cover: coverFor(g) ? `/api/portal-cover/${slug}/${g.id}` : undefined,
    locked: !!g.settings.password,
    hold: !!g.settings.hold,
    closed: isExpired(g.settings),
    expires: g.settings.expires,
    counts: { photos: g.items.filter((i) => i.kind === "photo").length, films: g.items.filter((i) => i.kind === "video").length },
  }));
  return { client, logo: logoFrom ? toGallery(logoFrom).clientLogo : undefined, galleries, records: mine };
}

export function coverFor(g: GalleryRecord) {
  return g.cover ?? g.items.find((i) => i.kind === "photo") ?? g.items[0];
}

/** Portal link for each client, for the dashboard. */
export async function portalLinks() {
  const out = new Map<string, { client: string; slug: string; count: number }>();
  for (const g of await loadAll()) {
    const c = g.settings.client?.trim();
    if (!c || g.hidden) continue;
    const k = clientKey(c);
    const cur = out.get(k);
    out.set(k, { client: cur?.client ?? c, slug: portalSlug(c), count: (cur?.count ?? 0) + 1 });
  }
  return [...out.values()].sort((a, b) => a.client.localeCompare(b.client));
}
