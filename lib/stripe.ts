import "server-only";

/** Minimal Stripe REST client (form-encoded), using the restricted key from STRIPE_SECRET_KEY. */
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;

export class StripeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function encode(params: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") body.append(k, String(v));
  return body;
}

export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, string | number | undefined>, method = params ? "POST" : "GET"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError(500, "Stripe isn't connected yet. Add STRIPE_SECRET_KEY in Vercel.");
  const url = method === "GET" && params ? `https://api.stripe.com/v1/${path}?${encode(params)}` : `https://api.stripe.com/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method !== "GET" && params ? encode(params) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = json?.error?.message ?? `Stripe error (${res.status})`;
    console.error("stripe", method, path, res.status, msg);
    if (res.status === 401) throw new StripeError(401, `Stripe didn't accept the key in Vercel (STRIPE_SECRET_KEY). ${msg}`);
    throw new StripeError(res.status, `Stripe: ${msg}`);
  }
  return json as T;
}

export function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Creates a one-off price + Payment Link that returns the client to the gallery after paying. */
export async function createPaymentLink(o: { amount: number; label: string; galleryId: string; galleryTitle: string; origin: string }) {
  const price = await stripe<{ id: string }>("prices", {
    unit_amount: o.amount,
    currency: "usd",
    "product_data[name]": o.label.slice(0, 200),
    "product_data[metadata][gallery_id]": o.galleryId,
  });
  const link = await stripe<{ id: string; url: string }>("payment_links", {
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": 1,
    "after_completion[type]": "redirect",
    "after_completion[redirect][url]": `${o.origin}/api/paid?session_id={CHECKOUT_SESSION_ID}`,
    "metadata[gallery_id]": o.galleryId,
    "metadata[gallery]": o.galleryTitle.slice(0, 200),
  });
  return link;
}

export async function deactivatePaymentLink(id: string) {
  await stripe(`payment_links/${id}`, { active: "false" });
}

export type StripePayment = { id: string; amount: number; currency: string; email?: string; created: number };

/** Completed checkouts for a payment link, newest first. */
export async function paymentsFor(linkId: string): Promise<StripePayment[]> {
  const res = await stripe<{ data: Array<Record<string, any>> }>("checkout/sessions", { payment_link: linkId, status: "complete", limit: 10 }, "GET");
  return res.data.map((s) => ({ id: s.id, amount: s.amount_total ?? 0, currency: s.currency ?? "usd", email: s.customer_details?.email ?? undefined, created: s.created }));
}
