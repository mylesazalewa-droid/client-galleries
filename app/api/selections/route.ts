import { canView } from "@/lib/access";
import { isDemo, studio } from "@/lib/config";
import { getRecord } from "@/lib/galleries";
import { sheets } from "@/lib/google";

export const runtime = "nodejs";

type Pick = { id: string; note?: string };

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const g = body?.slug ? await getRecord(String(body.slug)) : null;
  if (!g) return Response.json({ ok: false, error: "Gallery not found" }, { status: 404 });
  if (!(await canView(g))) return Response.json({ ok: false, error: "Locked" }, { status: 401 });

  const name = clip(body.name, 120);
  const email = clip(body.email, 200);
  const message = clip(body.message, 2000);
  const picks: Pick[] = Array.isArray(body.picks) ? body.picks.slice(0, 2000) : [];
  if (!name) return Response.json({ ok: false, error: "Please add your name." }, { status: 400 });

  // Only accept files that are actually in this gallery.
  const byId = new Map(g.items.map((i) => [i.id, i]));
  const chosen = picks
    .map((p) => ({ item: byId.get(String(p.id)), note: clip(p.note, 1000) }))
    .filter((p): p is { item: NonNullable<typeof p.item>; note: string } => !!p.item);
  if (!chosen.length && !message) {
    return Response.json({ ok: false, error: "Nothing selected yet." }, { status: 400 });
  }

  if (isDemo) {
    console.log(`[demo] ${name} sent ${chosen.length} picks from "${g.title}"`);
    return Response.json({ ok: true, demo: true, count: chosen.length });
  }

  const now = new Date().toISOString();
  const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;
  const rows = chosen.length
    ? chosen.map(({ item, note }, i) => [now, g.title, name, email, item.name, note, link(item.id), i === 0 ? message : ""])
    : [[now, g.title, name, email, "", "", "", message]];

  const sheetId = process.env.SELECTIONS_SHEET_ID;
  if (sheetId) {
    await sheets().spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
  } else {
    console.warn("SELECTIONS_SHEET_ID not set; selections were not saved", rows);
  }

  // Optional email ping via Resend (resend.com). Skipped when not configured.
  const notify = process.env.NOTIFY_EMAIL;
  if (process.env.RESEND_API_KEY && notify) {
    const list = chosen.map(({ item, note }) => `• ${item.name}${note ? ` — "${note}"` : ""}`).join("\n");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || `${studio.name} Galleries <onboarding@resend.dev>`,
        to: notify,
        reply_to: email || undefined,
        subject: `${name} picked ${chosen.length} from ${g.title}`,
        text: `${name}${email ? ` (${email})` : ""} sent selections from "${g.title}".\n\n${message ? `Message: ${message}\n\n` : ""}${list}`,
      }),
    }).catch((e) => console.warn("notify failed", e));
  }

  return Response.json({ ok: true, count: chosen.length });
}
