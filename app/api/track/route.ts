import { logEvent } from "@/lib/activity";
import { getRecord } from "@/lib/galleries";

export const runtime = "nodejs";

/** The gallery page (and single-film links) ping this once per visit so you can see when a client opened it. */
export async function POST(req: Request) {
  const { slug, film } = await req.json().catch(() => ({}));
  const g = typeof slug === "string" ? await getRecord(slug) : null;
  if (!g) return Response.json({ ok: false }, { status: 404 });
  await logEvent(req, { galleryId: g.id, title: g.title, event: film ? "Opened film link" : "Opened", detail: film ? String(film).slice(0, 200) : undefined });
  return Response.json({ ok: true });
}
