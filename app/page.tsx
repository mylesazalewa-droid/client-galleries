import type { Metadata } from "next";
import Link from "next/link";
import CodeEntry from "@/components/CodeEntry";
import { getStudio } from "@/lib/brand";
import { isDemo } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Client galleries" } };

export default async function Home() {
  const studio = await getStudio();
  const headline = studio.headline || studio.name;
  const first = studio.name.split(" ")[0];

  return (
    <main className="land">
      <header className="land-bar land-top">
        <Link href="/" className="land-brand serif">
          {studio.logo ? <img src={studio.logo} alt={studio.name} /> : studio.name}
        </Link>
        <nav className="land-links">
          {studio.url && <a href={studio.url}>Website</a>}
          {studio.email && <a href={`mailto:${studio.email}`}>Contact</a>}
        </nav>
      </header>

      <div className="land-frame" aria-hidden>
        {studio.landing?.kind === "video" ? (
          <video src={studio.landing.src} poster={studio.landing.poster} autoPlay muted loop playsInline preload="metadata" />
        ) : studio.landing ? (
          <img src={studio.landing.src} alt="" />
        ) : (
          <span className="land-glow" />
        )}
      </div>

      <section className="land-bar land-bottom">
        <div className="land-title">
          <h1 className="serif">{headline}</h1>
          <p>{studio.tagline}</p>
        </div>
        <div className="land-entry">
          <CodeEntry />
          <p className="land-help">
            Your code is the last six characters of the gallery link {first} sent you.
            {isDemo && <> Demo: <a href="/g/lakeshore-credit-union-brand-film">open a sample gallery</a>.</>}
          </p>
        </div>
      </section>

      <footer className="land-foot">
        <span>© {new Date().getFullYear()} {studio.name}</span>
        <a href="/admin">Owner sign in</a>
      </footer>
    </main>
  );
}
