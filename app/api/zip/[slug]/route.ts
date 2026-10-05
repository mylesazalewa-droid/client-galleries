import archiver from "archiver";
import { Readable } from "stream";
import { canView } from "@/lib/access";
import { isDemo } from "@/lib/config";
import { getRecord } from "@/lib/galleries";
import { driveMedia } from "@/lib/google";
import { disposition } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Zips the whole gallery on the fly. ?only=photos|videos narrows it. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = await getRecord(slug);
  if (!g) return new Response("Not found", { status: 404 });
  if (!(await canView(g))) return new Response("Locked", { status: 401 });
  if (g.settings.downloads === false) return new Response("Downloads are off", { status: 403 });

  const only = new URL(req.url).searchParams.get("only");
  const items = g.items.filter((i) => !only || (only === "photos" ? i.kind === "photo" : i.kind === "video"));

  // Media is already compressed, so store without re-compressing (much faster).
  const archive = archiver("zip", { store: true });
  archive.on("warning", (e) => console.warn("zip warning", e));

  (async () => {
    try {
      const used = new Set<string>();
      for (const item of items) {
        if (req.signal.aborted) break;
        let name = item.name;
        for (let n = 2; used.has(name); n++) name = item.name.replace(/(\.[^.]*)?$/, ` (${n})$1`);
        used.add(name);

        let source: Readable;
        if (isDemo) {
          const res = await fetch(new URL(item.download, req.url), { signal: req.signal });
          if (!res.ok || !res.body) continue;
          source = Readable.fromWeb(res.body as never);
        } else {
          const res = await driveMedia(item.id, { signal: req.signal });
          if (!res.ok || !res.body) continue;
          source = Readable.fromWeb(res.body as never);
        }
        // Wait for each file to finish before opening the next Drive connection.
        await new Promise<void>((resolve, reject) => {
          archive.once("entry", () => resolve());
          source.once("error", reject);
          archive.append(source, { name });
        });
      }
      await archive.finalize();
    } catch (e) {
      console.error("zip failed", e);
      archive.abort();
    }
  })();

  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disposition(`${g.title}${only ? ` (${only})` : ""}.zip`),
      "Cache-Control": "private, no-store",
    },
  });
}
