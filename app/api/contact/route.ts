import { after } from "next/server";
import { findActivitySheet } from "@/lib/activity";
import { getStudio } from "@/lib/brand";
import { isDemo, ownerEmails } from "@/lib/config";
import { sheets } from "@/lib/google";
import { sendGmail, storedMailerToken } from "@/lib/mail";

const tries = new Map<string, number[]>();
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Quote requests from the website's Contact page: emailed to you and saved in the activity sheet. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.website) return Response.json({ ok: true }); // bots fill the hidden field

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= 5) return Response.json({ ok: false, error: "Too many messages. Please try again later or email directly." }, { status: 429 });
  tries.set(ip, [...recent, now]);

  const m = {
    name: clean(body.name, 80), email: clean(body.email, 120), org: clean(body.org, 120),
    type: clean(body.type, 60), date: clean(body.date, 80), budget: clean(body.budget, 40), message: clean(body.message, 4000),
  };
  if (!m.name || !m.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) {
    return Response.json({ ok: false, error: "Please add your name, a valid email and a few words about the project." }, { status: 400 });
  }
  if (isDemo) return Response.json({ ok: true });

  const studio = await getStudio();
  const lines: [string, string][] = [["Name", m.name], ["Email", m.email], ["Organization", m.org], ["Project", m.type], ["Date", m.date], ["Budget", m.budget]];
  const text = `${lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${m.message}`;
  const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#191816">
    <h2 style="font-weight:600;margin:0 0 12px">New quote request</h2>
    <table style="border-collapse:collapse">${lines.filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#6d6961;padding:3px 14px 3px 0">${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
    <p style="white-space:pre-wrap;margin-top:16px">${esc(m.message)}</p>
    <p style="color:#6d6961;font-size:13px">Reply to this email to answer ${esc(m.name)} directly.</p></div>`;

  // Save to the activity sheet so nothing is lost, even if email fails.
  after(async () => {
    try {
      const id = await findActivitySheet();
      if (!id) return;
      const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Detroit" });
      await sheets().spreadsheets.values.append({
        spreadsheetId: id, range: "A1", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[stamp, "Website", "Quote request", text.slice(0, 2000), `${m.name} <${m.email}>`, "", new Date().toISOString()]] },
      });
    } catch (e) { console.warn("inquiry log failed", e); }
  });

  const to = ownerEmails[0] || studio.email;
  const sender = await storedMailerToken().catch(() => null);
  if (sender && to) {
    try {
      await sendGmail(sender.token, { to: [to], subject: `Quote request: ${m.type || "New project"} — ${m.name}${m.org ? `, ${m.org}` : ""}`, text, html, from: { name: `${studio.name} website`, email: sender.email }, replyTo: m.email });
    } catch (e) { console.warn("inquiry email failed", e); }
  }
  return Response.json({ ok: true });
}
