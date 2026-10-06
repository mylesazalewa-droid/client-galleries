import type { Metadata } from "next";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminShell from "@/components/admin/AdminShell";
import Dashboard, { type DashGallery, type PaymentRow } from "@/components/admin/Dashboard";
import { payParts, usd } from "@/lib/payments";
import type { GalleryRecord } from "@/lib/galleries";

import { isDemo, oauthReady, studio } from "@/lib/config";
import { findActivitySheet, readActivity, summarize } from "@/lib/activity";
import { isExpired, loadAll, resolveRoot } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { portalLinks } from "@/lib/portal";

function dueOf(g: GalleryRecord) {
  const paid = new Set(g.paidLinks ?? []);
  const left = payParts(g.settings).filter((p) => !paid.has(p.id)).reduce((n, p) => n + p.amount, 0);
  return left ? usd(left) : undefined;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const owner = await currentOwner();
  if (!owner) {
    const { error } = await searchParams;
    return <AdminLogin studio={studio} demo={isDemo} oauthReady={oauthReady} error={error} />;
  }

  let galleries: DashGallery[] = [];
  let loadError = "";
  let activityUrl: string | null = null;
  let payments: PaymentRow[] = [];
  let portals: { client: string; slug: string; count: number }[] = [];
  try {
    const [records, sheetId, rows] = await Promise.all([
      loadAll(true),
      findActivitySheet().catch(() => null),
      readActivity().catch(() => []),
    ]);
    activityUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : owner.demo ? "" : null;
    const stats = summarize(rows);
    portals = await portalLinks();
    payments = rows
      .filter((r) => r.event === "Paid" || r.event === "Marked paid")
      .slice(0, 6)
      .map(({ galleryId, gallery, event, detail, time }) => ({ galleryId, gallery, event, detail, time }));
    galleries = records.map((g) => {
      const photos = g.items.filter((i) => i.kind === "photo").length;
      const st = stats.get(g.id);
      return {
        expired: isExpired(g.settings),
        hold: !!g.settings.hold,
        due: g.settings.hold ? dueOf(g) : undefined,
        expires: g.settings.expires,
        views: st?.views ?? 0,
        downloads: st?.downloads ?? 0,
        lastOpened: st?.lastOpened,
        id: g.id,
        slug: g.slug,
        title: g.title,
        client: g.settings.client,
        date: g.settings.date,
        locked: !!g.settings.password,
        hidden: !!g.hidden,
        photos,
        videos: g.items.length - photos,
        coverThumb: (g.cover ?? g.items.find((i) => i.kind === "photo") ?? g.items[0])?.thumb,
      };
    });
  } catch (e) {
    console.error(e);
    loadError = "Couldn't read Google Drive. Check that the service account key is set correctly.";
  }
  const rootMissing = !isDemo && !loadError && !(await resolveRoot().catch(() => null));

  return (
    <AdminShell studio={studio} email={owner.email} demo={owner.demo}>
      <Dashboard galleries={galleries} demo={owner.demo} loadError={loadError} rootMissing={rootMissing} activityUrl={activityUrl} payments={payments} portals={portals} />
    </AdminShell>
  );
}
