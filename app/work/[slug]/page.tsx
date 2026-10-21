import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { showcase } from "@/lib/site";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  return (await showcase()).find((g) => g.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await find((await params).slug);
  return g ? { title: { absolute: `${g.title} · Sow Creative Studios` }, description: g.settings.blurb, robots: { index: true, follow: true } } : {};
}

export default async function Project({ params }: Props) {
  const g = await find((await params).slug);
  if (!g) notFound();
  const studio = await getStudio();
  const films = g.items.filter((i) => i.kind === "video");
  const photos = g.items.filter((i) => i.kind === "photo");
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main">
        <Link href="/work" className="site-back">← All work</Link>
        <h1 className="serif site-h1">{g.title}</h1>
        <p className="site-lead">{[g.settings.blurb, g.settings.client, g.settings.date && formatDate(g.settings.date)].filter(Boolean).join(" · ")}</p>
        <div className="site-films">
          {films.map((f) => (
            <figure key={f.id}>
              <video src={f.src} poster={f.full || undefined} controls playsInline preload="metadata" controlsList="nodownload" style={{ aspectRatio: f.width && f.height ? `${f.width} / ${f.height}` : "16 / 9" }} />
              <figcaption>{f.title ?? f.name.replace(/\.[^.]+$/, "")}</figcaption>
            </figure>
          ))}
        </div>
        {photos.length > 0 && (
          <div className="site-photos">
            {photos.map((p) => <img key={p.id} src={p.full || p.thumb} alt="" loading="lazy" style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : undefined }} />)}
          </div>
        )}
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
