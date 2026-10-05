import { canAccessFile, viewerState } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { findItem } from "@/lib/galleries";
import { driveMedia } from "@/lib/google";

export const runtime = "nodejs";

/** Serves a caption file as WebVTT (browsers can't play .srt directly). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await findItem(new URL(req.url).searchParams.get("g") ?? "", id);
  if (!found || found.item.kind !== "caption") return new Response("Not found", { status: 404 });
  if (!(await canAccessFile(found.gallery, id, req))) return new Response("Locked", { status: 401 });
  if ((await viewerState(found.gallery)).expired) return new Response("This gallery has closed", { status: 410 });
  if (isDemo) return Response.redirect(new URL("/demo/captions.vtt", req.url));

  const res = await driveMedia(id);
  if (!res.ok) return new Response("Captions unavailable", { status: res.status });
  let text = (await res.text()).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!text.trimStart().startsWith("WEBVTT")) {
    // SRT → VTT: drop cue numbers, swap the millisecond comma for a dot.
    text = "WEBVTT\n\n" + text.replace(/^\d+\n(?=\d{2}:\d{2})/gm, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  }
  return new Response(text, { headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=3600" } });
}
