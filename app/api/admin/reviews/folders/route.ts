import { createReviewFolder, friendlyDriveError } from "@/lib/drive-admin";
import { loadReviewTree } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** New Markup folder, e.g. one per client. */
export const POST = adminRoute(async (req: Request) => {
  const name = String((await req.json().catch(() => ({}))).name ?? "").replace(/^[_.]+/, "").trim().slice(0, 80);
  if (!name) return Response.json({ ok: false, error: "Name the folder." }, { status: 400 });
  const { token } = await ownerToken();
  try {
    const id = await createReviewFolder(token, name);
    await loadReviewTree(true);
    return Response.json({ ok: true, id, name });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});
