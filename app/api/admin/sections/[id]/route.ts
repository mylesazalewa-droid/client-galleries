import { friendlyDriveError, renameFolder, trash } from "@/lib/drive-admin";
import { clearCache, getRecordById } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function find(req: Request, id: string) {
  const g = await getRecordById(new URL(req.url).searchParams.get("g") ?? "", true);
  return g && g.sections.some((s) => s.id === id) ? g : null;
}

export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!(await find(req, id))) return Response.json({ ok: false, error: "Section not found" }, { status: 404 });
  const name = String((await req.json().catch(() => ({}))).name ?? "").replace(/^[_.]+/, "").trim().slice(0, 80);
  if (!name) return Response.json({ ok: false, error: "Name the section." }, { status: 400 });
  const { token } = await ownerToken();
  try {
    await renameFolder(token, id, name);
    clearCache();
    return Response.json({ ok: true, name });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});

/** Moves the section folder (and what's in it) to Drive's trash. */
export const DELETE = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!(await find(req, id))) return Response.json({ ok: false, error: "Section not found" }, { status: 404 });
  const { token } = await ownerToken();
  try {
    await trash(token, id);
    clearCache();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});
