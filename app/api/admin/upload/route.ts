import { startUpload } from "@/lib/drive-admin";
import { getRecordById } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

const ALLOWED = /^(image\/|video\/)/;

/** Returns a one-time Google upload link; the browser sends the file there directly. */
export const POST = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  let g = await getRecordById(String(body.galleryId ?? ""));
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });

  const name = String(body.name ?? "").replace(/[\\/]/g, "_").slice(0, 200);
  const type = String(body.type ?? "");
  const size = Number(body.size ?? 0);
  if (!name || !size) return Response.json({ ok: false, error: "Missing file details" }, { status: 400 });
  if (!ALLOWED.test(type)) return Response.json({ ok: false, error: `${name} isn't a photo or video` }, { status: 400 });

  // Upload into the main area or one of the gallery's sections.
  const folderId = body.folderId ? String(body.folderId) : g.id;
  if (folderId !== g.id && !g.sections.some((s) => s.id === folderId)) g = (await getRecordById(g.id, true)) ?? g; // new section
  if (folderId !== g.id && !g.sections.some((s) => s.id === folderId)) {
    return Response.json({ ok: false, error: "Section not found" }, { status: 404 });
  }

  const { token } = await ownerToken();
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const uploadUrl = await startUpload(token, folderId, { name, type, size }, origin);
  return Response.json({ ok: true, uploadUrl });
});
