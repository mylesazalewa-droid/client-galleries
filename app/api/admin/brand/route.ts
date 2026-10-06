import { clampOpacity, clearBrandCache, LAYOUTS, loadBrand, type Brand } from "@/lib/brand";
import { ensureBrandFolder, startUpload, writeBrand } from "@/lib/drive-admin";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

const TEXT: (keyof Brand)[] = ["name", "tagline", "headline", "email", "website", "accent"];

/** Saves studio details. Pass logoId/landingId (from an upload) or null to remove them. */
export const PATCH = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { brand, fileId } = await loadBrand(true);
  const next: Brand = { ...brand };
  for (const k of TEXT) if (k in body) (next as Record<string, unknown>)[k] = String(body[k] ?? "").trim().slice(0, 300) || undefined;
  if (next.accent && !/^#[0-9a-f]{6}$/i.test(next.accent)) return Response.json({ ok: false, error: "Accent must be a color like #c98a4b" }, { status: 400 });
  if (next.website && !/^https?:\/\//i.test(next.website)) next.website = `https://${next.website}`;
  if ("logoId" in body) next.logoId = body.logoId || undefined;
  if ("watermarkId" in body) next.watermarkId = body.watermarkId || undefined;
  // Watermark library
  if (body.addMark?.id) {
    next.marks = [...(next.marks ?? []).filter((m) => m.id !== body.addMark.id), { id: String(body.addMark.id), name: String(body.addMark.name ?? "Watermark").replace(/\.[a-z0-9]+$/i, "").slice(0, 60) }];
  }
  if (body.removeMark) {
    next.marks = (next.marks ?? []).filter((m) => m.id !== body.removeMark);
    if (next.watermarkId === body.removeMark) next.watermarkId = undefined;
    if (next.markDefault === body.removeMark) next.markDefault = undefined;
  }
  if ("markDefault" in body) next.markDefault = body.markDefault ? String(body.markDefault) : undefined;
  if ("markOpacity" in body) next.markOpacity = clampOpacity(body.markOpacity);
  if ("markLayout" in body) next.markLayout = LAYOUTS.includes(body.markLayout) ? body.markLayout : undefined;
  if ("landingId" in body) {
    next.landingId = body.landingId || undefined;
    next.landingKind = body.landingId ? (body.landingKind === "video" ? "video" : "photo") : undefined;
  }
  const { token } = await ownerToken();
  await writeBrand(token, fileId, next);
  clearBrandCache();
  return Response.json({ ok: true, brand: next });
});

/** Starts an upload of a logo or landing background into CLIENTS/_brand. */
export const POST = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  const kind = body.kind === "landing" ? "landing" : body.kind === "watermark" ? "watermark" : "logo";
  if (!(kind === "landing" ? /^(image|video)\// : /^image\//).test(type)) {
    return Response.json({ ok: false, error: kind === "landing" ? "Use a photo or a video." : "This needs to be an image (a PNG with a transparent background works best)." }, { status: 400 });
  }
  const { token } = await ownerToken();
  const { folderId } = await loadBrand(true);
  const folder = await ensureBrandFolder(token, folderId);
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const name = `${kind}-${Date.now()}-${String(body.name ?? "file").replace(/[\\/]/g, "_").slice(0, 120)}`;
  const uploadUrl = await startUpload(token, folder, { name, type, size: Number(body.size ?? 0) }, origin);
  clearBrandCache();
  return Response.json({ ok: true, uploadUrl });
});
