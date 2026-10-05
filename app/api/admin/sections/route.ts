import { createFolder } from "@/lib/drive-admin";
import { clearCache, getRecordById } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Adds a section (a subfolder) to a gallery. */
export const POST = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const g = await getRecordById(String(body.galleryId ?? ""), true);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const name = String(body.name ?? "").replace(/^[_.]+/, "").trim().slice(0, 80);
  if (!name) return Response.json({ ok: false, error: "Name the section." }, { status: 400 });
  const { token } = await ownerToken();
  const id = await createFolder(token, g.id, name);
  clearCache();
  return Response.json({ ok: true, section: { id, name } });
});
