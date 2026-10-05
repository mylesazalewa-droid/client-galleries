import { cookies } from "next/headers";
import { cookieName, passwordMatches, tokenFor } from "@/lib/access";
import { logEvent } from "@/lib/activity";
import { getRecord } from "@/lib/galleries";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { slug, password } = await req.json().catch(() => ({}));
  const g = typeof slug === "string" ? await getRecord(slug) : null;
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });

  // Small fixed delay makes guessing slower.
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(g, String(password ?? ""))) {
    return Response.json({ ok: false, error: "That password didn't work." }, { status: 401 });
  }

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
