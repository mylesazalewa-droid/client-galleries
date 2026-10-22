import { linkCode, loadAll, loadReviews } from "@/lib/galleries";

export const runtime = "nodejs";

/** Turns a gallery code (or a pasted link) into the gallery's address. */
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("code") ?? "").trim().toLowerCase();
  const code = raw.match(/([0-9a-f]{6})\/?$/)?.[1] ?? raw.replace(/[^0-9a-f]/g, "").slice(-6);
  await new Promise((r) => setTimeout(r, 300)); // slows down guessing
  if (code.length !== 6) return Response.json({ ok: false }, { status: 404 });
  const match = (r: { id: string; slug: string; hidden?: boolean }) => !r.hidden && (linkCode(r.id) === code || r.slug.endsWith(code));
  const gal = (await loadAll()).find(match);
  const rev = gal ? undefined : (await loadReviews()).find(match);
  const g = gal ?? rev;
  return g ? Response.json({ ok: true, review: !!rev, href: rev ? `/review/${g.slug}` : `/g/${g.slug}` }) : Response.json({ ok: false }, { status: 404 });
}
