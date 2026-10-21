import { randomBytes } from "crypto";
import { clearBrandCache, loadBrand, type BrandProfile } from "@/lib/brand";
import { writeBrand } from "@/lib/drive-admin";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Creates a white-label brand. */
export const POST = adminRoute(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return Response.json({ ok: false, error: "Give the brand a name" }, { status: 400 });
  const { brand, fileId } = await loadBrand(true);
  const profile: BrandProfile = { id: randomBytes(5).toString("hex"), name };
  const { token } = await ownerToken();
  await writeBrand(token, fileId, { ...brand, profiles: [...(brand.profiles ?? []), profile] });
  clearBrandCache();
  return Response.json({ ok: true, profile });
});
