import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GalleryView from "@/components/GalleryView";
import LockScreen from "@/components/LockScreen";
import { canView } from "@/lib/access";
import { studio } from "@/lib/config";
import { getRecord, loadAll, toGallery } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await getRecord((await params).slug);
  if (!g) return {};
  const open = !g.settings.password;
  const cover = open ? toGallery(g).cover?.full : undefined;
  return {
    title: g.title,
    description: g.settings.client ? `For ${g.settings.client}` : undefined,
    openGraph: { title: g.title, images: cover ? [cover] : undefined },
  };
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params;
  // The owner can preview drafts; everyone else only sees published galleries.
  const g = (await getRecord(slug)) ?? ((await currentOwner()) ? (await loadAll()).find((r) => r.slug === slug) ?? null : null);
  if (!g) notFound();

  if (!(await canView(g))) {
    return <LockScreen slug={g.slug} title={g.title} client={g.settings.client} studio={studio} />;
  }
  return <GalleryView gallery={toGallery(g)} studio={studio} />;
}
