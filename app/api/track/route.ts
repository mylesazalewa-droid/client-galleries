import { logEvent } from "@/lib/activity";
import { getRecord } from "@/lib/galleries";

export const runtime = "nodejs";

/** The gallery page pings this once per visit so you can see when a client opened it. */
export async function POST(req: Request) {
  const { slug } = await req.json().catch(() => ({}));
  const g = typeof slug === "string" ? await getRecord(slug) : null;
  if (!g) return Response.json({ ok: false }, { status: 404 });
  await logEvent(req, { galleryId: g.id, title: g.title, event: "Opened" });
  return Response.json({ ok: true });
}
