import { logEvent } from "@/lib/activity";
import { clearCache, getRecordById } from "@/lib/galleries";
import { forgetPayments } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Stripe Payment Links redirect here after checkout (…/api/paid?session_id={CHECKOUT_SESSION_ID}).
 * We confirm the session with Stripe, then log a "Paid" row, which lifts the gallery's payment hold.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = new URL("/", url.origin);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return Response.redirect(home, 303);

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  }).catch(() => null);
  const session = res?.ok ? await res.json() : null;
  const galleryId: string | undefined = session?.client_reference_id ?? undefined;
  const g = galleryId ? await getRecordById(galleryId, true) : null;
  if (!g) return Response.redirect(home, 303);

  const back = new URL(`/g/${g.slug}`, url.origin);
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    back.searchParams.set("paid", "pending");
    return Response.redirect(back, 303);
  }

  if (!g.paid) {
    const amount = typeof session.amount_total === "number" ? `${(session.amount_total / 100).toFixed(2)} ${String(session.currency ?? "").toUpperCase()}` : "";
    await logEvent(req, { galleryId: g.id, title: g.title, event: "Paid", detail: [amount, session.customer_details?.email].filter(Boolean).join(" · ") }, { includeOwner: true, wait: true });
  }
  forgetPayments();
  clearCache();
  back.searchParams.set("paid", "1");
  return Response.redirect(back, 303);
}
