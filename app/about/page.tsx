import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "About · Sow Creative Studios" }, description: "Sow Creative Studios is the film and photo studio of Myles Zalewa, based in Kalamazoo, Michigan.", robots: { index: true, follow: true } };

export default async function About() {
  const studio = await getStudio();
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main">
        <div className="site-about">
          <div>
            <div className="eyebrow">About</div>
            <h1 className="serif site-h1">Hi, I&apos;m Myles.</h1>
          </div>
          <div className="site-prose">
            <p className="site-lead" style={{ marginTop: 0 }}>Sow Creative Studios is my film and photo studio, based in Kalamazoo, Michigan.</p>
            <p>I&apos;ve spent about fifteen years behind the camera and in the edit bay, from live broadcast and church media to brand films and conference content for credit unions and financial organizations.</p>
            <p>The work I love most puts real people at the center: the member whose story shows what an organization actually does, the speaker whose message deserves to reach more than the room, the team that wants to be seen as they really are.</p>
            <p>I keep the process simple. We plan together, I handle the shoot and the edit, you leave notes right on the video, and the finished files land in a private gallery ready to share.</p>
            <div className="site-hero-cta" style={{ marginTop: 28 }}>
              <Link href="/contact" className="btn primary">Start a project</Link>
              <Link href="/work" className="btn">See the work</Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
