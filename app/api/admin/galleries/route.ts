import { createGallery, ensureActivitySheet } from "@/lib/drive-admin";
import { getRecordById, slugFor } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Create a gallery: a new folder inside CLIENTS plus its gallery.json. */
export const POST = adminRoute(async (req: Request) => {
  const { token } = await ownerToken();
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return Response.json({ ok: false, error: "Give the gallery a name." }, { status: 400 });

  const id = await createGallery(token, title, {
    client: body.client,
    date: body.date,
    message: body.message,
    password: body.password,
    downloads: body.downloads !== false,
    hidden: !!body.hidden,
    expires: body.expires,
    picks: !!body.picks,
  });
  await ensureActivitySheet(token).catch((e) => console.warn("activity sheet setup failed", e));
  await getRecordById(id, true);
  return Response.json({ ok: true, id, slug: slugFor(title, id) });
});
