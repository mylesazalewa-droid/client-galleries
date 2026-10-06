import "server-only";
import { oauthClientId, oauthClientSecret } from "./config";
import { MAILER_FILE } from "./drive-admin";
import { formatDate } from "./format";
import { listChildren, resolveRoot, type GalleryRecord } from "./galleries";
import { driveMedia } from "./google";
import { seal, unseal } from "./owner";
import { payParts, usd } from "./payments";
import type { Studio } from "./types";

/**
 * Email goes out through the owner's own Gmail (gmail.send), so it comes from their address
 * and replies land in their inbox.
 */

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export class MailError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function splitEmails(list?: string) {
  return (list ?? "")
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}

export async function sendGmail(token: string, m: { to: string[]; subject: string; text: string; html: string; from?: { name: string; email: string } }) {
  const boundary = `b${Date.now().toString(36)}`;
  const headers = [
    `To: ${m.to.join(", ")}`,
    ...(m.from ? [`From: ${encodeHeader(m.from.name)} <${m.from.email}>`] : []),
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", b64(body)];
  const mime = [...headers, "", ...part("text/plain", m.text), ...part("text/html", m.html), `--${boundary}--`, ""].join("\r\n");
  const raw = Buffer.from(mime).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg: string = body?.error?.message ?? `Gmail error ${res.status}`;
    if (res.status === 403 && /insufficient|scope|permission/i.test(msg)) {
      throw new MailError(403, "Email isn't connected yet. Click “Connect Gmail” and allow sending email.");
    }
    if (/has not been used|is disabled/i.test(msg)) {
      throw new MailError(403, "The Gmail API is turned off in your Google Cloud project. Turn it on, then try again.");
    }
    throw new MailError(res.status, `Gmail: ${msg}`);
  }
}

// ---------------------------------------------------------------- the stored sender (for scheduled reminders)

type Mailer = { email: string; rt: string; savedAt: number };

export function sealMailer(email: string, rt: string) {
  return seal({ email, rt, savedAt: Date.now() } satisfies Mailer);
}

/** An access token for the owner's Gmail, from the sign-in saved at the last dashboard login. */
export async function storedMailerToken(): Promise<{ email: string; token: string } | null> {
  const root = await resolveRoot();
  if (!root) return null;
  const [file] = await listChildren(`'${root}' in parents and name='${MAILER_FILE}' and trashed=false`);
  if (!file?.id) return null;
  const res = await driveMedia(file.id);
  if (!res.ok) return null;
  const m = unseal<Mailer>((await res.text()).trim());
  if (!m?.rt) return null;
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: oauthClientId, client_secret: oauthClientSecret, refresh_token: m.rt, grant_type: "refresh_token" }),
  }).then((r) => r.json());
  if (!tok.access_token || !String(tok.scope ?? GMAIL_SCOPE).includes("gmail.send")) return null;
  return { email: m.email, token: tok.access_token };
}

// ---------------------------------------------------------------- templates

export type MailKind = "invite" | "payment" | "unpaid" | "closing";
export const LABELS: Record<MailKind, string> = { invite: "Invite", payment: "Payment request", unpaid: "Payment reminder", closing: "Closing reminder" };
export type Draft = { subject: string; body: string; button?: { label: string; url: string } };

const first = (name?: string) => (name ? `Hi ${name.split(/\s+/)[0]},` : "Hi there,");

/** Default wording for each kind of email (the owner can edit subject and message before sending). */
export function draftFor(kind: MailKind, g: GalleryRecord, studio: Studio, origin: string, payUrl?: string): Draft {
  const link = `${origin}/g/${g.slug}`;
  const s = g.settings;
  const pw = s.password ? `\n\nPassword: ${s.password}` : "";
  const until = s.expires ? `\n\nThe gallery is available until ${formatDate(s.expires)}, so download anything you need before then.` : "";
  const parts = payParts(s);
  const paid = new Set(g.paidLinks ?? []);
  const next = parts.find((p) => !paid.has(p.id));
  const due = next ? usd(next.amount) : s.payAmount ? usd(s.payAmount) : "";
  const split = parts.length > 1;
  const sign = `\n\nThanks,\n${studio.name}`;
  const greet = first(undefined);

  switch (kind) {
    case "invite":
      return {
        subject: `${g.title} is ready`,
        body: `${greet}\n\nYour ${s.hold ? "previews" : "files"} for ${g.title} are ready to view${s.hold ? "" : " and download"}.${pw}${until}${sign}`,
        button: { label: "Open your gallery", url: link },
      };
    case "payment":
      return {
        subject: split && next && paid.size ? `Final payment for ${g.title}` : `Invoice for ${g.title}`,
        body: `${greet}\n\n${
          split ? (paid.size ? `Thanks for the deposit! The final payment of ${due}` : `The deposit of ${due}`) : `The payment of ${due}`
        } for ${g.title} can be made online with the button below. ${split && !paid.size ? "Your files unlock once the deposit and final payment are in." : "Your full-resolution files unlock as soon as it goes through."}\n\nYou can preview everything in the gallery in the meantime.${pw}${sign}`,
        button: payUrl ? { label: due ? `Pay ${due}` : "Pay invoice", url: payUrl } : { label: "Open your gallery", url: link },
      };
    case "unpaid":
      return {
        subject: `Reminder: payment for ${g.title}`,
        body: `${greet}\n\nJust a friendly reminder that ${due ? `${due} is` : "a payment is"} still open for ${g.title}. Your full-resolution files unlock as soon as it's paid.${sign}`,
        button: payUrl ? { label: due ? `Pay ${due}` : "Pay invoice", url: payUrl } : { label: "Open your gallery", url: link },
      };
    case "closing":
      return {
        subject: `${g.title} closes ${s.expires ? formatDate(s.expires) : "soon"}`,
        body: `${greet}\n\nA quick heads-up: the gallery for ${g.title} closes after ${s.expires ? formatDate(s.expires) : "a few days"}. Make sure you've downloaded everything you need.${pw}${sign}`,
        button: { label: "Open your gallery", url: link },
      };
  }
}

/** Branded HTML around a plain-text message. */
export function render(d: Draft, studio: Studio, origin: string) {
  const accent = studio.accent ?? "#c98a4b";
  const logo = studio.logo ? `${origin}${studio.logo}` : "";
  const paras = d.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = d.button
    ? `<p style="margin:26px 0 8px"><a href="${esc(d.button.url)}" style="display:inline-block;background:${accent};color:#111;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:999px">${esc(d.button.label)}</a></p>
       <p style="margin:0 0 16px;font-size:12px;color:#8a867f">Or copy this link: <a href="${esc(d.button.url)}" style="color:#8a867f">${esc(d.button.url)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1eb;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b1a18">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:560px;background:#0d0d0e;border-radius:18px;overflow:hidden" cellspacing="0" cellpadding="0">
    <tr><td style="padding:26px 30px 0">${logo ? `<img src="${logo}" alt="${esc(studio.name)}" height="34" style="height:34px;width:auto;display:block">` : `<div style="color:#f4f1ec;font-family:Georgia,serif;font-size:22px">${esc(studio.name)}</div>`}</td></tr>
    <tr><td style="padding:22px 30px 30px;color:#e9e5de;font-size:15.5px">${paras}${button}</td></tr>
  </table>
  <p style="font-size:12px;color:#8a867f;margin:14px 0 0">${esc(studio.name)}${studio.email ? ` · ${esc(studio.email)}` : ""}</p>
  </td></tr></table></body></html>`;
  const text = `${d.body}${d.button ? `\n\n${d.button.label}: ${d.button.url}` : ""}`;
  return { html, text };
}
