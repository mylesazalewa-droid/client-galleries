import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { getStudio } from "@/lib/brand";
import { SERVICES } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Pricing · Sow Creative Studios" }, description: "Every project is quoted to fit what you need. Here's what's included and what shapes the price.", robots: { index: true, follow: true } };

const FACTORS = [
  ["Amount of footage", "An hour of interviews, or several days of multi-camera event coverage."],
  ["Edit length & versions", "One hero edit, or cutdowns for social, web and screens."],
  ["Finishing", "Color correction, sound mix, graphics, titles and captions."],
  ["Turnaround", "Standard timing, or rush delivery for next-day use."],
  ["Revisions", "How many review rounds are included, spelled out in your quote."],
  ["Music & licensing", "Where and how long you'll use the finished work."],
];

const FAQ = [
  ["How do I get a price?", "Send a few details about your footage through the quote form. I'll follow up with questions if needed, then a clear quote with what's included."],
  ["How do I send footage?", "I'll send you a private upload link, or share a Google Drive, Dropbox or WeTransfer link with the quote request."],
  ["How does payment work?", "Most projects have a deposit to book the date and a final payment at delivery. You can pay online by card right from your gallery."],
  ["How do revisions work?", "You review drafts in a private review page and leave notes right on the video at the exact moment. The number of revision rounds is spelled out in your quote."],
  ["How are files delivered?", "In a private gallery with every format you need, full quality, ready to download and share with your team."],
  ["Do you work with agencies?", "Yes. I edit for your clients and deliver everything, including the review page, under your agency's brand."],
  ["Do you film?", "My focus is editing and post-production. Send footage from your team or videographer and I'll take it from there."],
];

export default async function Pricing() {
  const studio = await getStudio();
  return (
    <div className="site">
      <SiteHeader studio={studio} />
      <main className="site-main">
        <div className="eyebrow">Pricing</div>
        <h1 className="serif site-h1">Every project is quoted to fit.</h1>
        <p className="site-lead">No two projects are the same, so there are no one-size packages. Tell me what you need and you&apos;ll get a clear quote with exactly what&apos;s included.</p>
        <Link href="/contact" className="btn primary">Request a quote</Link>

        <section className="site-sec">
          <div className="site-tiers">
            {SERVICES.map((s) => (
              <article key={s.id} id={s.id} className="site-tier">
                <h2 className="serif">{s.title}</h2>
                <p>{s.body}</p>
                <ul>{s.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                <Link href={`/contact?type=${encodeURIComponent(s.title)}`} className="btn">Get a quote</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="site-sec">
          <div className="site-sec-head">
            <div className="eyebrow">What shapes the price</div>
            <h2 className="serif">The things that move the number.</h2>
          </div>
          <div className="site-factors">
            {FACTORS.map(([t, d]) => <div key={t}><b>{t}</b><p>{d}</p></div>)}
          </div>
        </section>

        <section className="site-sec">
          <div className="site-sec-head">
            <div className="eyebrow">Questions</div>
            <h2 className="serif">Good to know</h2>
          </div>
          <div className="site-faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>
      </main>
      <SiteFooter studio={studio} />
    </div>
  );
}
