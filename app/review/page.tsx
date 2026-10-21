import type { Metadata } from "next";
import CodeEntry from "@/components/CodeEntry";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";
import { isDemo } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Review drafts · Sow Creative Studios" } };

export default async function Review() {
  const studio = await getStudio();
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main narrow">
        <div className="eyebrow">For clients</div>
        <h1 className="serif site-h1">Review drafts</h1>
        <p className="site-lead">Watch the latest cut, leave notes right where you want changes, and approve each piece when it&apos;s ready. Use the review link from your email, or enter its code below.</p>
        <div className="site-card">
          <CodeEntry kind="review" />
          <p className="hint" style={{ marginBottom: 0 }}>
            Your code is the last six characters of the review link you were sent.
            {isDemo && <> Demo: <a href="/review/harbor-health-rough-cut">open a sample review</a>.</>}
          </p>
        </div>
        <div className="site-mini-grid">
          <div><b>Notes on the moment</b><p>Pause the video anywhere and type. Your note is pinned to that exact second.</p></div>
          <div><b>Pins on photos</b><p>Click a spot on a photo to leave a note right there.</p></div>
          <div><b>Approve</b><p>Mark each film or photo approved, and the final files come to your gallery.</p></div>
        </div>
        <p className="hint" style={{ marginTop: 28 }}>Looking for finished files? Go to <a href="/galleries">Galleries</a>.</p>
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
