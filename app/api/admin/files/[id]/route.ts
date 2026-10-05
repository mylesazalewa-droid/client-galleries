import { friendlyDriveError, trash } from "@/lib/drive-admin";
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
