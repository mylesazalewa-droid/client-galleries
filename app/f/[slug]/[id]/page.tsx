import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import Closed from "@/components/Closed";
import DownloadMenu from "@/components/DownloadMenu";
import FilmPlayer from "@/components/FilmPlayer";
import FilmTrack from "@/components/FilmTrack";
import { getStudio, loadFilm } from "@/lib/film";
import { formatDate, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ k?: string; d?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const { k, d } = await searchParams;
  const r = await loadFilm(slug, id, k ?? null, d ?? null);
  if (!r.ok) return { title: r.g?.title };
  const title = r.item.title ?? r.item.name.replace(/\.[^.]+$/, "");
  const description = r.g.settings.client ? `Prepared for ${r.g.settings.client}` : r.g.title;
  const image = `/api/og?g=${slug}&f=${encodeURIComponent(r.item.id)}${k ? `&k=${k}` : ""}`;
  return {
    title,
    description,
    openGraph: { title, description, type: "video.other", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function FilmPage({ params, searchParams }: Props) {
  const { slug, id } = await params;
  const { k, d } = await searchParams;
  const [r, studio] = await Promise.all([loadFilm(slug, id, k ?? null, d ?? null), getStudio()]);
  if (!r.ok) {
    if (r.reason === "closed" && r.g) return <Closed studio={studio} title={r.g.title} />;
    if (r.reason === "private" && r.g) {
      return (
        <main className="center-page">
          <div className="lock">
            <div className="eyebrow">{studio.name}</div>
            <h1 className="serif">This film is private</h1>
            <p style={{ color: "var(--muted)", margin: "0 auto", maxWidth: "36ch" }}>The link may have been turned off. Ask whoever sent it for a new one.</p>
          </div>
        </main>
      );
    }
    notFound();
  }
  const { g, item, canDownload, clientLogo, owner } = r;
  const title = item.title ?? item.name.replace(/\.[^.]+$/, "");
  const meta = [g.settings.client, g.settings.date && formatDate(g.settings.date), item.duration && formatDuration(item.duration)].filter(Boolean).join(" · ");

  return (
    <div className="film-page">
      {!owner && <FilmTrack slug={g.slug} film={title} />}
      <header className="film-top">
        <Brand studio={studio} />
        {clientLogo && (
          <div className="prepared small">
            <span>Prepared for</span>
            <img src={clientLogo} alt={g.settings.client ?? "Client"} />
          </div>
        )}
      </header>
      <main className="film-main">
        <FilmPlayer item={item} allowDownload={canDownload} />
        <div className="film-info">
          <div style={{ minWidth: 0 }}>
            {meta && <div className="eyebrow">{meta}</div>}
            <h1 className="serif">{title}</h1>
          </div>
          {canDownload && <DownloadMenu item={item} className="btn" label="Download" />}
        </div>
        {g.settings.license && (
          <section className="rights compact">
            <h2 className="serif">Usage rights</h2>
            <div className="rights-body">
              {g.settings.license.split(/\n+/).map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </section>
        )}
      </main>
      <p className="foot">
        {studio.name}
        {studio.email && <> · <a href={`mailto:${studio.email}`}>{studio.email}</a></>}
      </p>
    </div>
  );
}
