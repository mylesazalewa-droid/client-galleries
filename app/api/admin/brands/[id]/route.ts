import { clampOpacity, clearBrandCache, LAYOUTS, loadBrand, type BrandProfile } from "@/lib/brand";
import { writeBrand } from "@/lib/drive-admin";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const TEXT = ["name", "tagline", "email", "website"] as const;

/** Updates a white-label brand's details, logo and watermark defaults. */
export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { brand, fileId } = await loadBrand(true);
  const current = brand.profiles?.find((p) => p.id === id);
  if (!current) return Response.json({ ok: false, error: "Brand not found" }, { status: 404 });
  const next: BrandProfile = { ...current };
  for (const k of TEXT) if (k in body) (next as Record<string, unknown>)[k] = String(body[k] ?? "").trim().slice(0, 300) || undefined;
  if (!next.name) return Response.json({ ok: false, error: "The brand needs a name" }, { status: 400 });
  if (next.website && !/^https?:\/\//i.test(next.website)) next.website = `https://${next.website}`;
  if ("accent" in body) next.accent = /^#[0-9a-f]{6}$/i.test(String(body.accent)) ? String(body.accent) : undefined;
  if ("logoId" in body) next.logoId = body.logoId || undefined;
  if ("markDefault" in body) next.markDefault = body.markDefault ? String(body.markDefault) : undefined;
  if ("markOpacity" in body) next.markOpacity = clampOpacity(body.markOpacity);
  if ("markLayout" in body) next.markLayout = LAYOUTS.includes(body.markLayout) ? body.markLayout : undefined;
  const { token } = await ownerToken();
  await writeBrand(token, fileId, { ...brand, profiles: (brand.profiles ?? []).map((p) => (p.id === id ? next : p)) });
  clearBrandCache();
  return Response.json({ ok: true, profile: next });
});

/** Deletes a brand. Galleries that used it go back to your own studio brand. */
export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { brand, fileId } = await loadBrand(true);
  const { token } = await ownerToken();
  await writeBrand(token, fileId, { ...brand, profiles: (brand.profiles ?? []).filter((p) => p.id !== id) });
  clearBrandCache();
  return Response.json({ ok: true });
});
