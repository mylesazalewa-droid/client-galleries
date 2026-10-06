import { cookies } from "next/headers";
import { cookieName, passwordMatches, tokenFor } from "@/lib/access";
import { logEvent } from "@/lib/activity";
import { getRecord } from "@/lib/galleries";

export const runtime = "nodejs";

// Failed password attempts per visitor + gallery (per server instance): 8 tries, then a 15-minute pause.
const tries = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60_000;

export async function POST(req: Request) {
  const { slug, password } = await req.json().catch(() => ({}));
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `${ip}|${slug}`;
  const t = tries.get(key);
  if (t && t.n >= 8 && Date.now() < t.until) {
    return Response.json({ ok: false, error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const g = typeof slug === "string" ? await getRecord(slug) : null;
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });

  // Small fixed delay makes guessing slower.
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(g, String(password ?? ""))) {
    const cur = tries.get(key);
    tries.set(key, { n: (cur && Date.now() < cur.until ? cur.n : 0) + 1, until: Date.now() + WINDOW });
    if (tries.size > 5000) tries.clear();
    return Response.json({ ok: false, error: "That password didn't work." }, { status: 401 });
  }

  tries.delete(key);
  (await cookies()).set(cookieName(g.slug), tokenFor(g), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  await logEvent(req, { galleryId: g.id, title: g.title, event: "Unlocked with password" });
  return Response.json({ ok: true });
}
