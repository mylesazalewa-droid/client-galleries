import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Closed from "@/components/Closed";
import GalleryView from "@/components/GalleryView";
import LockScreen from "@/components/LockScreen";
import { canView } from "@/lib/access";
import { getStudio } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { getRecord, isExpired, loadAll, toGallery } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ as?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await getRecord((await params).slug);
  if (!g) return {};
  const open = !g.settings.password && !g.settings.hold;
  const cover = open ? toGallery(g).cover?.full : undefined;
  return {
    title: g.title,
    description: g.settings.client ? `For ${g.settings.client}` : undefined,
    openGraph: { title: g.title, images: cover ? [cover] : undefined },
  };
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { as } = await searchParams;
  const signedIn = !!(await currentOwner());
  // "?as=client" lets the owner see exactly what a client sees.
  const owner = signedIn && as !== "client";

  const g = (await getRecord(slug)) ?? (signedIn ? (await loadAll()).find((r) => r.slug === slug) ?? null : null);
  if (!g) notFound();
  const studio = await getStudio();

  if (!owner) {
    if (isExpired(g.settings)) return <Closed studio={studio} title={g.title} />;
    const locked = !(await canView(g, { ignoreOwner: true }));
    if (locked) return <LockScreen slug={g.slug} title={g.title} client={g.settings.client} studio={studio} preview={signedIn} />;
  }

  const notes = owner
    ? [
        g.hidden && "This is a draft, so clients can't open it.",
        g.settings.password && `Clients need the password “${g.settings.password}”.`,
        isExpired(g.settings) && "This gallery has expired, so clients see a closed page.",
        !isExpired(g.settings) && g.settings.expires && `Closes after ${formatDate(g.settings.expires)}.`,
        g.settings.hold && "Downloads are on hold until paid, so clients see watermarked previews.",
      ].filter((x): x is string => !!x)
    : [];

  return (
    <GalleryView
      gallery={toGallery(g, owner)}
      studio={studio}
      owner={owner ? { clientView: `/g/${g.slug}?as=client`, notes } : undefined}
    />
  );
}
