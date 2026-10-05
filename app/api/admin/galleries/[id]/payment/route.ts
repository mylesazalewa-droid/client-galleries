import { logEvent } from "@/lib/activity";
import { writeSettings } from "@/lib/drive-admin";
import { clearCache, getRecordById } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";
import { forgetPayments } from "@/lib/payments";
import { createPaymentLink, deactivatePaymentLink, money, paymentsFor, stripeReady } from "@/lib/stripe";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const errorJson = (e: unknown) => Response.json({ ok: false, error: e instanceof Error ? e.message : "Something went wrong" }, { status: 400 });

async function load(ctx: Ctx) {
  const { id } = await ctx.params;
  return getRecordById(id, true);
}

async function retire(linkId?: string) {
  if (linkId && stripeReady()) await deactivatePaymentLink(linkId).catch(() => {});
}

/** Payment status: the open request and any payments Stripe has for it. */
export const GET = adminRoute(async (_req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const linkId = g.settings.payLinkId;
  try {
    const payments = linkId && stripeReady() ? await paymentsFor(linkId) : [];
    return Response.json({ ok: true, connected: stripeReady(), payments: payments.map((p) => ({ ...p, label: money(p.amount, p.currency) })) });
  } catch (e) {
    return Response.json({ ok: true, connected: stripeReady(), payments: [], warning: e instanceof Error ? e.message : "" });
  }
});

/** Creates a Stripe payment request for this gallery and puts it on hold until it's paid. */
export const POST = adminRoute(async (req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const amount = Math.round(Number(String(body.amount ?? "").replace(/[$,\s]/g, "")) * 100);
  if (!Number.isFinite(amount) || amount < 50) return Response.json({ ok: false, error: "Enter an amount of at least $0.50." }, { status: 400 });
  if (amount > 99_999_999) return Response.json({ ok: false, error: "That amount is too large for one payment." }, { status: 400 });
  const label = String(body.label ?? "").trim().slice(0, 200) || `${g.title}${g.settings.client ? ` — ${g.settings.client}` : ""}`;
  const origin = new URL(req.url).origin;
  try {
    const link = await createPaymentLink({ amount, label, galleryId: g.id, galleryTitle: g.title, origin });
    await retire(g.settings.payLinkId);
    const { token } = await ownerToken();
    const settings = { ...g.settings, hold: true, payUrl: link.url, payLinkId: link.id, payAmount: amount, payLabel: label };
    await writeSettings(token, g.id, g.settingsFileId, settings);
    clearCache();
    return Response.json({ ok: true, settings });
  } catch (e) {
    return errorJson(e);
  }
});

/** { action: "paid" } — you were paid some other way: unlock now and close the Stripe link. */
export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "paid") return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  try {
    await retire(g.settings.payLinkId);
    const { token } = await ownerToken();
    const settings = { ...g.settings, hold: false };
    await writeSettings(token, g.id, g.settingsFileId, settings);
    const detail = [g.settings.payAmount ? money(g.settings.payAmount) : "", "marked paid by you"].filter(Boolean).join(" · ");
    await logEvent(req, { galleryId: g.id, title: g.title, event: "Marked paid", detail }, { includeOwner: true, wait: true });
    forgetPayments();
    clearCache();
    return Response.json({ ok: true, settings });
  } catch (e) {
    return errorJson(e);
  }
});

/** Cancels the payment request (the link stops working). The hold stays as you set it. */
export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  try {
    await retire(g.settings.payLinkId);
    const { token } = await ownerToken();
    const settings = { ...g.settings, payUrl: undefined, payLinkId: undefined, payAmount: undefined, payLabel: undefined };
    await writeSettings(token, g.id, g.settingsFileId, settings);
    clearCache();
    return Response.json({ ok: true, settings });
  } catch (e) {
    return errorJson(e);
  }
});
