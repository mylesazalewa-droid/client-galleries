import type { Metadata } from "next";
import FilmPlayer from "@/components/FilmPlayer";
import { loadFilm } from "@/lib/film";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ k?: string; autoplay?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const r = await loadFilm(slug, id, (await searchParams).k ?? null);
  return { title: r.ok ? r.item.title ?? r.item.name : "Film" };
}

/** Bare player for iframes on a client's website. */
export default async function EmbedPage({ params, searchParams }: Props) {
  const { slug, id } = await params;
  const { k, autoplay } = await searchParams;
  const r = await loadFilm(slug, id, k ?? null);
  return (
    <div className="embed">
      {r.ok ? (
        <FilmPlayer item={r.item} allowDownload={false} bare autoPlay={autoplay === "1"} />
      ) : (
        <p className="embed-msg">{r.reason === "closed" ? "This film is no longer available." : "This film is private."}</p>
      )}
    </div>
  );
}
