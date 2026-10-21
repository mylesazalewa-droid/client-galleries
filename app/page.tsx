import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import ProjectCard from "@/components/site/ProjectCard";
import { getStudio } from "@/lib/brand";
import { PROCESS, SERVICES, showcase, toProject } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Sow Creative Studios · Film & photo in Kalamazoo, Michigan" },
  description: "Brand films, conference and event video, photography and post-production for organizations across Michigan and beyond.",
  robots: { index: true, follow: true },
};

export default async function Home() {
  // The old galleries.* address keeps working: its front door is the client gallery page.
  const host = (await headers()).get("host") ?? "";
  if (host.startsWith("galleries.")) redirect("/galleries");

  const studio = await getStudio();
  const work = (await showcase()).slice(0, 4).map(toProject);

  return (
    <div className="site">
      <SiteHeader studio={studio} overlay />
      <section className="site-hero">
        <div className="site-hero-media" aria-hidden>
          {studio.landing?.kind === "video" ? (
            <video src={studio.landing.src} poster={studio.landing.poster} autoPlay muted loop playsInline preload="metadata" />
          ) : studio.landing ? (
            <img src={studio.landing.src} alt="" />
          ) : (
            <span className="land-glow" />
          )}
        </div>
        <div className="site-hero-text">
          <div className="eyebrow">Film & photo · Kalamazoo, Michigan</div>
          <h1 className="serif">Stories worth <em>telling</em>, told well.</h1>
          <p>Brand films, conference coverage and photography for organizations that care about the people they serve.</p>
          <div className="site-hero-cta">
            <Link href="/contact" className="btn primary">Request a quote</Link>
            <Link href="/work" className="btn ghost">See the work</Link>
          </div>
        </div>
      </section>

      <main className="site-main">
        <section className="site-sec">
          <div className="site-sec-head">
            <div className="eyebrow">What I do</div>
            <h2 className="serif">From the first call to the final file.</h2>
          </div>
          <div className="site-services">
            {SERVICES.map((s, i) => (
              <Link key={s.id} href={`/pricing#${s.id}`} className="site-service">
                <span className="site-num">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.short}</p>
              </Link>
            ))}
          </div>
        </section>

        {work.length > 0 && (
          <section className="site-sec">
            <div className="site-sec-head row">
              <div>
                <div className="eyebrow">Recent work</div>
                <h2 className="serif">Selected projects</h2>
              </div>
              <Link href="/work" className="btn">All work →</Link>
            </div>
            <div className="site-work">
              {work.map((p) => <ProjectCard key={p.slug} p={p} />)}
            </div>
          </section>
        )}

        <section className="site-sec">
          <div className="site-sec-head">
            <div className="eyebrow">How it works</div>
            <h2 className="serif">Simple, start to finish.</h2>
          </div>
          <ol className="site-process">
            {PROCESS.map((p, i) => (
              <li key={p.title}><span className="site-num">{i + 1}</span><h3>{p.title}</h3><p>{p.text}</p></li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
