import { ensureActivitySheet, ensureRoot } from "@/lib/drive-admin";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Makes sure the CLIENTS folder and the activity sheet exist. Safe to call repeatedly. */
export const POST = adminRoute(async () => {
  const { token } = await ownerToken();
  await ensureRoot(token);
  const sheetId = await ensureActivitySheet(token);
  return Response.json({ ok: true, sheetId });
});
