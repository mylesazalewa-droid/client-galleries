import { ensureReviewsBox, friendlyDriveError, moveFile } from "@/lib/drive-admin";
import { clearCache, loadReviewTree } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Moves a review project into a folder, or back out to the top level (folderId ""). */
export const POST = adminRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const folderId = String((await req.json().catch(() => ({}))).folderId ?? "");
  const tree = await loadReviewTree(true);
  const project = tree.projects.find((p) => p.id === id);
  if (!project) return Response.json({ ok: false, error: "Project not found" }, { status: 404 });
  if (folderId && !tree.folders.some((f) => f.id === folderId)) return Response.json({ ok: false, error: "Folder not found" }, { status: 404 });
  const { token } = await ownerToken();
  try {
    const box = tree.box ?? (await ensureReviewsBox(token));
    const from = project.group?.id ?? box;
    const to = folderId || box;
    if (from !== to) await moveFile(token, id, from, to);
    clearCache();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});
