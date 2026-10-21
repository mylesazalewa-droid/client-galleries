import "server-only";
import { randomBytes } from "crypto";
import { findActivitySheet } from "./activity";
import { isDemo } from "./config";
import { sheets } from "./google";

/**
 * Review notes live in a "Feedback" tab of the Client Galleries — Activity sheet.
 * Every change is a new row (comment, reply, resolve, approve…), so nothing is ever overwritten.
 */
const TAB = "Feedback";
const HEAD = ["Timestamp (UTC)", "Gallery ID", "File ID", "Event", "Note ID", "Parent ID", "Time (s)", "X %", "Y %", "Author", "Text", "By owner"];

export type ReviewEvent = "comment" | "reply" | "resolve" | "reopen" | "approve" | "unapprove" | "delete";
export type Row = { at: string; galleryId: string; fileId: string; event: ReviewEvent; id: string; parentId: string; t?: number; x?: number; y?: number; author: string; text: string; owner: boolean };

export type Reply = { id: string; author: string; text: string; at: string; owner: boolean };
export type Note = Reply & { fileId: string; t?: number; x?: number; y?: number; resolved: boolean; replies: Reply[] };
export type Approval = { fileId: string; author: string; at: string };
export type Feedback = { notes: Note[]; approvals: Approval[] };

const demoAt = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const demoRows: Row[] = [
  { at: demoAt(26), galleryId: "demo-3", fileId: "Rough cut v2.mp4", event: "comment", id: "dm1", parentId: "", t: 1.2, author: "Priya (Harbor Health)", text: "Can the logo hold a beat longer here?", owner: false },
  { at: demoAt(25), galleryId: "demo-3", fileId: "Rough cut v2.mp4", event: "reply", id: "dm2", parentId: "dm1", author: "Sow Creative Studios", text: "Yes — I'll extend it by about a second.", owner: true },
  { at: demoAt(24), galleryId: "demo-3", fileId: "Rough cut v2.mp4", event: "comment", id: "dm3", parentId: "", t: 3.4, author: "Priya (Harbor Health)", text: "Music feels a little loud under the interview.", owner: false },
  { at: demoAt(23), galleryId: "demo-3", fileId: "Rough cut v2.mp4", event: "resolve", id: "dm4", parentId: "dm3", author: "Sow Creative Studios", text: "", owner: true },
  { at: demoAt(20), galleryId: "demo-3", fileId: "photo-02.svg", event: "comment", id: "dm5", parentId: "", x: 62, y: 38, author: "Priya (Harbor Health)", text: "Brighten her face a touch.", owner: false },
  { at: demoAt(19), galleryId: "demo-3", fileId: "photo-04.svg", event: "approve", id: "dm6", parentId: "", author: "Priya (Harbor Health)", text: "", owner: false },
];
let tabReady: string | null = null;
const cache = new Map<string, { at: number; rows: Row[] }>();

async function ensureTab(spreadsheetId: string) {
  if (tabReady === spreadsheetId) return;
  const meta = await sheets().spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  if (!meta.data.sheets?.some((s) => s.properties?.title === TAB)) {
    await sheets().spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } });
    await sheets().spreadsheets.values.update({ spreadsheetId, range: `${TAB}!A1:L1`, valueInputOption: "RAW", requestBody: { values: [HEAD] } });
  }
  tabReady = spreadsheetId;
}

async function allRows(): Promise<Row[]> {
  if (isDemo) return demoRows;
  const id = await findActivitySheet();
  if (!id) return [];
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 4000) return hit.rows;
  await ensureTab(id);
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: id, range: `${TAB}!A2:L` });
  const num = (v?: string) => (v === undefined || v === "" ? undefined : Number(v));
  const rows = ((res.data.values ?? []) as string[][]).map((r) => ({
    at: r[0] ?? "", galleryId: r[1] ?? "", fileId: r[2] ?? "", event: (r[3] ?? "") as ReviewEvent, id: r[4] ?? "", parentId: r[5] ?? "",
    t: num(r[6]), x: num(r[7]), y: num(r[8]), author: r[9] ?? "", text: r[10] ?? "", owner: r[11] === "yes",
  }));
  cache.set(id, { at: Date.now(), rows });
  return rows;
}

export async function addRow(r: Omit<Row, "at" | "id"> & { id?: string }) {
  const row: Row = { ...r, id: r.id || randomBytes(5).toString("hex"), at: new Date().toISOString() };
  if (isDemo) {
    demoRows.push(row);
    return row;
  }
  const id = await findActivitySheet();
  if (!id) throw new Error("The activity sheet isn't set up yet. Open the dashboard once, then try again.");
  await ensureTab(id);
  await sheets().spreadsheets.values.append({
    spreadsheetId: id,
    range: `${TAB}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[row.at, row.galleryId, row.fileId, row.event, row.id, row.parentId, row.t ?? "", row.x ?? "", row.y ?? "", row.author, row.text, row.owner ? "yes" : ""]] },
  });
  cache.delete(id);
  return row;
}

/** Folds the event rows into the current notes, replies and approvals for one gallery. */
export async function feedbackFor(galleryId: string): Promise<Feedback> {
  const rows = (await allRows()).filter((r) => r.galleryId === galleryId);
  const notes = new Map<string, Note>();
  const approvals = new Map<string, Approval>();
  const deleted = new Set<string>();
  for (const r of rows) {
    if (r.event === "comment") notes.set(r.id, { id: r.id, fileId: r.fileId, t: r.t, x: r.x, y: r.y, author: r.author, text: r.text, at: r.at, owner: r.owner, resolved: false, replies: [] });
    else if (r.event === "reply") notes.get(r.parentId)?.replies.push({ id: r.id, author: r.author, text: r.text, at: r.at, owner: r.owner });
    else if (r.event === "resolve" || r.event === "reopen") { const n = notes.get(r.parentId); if (n) n.resolved = r.event === "resolve"; }
    else if (r.event === "delete") deleted.add(r.parentId);
    else if (r.event === "approve") approvals.set(r.fileId, { fileId: r.fileId, author: r.author, at: r.at });
    else if (r.event === "unapprove") approvals.delete(r.fileId);
  }
  for (const n of notes.values()) n.replies = n.replies.filter((x) => !deleted.has(x.id));
  return {
    notes: [...notes.values()].filter((n) => !deleted.has(n.id)),
    approvals: [...approvals.values()],
  };
}

/** Open (unresolved) notes and approvals per gallery, for the dashboard. */
export async function feedbackSummary() {
  const out = new Map<string, { open: number; total: number; approved: number }>();
  const ids = new Set((await allRows()).map((r) => r.galleryId));
  for (const id of ids) {
    const f = await feedbackFor(id);
    out.set(id, { open: f.notes.filter((n) => !n.resolved).length, total: f.notes.length, approved: f.approvals.length });
  }
  return out;
}
