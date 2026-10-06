import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Lock } from "@/components/icons";
import { getStudio } from "@/lib/brand";
import { formatDate, plural } from "@/lib/format";
import { loadPortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await loadPortal((await params).slug);
  return p ? { title: `${p.client} — Projects`, description: `Everything ${(await getStudio()).name} has delivered for ${p.client}` } : {};
}

/** A client's home: every gallery made for them, newest first. */
export default async function PortalPage({ params }: Props) {
  const [portal, studio] = await Promise.all([loadPortal((await params).slug), getStudio()]);
  if (!portal) notFound();
  const { client, logo, galleries } = portal;

  return (
    <div className="portal">
      <header className="portal-top">
        <Brand studio={studio} />
      </header>
      <section className="portal-hero">
        {logo && <img className="portal-logo" src={logo} alt={client} />}
        <div className="eyebrow">Prepared for</div>
        <h1 className="serif">{client}</h1>
        <p>{plural(galleries.length, "project")} from {studio.name}. Bookmark this page; new work shows up here automatically.</p>
      </section>
      <main className="portal-grid">
        {galleries.map((g) => {
          const counts = [g.counts.films && plural(g.counts.films, "film"), g.counts.photos && plural(g.counts.photos, "photo")].filter(Boolean).join(" · ");
          return (
            <Link key={g.slug} href={`/g/${g.slug}`} className={`portal-card ${g.closed ? "closed" : ""}`}>
              <div className="portal-img">
                {g.cover ? <img src={g.cover} alt="" loading="lazy" /> : <span />}
                <span className="dash-tags">
                  {g.closed && <span className="tag warn">Closed</span>}
                  {!g.closed && g.hold && <span className="tag">Awaiting payment</span>}
                  {g.locked && <span className="tag"><Lock /> Password</span>}
                </span>
              </div>
              <div className="portal-body">
                {g.date && <div className="eyebrow">{formatDate(g.date)}</div>}
                <h2 className="serif">{g.title}</h2>
                <div className="portal-meta">
                  {counts}
                  {!g.closed && g.expires && <> · Available until {formatDate(g.expires)}</>}
                </div>
              </div>
            </Link>
          );
        })}
      </main>
      <p className="foot">
        {studio.name}
        {studio.email && <> · <a href={`mailto:${studio.email}`}>{studio.email}</a></>}
      </p>
    </div>
  );
}
