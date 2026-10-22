import { createReview, ensureActivitySheet } from "@/lib/drive-admin";
import { getRecordById, loadReviewTree, slugFor } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Create a Markup review project (separate from delivery galleries). */
export const POST = adminRoute(async (req: Request) => {
  const { token } = await ownerToken();
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return Response.json({ ok: false, error: "Give the project a name." }, { status: 400 });
  const folderId = body.folderId ? String(body.folderId) : "";
  if (folderId && !(await loadReviewTree(true)).folders.some((f) => f.id === folderId)) {
    return Response.json({ ok: false, error: "That folder doesn't exist anymore." }, { status: 400 });
  }
  const id = await createReview(token, title, {
    client: body.client,
    clientEmail: body.clientEmail,
    date: body.date || new Date().toISOString().slice(0, 10),
    message: body.message,
    password: body.password,
    downloads: false,
  }, folderId || undefined);
  await ensureActivitySheet(token).catch(() => {});
  await getRecordById(id, true);
  return Response.json({ ok: true, id, slug: slugFor(title, id) });
});
