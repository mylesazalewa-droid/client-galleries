import "server-only";
import { createHash } from "crypto";
import { after } from "next/server";
import { isDemo } from "./config";
import { listChildren, resolveRoot } from "./galleries";
import { sheets } from "./google";
import { readSession } from "./owner";

/**
 * Activity log: a Google Sheet inside CLIENTS that the service account appends to.
 * Turn on Sheets' own email notifications (Tools → Notification settings) to get pinged.
 */
export const ACTIVITY_NAME = "Client Galleries — Activity";
export const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
export const HEADERS = ["Time", "Gallery", "Event", "Detail", "Visitor", "Gallery ID", "Timestamp (UTC)"];
const TZ = process.env.STUDIO_TIMEZONE || "America/Detroit";

let sheetCache: { at: number; id: string | null } | null = null;

export async function findActivitySheet(force = false): Promise<string | null> {
  if (isDemo) return null;
  if (!force && sheetCache?.id && Date.now() - sheetCache.at < 10 * 60_000) return sheetCache.id;
  const root = await resolveRoot();
  if (!root) return null;
  const name = ACTIVITY_NAME.replace(/'/g, "\\'");
  const found = await listChildren(`'${root}' in parents and name='${name}' and mimeType='${SHEET_MIME}' and trashed=false`);
  const id = found[0]?.id ?? null;
  sheetCache = { at: Date.now(), id };
  return id;
}

export function rememberActivitySheet(id: string) {
  sheetCache = { at: Date.now(), id };
}

function stamp(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

function visitor(req: Request) {
  const h = req.headers;
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim();
  const id = createHash("sha256").update(`${ip}|${h.get("user-agent") || ""}`).digest("hex").slice(0, 6);
  const city = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");
  const place = city ? `${decodeURIComponent(city)}${region ? `, ${region}` : ""}` : "";
  return [place, `#${id}`].filter(Boolean).join(" · ");
}

export type LogInput = { galleryId: string; title: string; event: string; detail?: string };

/** Records an event after the response is sent. Skips the owner's own visits. */
export async function logEvent(req: Request, e: LogInput, opts: { includeOwner?: boolean } = {}) {
  if (isDemo) return;
  if (!opts.includeOwner && (await readSession())) return;
  const row = [stamp(), e.title, e.event, e.detail ?? "", visitor(req), e.galleryId, new Date().toISOString()];
  after(async () => {
    try {
      const id = await findActivitySheet();
      if (!id) return;
      await sheets().spreadsheets.values.append({
        spreadsheetId: id,
        range: "A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    } catch (err) {
      console.warn("activity log failed", err);
    }
  });
}

export type ActivityRow = { time: string; gallery: string; event: string; detail: string; visitor: string; galleryId: string; at: string };

/** Last N rows (newest first). */
export async function readActivity(limit = 2000): Promise<ActivityRow[]> {
  const id = await findActivitySheet();
  if (!id) return [];
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: id, range: "A2:G" });
  const rows = (res.data.values ?? []) as string[][];
  return rows
    .slice(-limit)
    .reverse()
    .map((r) => ({ time: r[0] ?? "", gallery: r[1] ?? "", event: r[2] ?? "", detail: r[3] ?? "", visitor: r[4] ?? "", galleryId: r[5] ?? "", at: r[6] ?? "" }));
}

export type Stats = { views: number; downloads: number; lastOpened?: string };

export function summarize(rows: ActivityRow[]) {
  const out = new Map<string, Stats>();
  for (const r of rows) {
    const s = out.get(r.galleryId) ?? { views: 0, downloads: 0 };
    if (r.event === "Opened") {
      s.views++;
      if (!s.lastOpened || r.at > s.lastOpened) s.lastOpened = r.at;
    }
    if (r.event.startsWith("Downloaded")) s.downloads++;
    out.set(r.galleryId, s);
  }
  return out;
}
