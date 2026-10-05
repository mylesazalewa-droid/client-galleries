import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Lock } from "@/components/icons";
import { isDemo, showIndex, studio } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { loadAll, toSummary } from "@/lib/galleries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const listed = showIndex || isDemo;
  const galleries = listed ? (await loadAll()).filter((g) => !g.hidden).map(toSummary) : [];

  return (
    <main className="home">
      <header>
        <Link href="/" className="brand serif">{studio.name}</Link>
        <ThemeToggle />
      </header>

      <section className="intro">
        <div className="eyebrow">{studio.tagline}</div>
        <h1 className="serif">Client <em>galleries</em></h1>
      </section>

      {listed ? (
        <div className="cards">
          {galleries.map((g) => (
            <Link key={g.slug} href={`/g/${g.slug}`} className="card">
              <div className="img">
                {g.locked || !g.coverThumb ? <Lock /> : <img src={g.coverThumb} alt="" loading="lazy" />}
              </div>
              <h3 className="serif">{g.title}</h3>
              <div className="eyebrow">{[g.client, formatDate(g.date)].filter(Boolean).join(" · ")}</div>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", maxWidth: "46ch" }}>
          Looking for your gallery? Use the private link {studio.name.split(" ")[0]} sent you
          {studio.email ? <> or email <a href={`mailto:${studio.email}`}>{studio.email}</a></> : null}.
        </p>
      )}

      {isDemo && (
        <div className="notice">
          <b>Demo mode.</b> These galleries use sample media until Google Drive is connected. The second gallery&apos;s password is <code>demo</code>.{" "}
          <a href="/admin">Owner dashboard →</a>
        </div>
      )}
    </main>
  );
}
