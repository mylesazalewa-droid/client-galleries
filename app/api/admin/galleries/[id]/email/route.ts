import { logEvent } from "@/lib/activity";
import { getStudio } from "@/lib/brand";
import { getRecordById, payLink, type GalleryRecord } from "@/lib/galleries";
import { draftFor, LABELS, MailError, render, sendGmail, splitEmails, type MailKind } from "@/lib/mail";
import { adminRoute, ownerToken } from "@/lib/owner";
import { payParts } from "@/lib/payments";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const KINDS: MailKind[] = ["invite", "payment", "unpaid", "closing"];

function nextPayUrl(g: GalleryRecord) {
  const paid = new Set(g.paidLinks ?? []);
  const next = payParts(g.settings).find((p) => !paid.has(p.id));
  return next ? payLink(g, next.url) : payLink(g);
}

/** The default draft for an email, so it can be edited before sending. */
export const GET = adminRoute(async (req: Request, ctx: Ctx) => {
  const g = await getRecordById((await ctx.params).id);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind") as MailKind;
  if (!KINDS.includes(kind)) return Response.json({ ok: false, error: "Unknown email" }, { status: 400 });
  const draft = draftFor(kind, g, await getStudio(), new URL(req.url).origin, nextPayUrl(g));
  return Response.json({ ok: true, to: g.settings.clientEmail ?? "", draft });
});

/** Sends an email to the client from your Gmail. */
export const POST = adminRoute(async (req: Request, ctx: Ctx) => {
  const g = await getRecordById((await ctx.params).id);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as MailKind;
  if (!KINDS.includes(kind)) return Response.json({ ok: false, error: "Unknown email" }, { status: 400 });
  const to = splitEmails(body.to);
  if (!to.length) return Response.json({ ok: false, error: "Add the client's email address." }, { status: 400 });
  if (to.length > 10) return Response.json({ ok: false, error: "That's a lot of recipients — 10 at most." }, { status: 400 });

  const studio = await getStudio();
  const origin = new URL(req.url).origin;
  const base = draftFor(kind, g, studio, origin, nextPayUrl(g));
  const draft = { subject: String(body.subject ?? base.subject).slice(0, 200), body: String(body.body ?? base.body).slice(0, 8000), button: base.button };
  const { html, text } = render(draft, studio, origin);
  try {
    const { email, token } = await ownerToken();
    await sendGmail(token, { to, subject: draft.subject, html, text, from: { name: studio.name, email } });
    await logEvent(req, { galleryId: g.id, title: g.title, event: "Emailed", detail: `${LABELS[kind]} · ${to.join(", ")}` }, { includeOwner: true });
    return Response.json({ ok: true });
  } catch (e) {
    const status = e instanceof MailError ? e.status : 400;
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Couldn't send", reconnect: status === 403 && /connect/i.test(String((e as Error).message)) }, { status: 400 });
  }
});
