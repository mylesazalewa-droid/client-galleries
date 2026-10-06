import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import GalleryManager from "@/components/admin/GalleryManager";
import { studio } from "@/lib/config";
import { readActivity } from "@/lib/activity";
import { getRecordById, isExpired } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { stripeReady } from "@/lib/stripe";
import { portalSlug } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit gallery" };

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const g = await getRecordById((await params).id, true);
  if (!g) notFound();
  const activity = (await readActivity().catch(() => []))
    .filter((r) => r.galleryId === g.id)
    .slice(0, 15)
    .map(({ time, event, detail, visitor }) => ({ time, event, detail: detail.slice(0, 220), visitor }));

  return (
    <AdminShell studio={studio} email={owner.email} demo={owner.demo} back>
      <GalleryManager
        demo={owner.demo}
        stripe={stripeReady()}
        gmail={owner.gmail}
        activity={activity}
        gallery={{
          id: g.id,
          slug: g.slug,
          title: g.title,
          settings: g.settings,
          hidden: !!g.hidden,
          items: g.items,
          cover: g.cover ?? null,
          sections: g.sections,
          expired: isExpired(g.settings),
          clientLogo: g.clientLogoId ? `/api/client-logo/${g.slug}?v=${g.clientLogoId.slice(-8)}` : undefined,
          paid: !!g.paid,
          portal: g.settings.client?.trim() ? `/c/${portalSlug(g.settings.client)}` : undefined,
        }}
      />
    </AdminShell>
  );
}
