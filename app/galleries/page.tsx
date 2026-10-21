import type { Metadata } from "next";
import CodeEntry from "@/components/CodeEntry";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";
import { isDemo } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Client galleries · Sow Creative Studios" }, robots: { index: true, follow: true } };

export default async function Galleries() {
  const studio = await getStudio();
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main narrow">
        <div className="eyebrow">For clients</div>
        <h1 className="serif site-h1">Your gallery</h1>
        <p className="site-lead">Your finished films and photos live in a private gallery made just for you. Use the link from your email, or enter your gallery code below.</p>
        <div className="site-card">
          <CodeEntry kind="delivery" />
          <p className="hint" style={{ marginBottom: 0 }}>
            Your code is the last six characters of the gallery link you were sent.
            {isDemo && <> Demo: <a href="/g/lakeshore-credit-union-brand-film">open a sample gallery</a>.</>}
          </p>
        </div>
        <div className="site-mini-grid">
          <div><b>Watch & share</b><p>Stream every film in full quality and share single films with your team.</p></div>
          <div><b>Download finals</b><p>Every format in one place: full quality, web sizes, vertical cuts and captions.</p></div>
          <div><b>Pay securely</b><p>When a payment is due, pay by card right from the gallery.</p></div>
        </div>
        <p className="hint" style={{ marginTop: 28 }}>Reviewing a draft? Use the <a href="/review">Review</a> page instead.</p>
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
