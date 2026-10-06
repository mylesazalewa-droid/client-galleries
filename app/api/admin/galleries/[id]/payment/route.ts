import { logEvent } from "@/lib/activity";
import { writeSettings } from "@/lib/drive-admin";
import { clearCache, getRecordById, type GalleryRecord } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";
import { forgetPayments, payParts } from "@/lib/payments";
import { createPaymentLink, deactivatePaymentLink, money, paymentsFor, stripeReady } from "@/lib/stripe";
import type { GallerySettings, PayPart } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const errorJson = (e: unknown) => Response.json({ ok: false, error: e instanceof Error ? e.message : "Something went wrong" }, { status: 400 });

async function load(ctx: Ctx) {
  const { id } = await ctx.params;
  return getRecordById(id, true);
}

async function retire(ids: string[]) {
  if (!stripeReady()) return;
  await Promise.all(ids.map((id) => deactivatePaymentLink(id).catch(() => {})));
}

const cents = (v: unknown) => Math.round(Number(String(v ?? "").replace(/[$,\s]/g, "")) * 100);

/** Settings without the old single-request fields (requests are always stored as parts now). */
function withParts(s: GallerySettings, parts: PayPart[] | undefined): GallerySettings {
  return { ...s, payParts: parts, payUrl: undefined, payLinkId: undefined, payAmount: undefined, payLabel: undefined };
}

async function save(g: GalleryRecord, settings: GallerySettings) {
  const { token } = await ownerToken();
  await writeSettings(token, g.id, g.settingsFileId, settings);
  clearCache();
  return settings;
}

/** Payment status: each part, whether it's paid, and the payments Stripe has for it. */
export const GET = adminRoute(async (_req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const parts = payParts(g.settings);
  const paid = new Set(g.paidLinks ?? []);
  let warning = "";
  const out = await Promise.all(
    parts.map(async (p) => {
      let payments: { id: string; label: string; email?: string; created: number }[] = [];
      if (stripeReady()) {
        try {
          payments = (await paymentsFor(p.id)).map((x) => ({ id: x.id, label: money(x.amount, x.currency), email: x.email, created: x.created }));
        } catch (e) {
          warning = e instanceof Error ? e.message : "";
        }
      }
      return { ...p, paid: paid.has(p.id) || payments.length > 0, payments };
    }),
  );
  return Response.json({ ok: true, connected: stripeReady(), parts: out, warning });
});

/** Creates a payment request — one link, or a deposit + final pair — and holds the gallery until it's paid. */
export const POST = adminRoute(async (req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const total = cents(body.amount);
  const deposit = body.deposit ? cents(body.deposit) : 0;
  if (!Number.isFinite(total) || total < 50) return Response.json({ ok: false, error: "Enter an amount of at least $0.50." }, { status: 400 });
  if (total > 99_999_999) return Response.json({ ok: false, error: "That amount is too large for one payment." }, { status: 400 });
  if (deposit && (!Number.isFinite(deposit) || deposit < 50 || deposit > total - 50)) {
    return Response.json({ ok: false, error: "The deposit has to be at least $0.50 and less than the total." }, { status: 400 });
  }
  const label = String(body.label ?? "").trim().slice(0, 180) || `${g.title}${g.settings.client ? ` — ${g.settings.client}` : ""}`;
  const plan = deposit
    ? [
        { amount: deposit, label: `${label} — deposit` },
        { amount: total - deposit, label: `${label} — final payment` },
      ]
    : [{ amount: total, label }];
  const origin = new URL(req.url).origin;
  try {
    const parts: PayPart[] = [];
    for (const p of plan) {
      const link = await createPaymentLink({ amount: p.amount, label: p.label, galleryId: g.id, galleryTitle: g.title, origin });
      parts.push({ id: link.id, url: link.url, amount: p.amount, label: p.label });
    }
    await retire(payParts(g.settings).map((p) => p.id));
    const settings = await save(g, withParts({ ...g.settings, hold: true, payRequestedAt: new Date().toISOString() }, parts));
    return Response.json({ ok: true, settings });
  } catch (e) {
    return errorJson(e);
  }
});

/**
 * { action: "paid", part?: linkId } — paid some other way (check, cash). With `part`, marks just that part;
 * the gallery unlocks once every part is paid. Without it, marks the whole request paid.
 */
export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "paid") return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  const parts = payParts(g.settings);
  const already = new Set(g.paidLinks ?? []);
  const targets = body.part ? parts.filter((p) => p.id === body.part) : parts.filter((p) => !already.has(p.id));
  if (body.part && !targets.length) return Response.json({ ok: false, error: "That payment isn't part of this request" }, { status: 400 });
  try {
    await retire(targets.map((p) => p.id));
    for (const p of targets) {
      await logEvent(req, { galleryId: g.id, title: g.title, event: "Marked paid", detail: [money(p.amount), p.label, "marked paid by you", p.id].join(" · ") }, { includeOwner: true, wait: true });
    }
    if (!parts.length) {
      await logEvent(req, { galleryId: g.id, title: g.title, event: "Marked paid", detail: "marked paid by you" }, { includeOwner: true, wait: true });
    }
    const allPaid = parts.every((p) => already.has(p.id) || targets.includes(p));
    const settings = allPaid ? await save(g, { ...g.settings, hold: false }) : g.settings;
    forgetPayments();
    clearCache();
    return Response.json({ ok: true, settings, allPaid });
  } catch (e) {
    return errorJson(e);
  }
});

/** Cancels the payment request (its links stop working). The hold stays as you set it. */
export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const g = await load(ctx);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  try {
    await retire(payParts(g.settings).map((p) => p.id));
    const settings = await save(g, withParts(g.settings, undefined));
    return Response.json({ ok: true, settings });
  } catch (e) {
    return errorJson(e);
  }
});
