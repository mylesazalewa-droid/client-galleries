import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Closed from "@/components/Closed";
import GalleryView from "@/components/GalleryView";
import LockScreen from "@/components/LockScreen";
import ReviewView from "@/components/ReviewView";
import { canView } from "@/lib/access";
import { brandFor, themeStyle, watermarkFor } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { getRecord, getReview, isExpired, loadAll, loadReviews, toGallery } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";
import { forgetPayments } from "@/lib/payments";

export type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ as?: string; paid?: string }> };

export async function galleryMetadata({ params }: Props, route: "g" | "review" = "g"): Promise<Metadata> {
  const { slug } = await params;
  const g = route === "review" ? await getReview(slug) : await getRecord(slug);
  if (!g) return {};
  const description = g.settings.client ? `Prepared for ${g.settings.client}` : undefined;
  const image = `/api/og?g=${slug}`;
  const { studio } = await brandFor(g.settings);
  return {
    title: { absolute: `${g.title} · ${studio.name}` },
    description,
    openGraph: { title: g.title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: g.title, description, images: [image] },
  };
}

/** Delivery galleries live at /g/…; Markup review projects at /review/…. They never share records. */
export async function renderGallery({ params, searchParams }: Props, route: "g" | "review") {
  const { slug } = await params;
  const { as, paid } = await searchParams;
  const signedIn = !!(await currentOwner());
  // "?as=client" lets the owner see exactly what a client sees.
  const owner = signedIn && as !== "client";

  const list = route === "review" ? loadReviews : loadAll;
  let g = (route === "review" ? await getReview(slug) : await getRecord(slug)) ?? (signedIn ? (await list()).find((r) => r.slug === slug) ?? null : null);
  // Just back from Stripe: re-check payments so the gallery opens unlocked.
  if (g && route === "g" && paid === "1" && g.settings.hold) {
    forgetPayments();
    g = (await loadAll(true)).find((r) => r.slug === slug) ?? g;
  }
  if (!g) notFound();
  const { studio, brand, profile } = await brandFor(g.settings);
  const theme = themeStyle(studio);

  if (!owner) {
    if (isExpired(g.settings)) return <div style={theme}><Closed studio={studio} title={g.title} /></div>;
    const locked = !(await canView(g, { ignoreOwner: true }));
    if (locked) return <div style={theme}><LockScreen slug={g.slug} title={g.title} client={g.settings.client} studio={studio} preview={signedIn} /></div>;
  }

  const notes = owner
    ? [
        g.hidden && "This is a draft, so clients can't open it.",
        g.settings.password && `Clients need the password “${g.settings.password}”.`,
        isExpired(g.settings) && "This gallery has expired, so clients see a closed page.",
        !isExpired(g.settings) && g.settings.expires && `Closes after ${formatDate(g.settings.expires)}.`,
        g.settings.hold && "Downloads are on hold until paid, so clients see watermarked previews.",
        profile && `Shown to clients under the “${profile.name}” brand.`,
      ].filter((x): x is string => !!x)
    : [];

  if (route === "review") {
    // Drafts: always watermarked so review copies can't stand in for finals.
    return (
      <div style={theme}>
        <ReviewView
          gallery={{ ...toGallery(g, owner), allowDownload: owner || g.settings.downloads === true, watermark: watermarkFor(brand, studio.name, g.settings, profile) }}
          studio={studio}
          owner={owner ? { clientView: `/review/${g.slug}?as=client`, notes } : undefined}
          review={{ id: g.id, status: g.settings.reviewStatus ?? "", paused: !!g.settings.paused, message: g.settings.message }}
        />
      </div>
    );
  }

  return (
    <div style={theme}>
    <GalleryView
      gallery={{ ...toGallery(g, owner), watermark: g.settings.hold ? watermarkFor(brand, studio.name, g.settings, profile) : undefined }}
      justPaid={paid === "1" && !g.settings.hold ? true : paid === "1" && g.paidLinks?.length ? "partial" : paid === "pending" ? false : undefined}
      studio={studio}
      owner={owner ? { clientView: `/g/${g.slug}?as=client`, notes } : undefined}
    />
    </div>
  );
}
