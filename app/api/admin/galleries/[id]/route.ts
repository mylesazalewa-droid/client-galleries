import { friendlyDriveError, renameFolder, trash, writeSettings } from "@/lib/drive-admin";
import { clearCache, getRecordById, slugFor } from "@/lib/galleries";
import { adminRoute, ownerToken } from "@/lib/owner";
import type { GallerySettings } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Update title and settings (client, date, message, password, downloads, cover, draft). */
export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const g = await getRecordById(id, true);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const { token } = await ownerToken();
  const body = await req.json().catch(() => ({}));

  try {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : g.title;
    if (title && title !== g.title) await renameFolder(token, id, title);

    const keys: (keyof GallerySettings)[] = ["client", "date", "message", "password", "downloads", "cover", "hidden"];
    const next: GallerySettings = { ...g.settings };
    for (const k of keys) if (k in body) (next as Record<string, unknown>)[k] = body[k];
    await writeSettings(token, id, g.settingsFileId, next);

    clearCache();
    return Response.json({ ok: true, slug: slugFor(title || g.title, id) });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});

/** Moves the whole gallery folder to Drive's trash (restorable from Drive for 30 days). */
export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const g = await getRecordById(id, true);
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  const { token } = await ownerToken();
  try {
    await trash(token, id);
    clearCache();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: friendlyDriveError(e) }, { status: 400 });
  }
});
