import type { Metadata } from "next";
import ContactForm from "@/components/site/ContactForm";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Request a quote · Sow Creative Studios" }, description: "Tell me about your project and get a clear quote.", robots: { index: true, follow: true } };

export default async function Contact({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const studio = await getStudio();
  const { type } = await searchParams;
  const map: Record<string, string> = { "Brand & story films": "Brand or story film", "Conferences & events": "Conference or event", "Photography": "Photography", "Editing & post-production": "Editing only" };
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main">
        <div className="site-contact">
          <div>
            <div className="eyebrow">Contact</div>
            <h1 className="serif site-h1">Let&apos;s talk about your project.</h1>
            <p className="site-lead">Share a few details and you&apos;ll get a reply within a couple of business days, usually with a few questions and then a clear quote.</p>
            {studio.email && <p className="hint">Prefer email? <a href={`mailto:${studio.email}`}>{studio.email}</a></p>}
          </div>
          <ContactForm initialType={type ? map[type] ?? type : undefined} />
        </div>
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
