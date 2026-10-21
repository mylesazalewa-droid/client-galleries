import type { Metadata } from "next";
import Link from "next/link";
import ProjectCard from "@/components/site/ProjectCard";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";
import { showcase, toProject } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Work · Sow Creative Studios" }, description: "Brand films, event coverage and photography by Sow Creative Studios.", robots: { index: true, follow: true } };

export default async function Work() {
  const studio = await getStudio();
  const work = (await showcase()).map(toProject);
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main">
        <div className="eyebrow">Portfolio</div>
        <h1 className="serif site-h1">Work</h1>
        <p className="site-lead">A selection of recent films and photography.</p>
        {work.length ? (
          <div className="site-work">{work.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
        ) : (
          <div className="site-card">
            <p style={{ margin: 0 }}>New projects are on the way. In the meantime, <Link href="/contact">get in touch</Link> and I&apos;ll send examples that fit what you&apos;re planning.</p>
          </div>
        )}
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
