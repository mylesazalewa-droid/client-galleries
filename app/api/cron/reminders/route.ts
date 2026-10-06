import { logEvent, readActivity } from "@/lib/activity";
import { getStudio } from "@/lib/brand";
import { isDemo } from "@/lib/config";
import { isExpired, loadAll, payLink } from "@/lib/galleries";
import { draftFor, LABELS, render, sendGmail, splitEmails, storedMailerToken } from "@/lib/mail";
import { payParts } from "@/lib/payments";

export const runtime = "nodejs";
export const maxDuration = 120;

const DAY = 86_400_000;
const EVERY_DAYS = 3; // unpaid reminders: every 3 days…
const MAX_REMINDERS = 3; // …at most 3 times per payment
const CLOSING_DAYS = 3; // closing reminder: 3 days before the last day

/**
 * Runs once a day (vercel.json). Sends the automatic reminders you've turned on per gallery.
 * Every email is written to the activity sheet first-checked, so running it twice never double-sends.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (isDemo) return Response.json({ ok: true, sent: [], note: "demo mode" });

  const sender = await storedMailerToken().catch(() => null);
  if (!sender) return Response.json({ ok: false, error: "Gmail isn't connected (or the sign-in expired). Open the dashboard and click Connect Gmail." });

  const [galleries, rows, studio] = await Promise.all([loadAll(true), readActivity(), getStudio()]);
  const emailed = rows.filter((r) => r.event === "Emailed");
  const origin = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(req.url).origin);
  const now = Date.now();
  const sent: string[] = [];

  for (const g of galleries) {
    const s = g.settings;
    const to = splitEmails(s.clientEmail);
    if (!to.length || g.hidden || isExpired(s)) continue;
    const mine = emailed.filter((r) => r.galleryId === g.id);

    const send = async (kind: "unpaid" | "closing", tag: string, payUrl?: string) => {
      const draft = draftFor(kind, g, studio, origin, payUrl);
      const { html, text } = render(draft, studio, origin);
      await sendGmail(sender.token, { to, subject: draft.subject, html, text, from: { name: studio.name, email: sender.email } });
      await logEvent(req, { galleryId: g.id, title: g.title, event: "Emailed", detail: `${LABELS[kind]} · ${tag} · ${to.join(", ")} · automatic` }, { includeOwner: true, wait: true });
      sent.push(`${g.title}: ${LABELS[kind]}`);
    };

    try {
      // Unpaid payment
      if (s.remindUnpaid && s.hold) {
        const paid = new Set(g.paidLinks ?? []);
        const next = payParts(s).find((p) => !paid.has(p.id));
        if (next) {
          const reminders = mine.filter((r) => r.detail.startsWith(LABELS.unpaid) && r.detail.includes(next.id));
          const last = Math.max(Date.parse(s.payRequestedAt ?? "") || 0, ...reminders.map((r) => Date.parse(r.at) || 0));
          if (reminders.length < MAX_REMINDERS && now - last >= EVERY_DAYS * DAY) await send("unpaid", next.id, payLink(g, next.url));
        }
      }
      // Gallery closing soon
      if (s.remindClosing && s.expires) {
        const end = Date.parse(`${s.expires}T23:59:59`);
        const left = end - now;
        const already = mine.some((r) => r.detail.startsWith(LABELS.closing) && r.detail.includes(s.expires!));
        if (left > 0 && left <= CLOSING_DAYS * DAY && !already) await send("closing", s.expires);
      }
    } catch (e) {
      console.error("reminder failed", g.title, e);
    }
  }
  return Response.json({ ok: true, sent });
}
