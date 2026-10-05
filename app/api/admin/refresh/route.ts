import { clearCache, getRecordById, loadAll } from "@/lib/galleries";
import { readSession } from "@/lib/owner";

export const runtime = "nodejs";

/** Re-reads Drive after uploads so new files show up right away. Returns the gallery's current items. */
export async function POST(req: Request) {
  if (!(await readSession())) return Response.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { galleryId } = await req.json().catch(() => ({}));
  clearCache();
  await loadAll(true);
  const g = galleryId ? await getRecordById(String(galleryId)) : null;
  return Response.json({ ok: true, items: g?.items ?? [], cover: g?.cover ?? null });
}
