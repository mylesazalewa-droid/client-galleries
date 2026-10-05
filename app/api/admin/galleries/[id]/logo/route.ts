import { startUpload, trash } from "@/lib/drive-admin";
import { CLIENT_LOGO, clearCache, getRecordById } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Starts an upload of the client's logo (replacing the old one) into the gallery folder as _client-logo.* */
export const POST = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const g = await getRecordById(id, true);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) {
    return Response.json({ ok: false, error: "Use a PNG (transparent works best), JPG or WebP." }, { status: 400 });
  }
  const { token } = await ownerToken();
  if (g.clientLogoId) await trash(token, g.clientLogoId).catch(() => {});
  const ext = type.split("/")[1].replace("jpeg", "jpg");
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const uploadUrl = await startUpload(token, g.id, { name: `${CLIENT_LOGO}.${ext}`, type, size: Number(body.size ?? 0) }, origin);
  clearCache();
  return Response.json({ ok: true, uploadUrl, type });
});

/** Removes the client's logo (moves it to Drive's trash). */
export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const g = await getRecordById(id, true);
  if (!g?.clientLogoId) return Response.json({ ok: true });
  const { token } = await ownerToken();
  await trash(token, g.clientLogoId).catch(() => {});
  clearCache();
  return Response.json({ ok: true });
});
