import { canView } from "@/lib/access";
import { logEvent } from "@/lib/activity";
import { brandFor } from "@/lib/brand";
import { allFiles, getReview, isExpired, loadReviews } from "@/lib/galleries";
import { readSession } from "@/lib/owner";
import { addRow, feedbackFor, type ReviewEvent } from "@/lib/review";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const owner = !!(await readSession());
  const g = (await getReview(slug)) ?? (owner ? (await loadReviews()).find((r) => r.slug === slug) ?? null : null);
  return { g, owner };
}

/** Notes, replies and approvals for a review gallery. */
export async function GET(_req: Request, ctx: Ctx) {
  const { g, owner } = await load((await ctx.params).slug);
  if (!g || (!owner && (isExpired(g.settings) || !(await canView(g))))) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true, ...(await feedbackFor(g.id)) }, { headers: { "Cache-Control": "no-store" } });
}

const CLIENT_ACTIONS: ReviewEvent[] = ["comment", "reply", "resolve", "reopen", "approve", "unapprove"];

/** Adds a note, reply, resolve/reopen, approval — or (owner only) deletes a note. */
export async function POST(req: Request, ctx: Ctx) {
  const { g, owner } = await load((await ctx.params).slug);
  if (!g || (!owner && (isExpired(g.settings) || !(await canView(g))))) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "") as ReviewEvent;
  if (!(owner ? [...CLIENT_ACTIONS, "delete"] : CLIENT_ACTIONS).includes(action)) return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });

  const fileId = String(body.fileId ?? "");
  if (!allFiles(g).some((f) => f.id === fileId) && g.cover?.id !== fileId) return Response.json({ ok: false, error: "That file isn't in this project" }, { status: 400 });

  const { studio } = await brandFor(g.settings);
  const author = owner ? studio.name : String(body.author ?? "").trim().slice(0, 60);
  const text = String(body.text ?? "").trim().slice(0, 2000);
  if (!author) return Response.json({ ok: false, error: "Add your name first" }, { status: 400 });
  if ((action === "comment" || action === "reply") && !text) return Response.json({ ok: false, error: "Write a note first" }, { status: 400 });
  const pct = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Math.min(100, Math.max(0, Math.round(Number(v) * 10) / 10)));
  const t = body.t === undefined || body.t === null || body.t === "" ? undefined : Math.max(0, Math.round(Number(body.t) * 10) / 10);

  try {
    const row = await addRow({
      galleryId: g.id,
      fileId,
      event: action,
      parentId: String(body.parentId ?? ""),
      t: action === "comment" && Number.isFinite(t) ? t : undefined,
      x: action === "comment" ? pct(body.x) : undefined,
      y: action === "comment" ? pct(body.y) : undefined,
      author,
      text: action === "comment" || action === "reply" ? text : "",
      owner,
    });
    if (!owner && (action === "comment" || action === "approve")) {
      const file = allFiles(g).find((f) => f.id === fileId);
      await logEvent(req, {
        galleryId: g.id,
        title: g.title,
        event: action === "approve" ? "Approved" : "Left feedback",
        detail: `${author} · ${file?.title ?? file?.name ?? ""}${action === "comment" ? ` · ${text.slice(0, 160)}` : ""}`,
      });
    }
    return Response.json({ ok: true, id: row.id, feedback: await feedbackFor(g.id) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Couldn't save" }, { status: 500 });
  }
}
