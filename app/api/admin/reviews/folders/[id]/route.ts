import { friendlyDriveError, renameFolder, trash } from "@/lib/drive-admin";
import { clearCache, loadReviewTree } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function find(id: string) {
  const tree = await loadReviewTree(true);
  const folder = tree.folders.find((f) => f.id === id);
  return folder ? { folder, projects: tree.projects.filter((p) => p.group?.id === id) } : null;
}

export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!(await find(id))) return Response.json({ ok: false, error: "Folder not found" }, { status: 404 });
  const name = String((await req.json().catch(() => ({}))).name ?? "").replace(/^[_.]+/, "").trim().slice(0, 80);
  if (!name) return Response.json({ ok: false, error: "Name the folder." }, { status: 400 });
  const { token } = await ownerToken();
  try {
    await renameFolder(token, id, name);
    clearCache();
    return Response.json({ ok: true, name });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});

/** Deletes an empty folder (move or delete its projects first). */
export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const found = await find(id);
  if (!found) return Response.json({ ok: false, error: "Folder not found" }, { status: 404 });
  if (found.projects.length) return Response.json({ ok: false, error: "Move or delete the projects in this folder first." }, { status: 400 });
  const { token } = await ownerToken();
  try {
    await trash(token, id);
    clearCache();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});
