import type { Metadata } from "next";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminShell from "@/components/admin/AdminShell";
import Dashboard, { type DashGallery } from "@/components/admin/Dashboard";
import { isDemo, oauthReady, studio } from "@/lib/config";
import { findActivitySheet, readActivity, summarize } from "@/lib/activity";
import { isExpired, loadAll, resolveRoot } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";

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
  try {
    const [records, sheetId, rows] = await Promise.all([
      loadAll(true),
      findActivitySheet().catch(() => null),
      readActivity().catch(() => []),
    ]);
    activityUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : owner.demo ? "" : null;
    const stats = summarize(rows);
    galleries = records.map((g) => {
      const photos = g.items.filter((i) => i.kind === "photo").length;
      const st = stats.get(g.id);
      return {
        expired: isExpired(g.settings),
        hold: !!g.settings.hold,
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
      <Dashboard galleries={galleries} demo={owner.demo} loadError={loadError} rootMissing={rootMissing} activityUrl={activityUrl} />
    </AdminShell>
  );
}
