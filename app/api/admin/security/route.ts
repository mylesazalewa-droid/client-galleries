import { clearBrandCache, loadBrand } from "@/lib/brand";
import { writeBrand } from "@/lib/drive-admin";
import { adminRoute, ownerToken, readSession, writeSession } from "@/lib/owner";

export const runtime = "nodejs";

/** "Sign out everywhere": ends every dashboard session on every device, then signs this one back in. */
export const POST = adminRoute(async () => {
  const { token } = await ownerToken();
  const { brand, fileId } = await loadBrand(true);
  const now = Date.now();
  await writeBrand(token, fileId, { ...brand, signoutBefore: now });
  clearBrandCache();
  const s = await readSession().catch(() => null);
  if (s) await writeSession({ ...s, iat: now + 1 });
  return Response.json({ ok: true });
});
