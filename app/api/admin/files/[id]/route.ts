import { friendlyDriveError, renameFolder as renameItem, trash, writeSettings } from "@/lib/drive-admin";
import { clearCache, getRecordById } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";

export const runtime = "nodejs";

/** Removes one photo or video (to Drive's trash). The file must belong to the given gallery. */
export const DELETE = adminRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const g = await getRecordById(new URL(req.url).searchParams.get("g") ?? "", true);
  const item = g?.items.find((i) => i.id === id) ?? (g?.cover?.id === id ? g.cover : undefined);
  if (!g || !item) return Response.json({ ok: false, error: "File not found" }, { status: 404 });

  const { token } = await ownerToken();
  try {
    await trash(token, id);
    clearCache();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});

/** Renames one photo or video. Keeps the original file extension if the new name leaves it off. */
export const PATCH = adminRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const g = await getRecordById(new URL(req.url).searchParams.get("g") ?? "", true);
  const item = g?.items.find((i) => i.id === id) ?? (g?.cover?.id === id ? g.cover : undefined);
  if (!g || !item) return Response.json({ ok: false, error: "File not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let name = String(body.name ?? "").replace(/[\\/]/g, "_").trim().slice(0, 200);
  if (!name) return Response.json({ ok: false, error: "Give it a name." }, { status: 400 });
  const ext = item.name.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? "";
  if (ext && !name.toLowerCase().endsWith(ext.toLowerCase())) name += ext;
  if (name === item.name) return Response.json({ ok: true, name });

  const { token } = await ownerToken();
  try {
    await renameItem(token, id, name);
    // The cover is remembered by file name, so follow the rename.
    if (g.settings.cover && g.settings.cover.toLowerCase() === item.name.toLowerCase()) {
      await writeSettings(token, g.id, g.settingsFileId, { ...g.settings, cover: name });
    }
    clearCache();
    return Response.json({ ok: true, name });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});
