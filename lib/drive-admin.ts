import "server-only";
import { ACTIVITY_NAME, findActivitySheet, HEADERS, rememberActivitySheet, SHEET_MIME } from "./activity";
import { BRAND_FILE } from "./brand";
import { rootFolderName } from "./config";
import { BRAND_FOLDER, clearCache, resolveRoot, SETTINGS_FILE } from "./galleries";
import { sheets } from "./google";
import type { GallerySettings } from "./types";

/**
 * Writes to Google Drive as the signed-in owner (drive.file scope), so files use the owner's own
 * storage. The service account only ever reads.
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";

class DriveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T = Record<string, unknown>>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new DriveError(res.status, body?.error?.message || `Google Drive error ${res.status}`);
  }
  return res.status === 204 ? ({} as T) : res.json();
}

function serviceAccountEmail() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json).client_email as string;
}

/** Searches as the owner: with drive.file this sees exactly the files and folders this app created, with no indexing delay. */
async function ownerFind(token: string, q: string) {
  const res = await call<{ files?: { id: string }[] }>(token, `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=5`);
  return res.files?.[0]?.id ?? null;
}

/** Finds the CLIENTS folder, or creates it in the owner's Drive and shares it (read-only) with the service account. */
export async function ensureRoot(token: string) {
  const existing = (await resolveRoot(true)) ?? (await ownerFind(token, `name='${rootFolderName.replace(/'/g, "\\'")}' and mimeType='${FOLDER}' and trashed=false`));
  if (existing) return existing;
  const folder = await call<{ id: string }>(token, `${API}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: rootFolderName, mimeType: FOLDER }),
  });
  await call(token, `${API}/files/${folder.id}/permissions?sendNotificationEmail=false`, {
    method: "POST",
    body: JSON.stringify({ role: "reader", type: "user", emailAddress: serviceAccountEmail() }),
  });
  clearCache();
  return folder.id;
}

function multipart(meta: object, content: string, type = "application/json") {
  const boundary = `gallery${Date.now().toString(36)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n${content}\r\n--${boundary}--`;
  return { body, headers: { "Content-Type": `multipart/related; boundary=${boundary}` } };
}

function cleanSettings(s: GallerySettings): GallerySettings {
  const out: GallerySettings = {};
  if (s.client?.trim()) out.client = s.client.trim();
  if (s.date?.trim()) out.date = s.date.trim();
  if (s.message?.trim()) out.message = s.message.trim();
  if (s.password?.trim()) out.password = s.password.trim();
  if (s.cover?.trim()) out.cover = s.cover.trim();
  if (s.downloads === false) out.downloads = false;
  if (s.hidden) out.hidden = true;
  if (s.expires?.trim()) out.expires = s.expires.trim();
  if (s.hold) out.hold = true;
  if (s.picks) out.picks = true;
  if (s.share === false) out.share = false;
  if (s.license?.trim()) out.license = s.license.trim();
  if (s.payUrl?.trim()) out.payUrl = s.payUrl.trim();
  if (s.payLinkId) out.payLinkId = s.payLinkId;
  if (s.payAmount && s.payAmount > 0) out.payAmount = Math.round(s.payAmount);
  if (s.payLabel?.trim()) out.payLabel = s.payLabel.trim();
  if (s.payParts?.length) out.payParts = s.payParts;
  if (s.payParts?.length && s.payRequestedAt) out.payRequestedAt = s.payRequestedAt;
  if (s.clientEmail?.trim()) out.clientEmail = s.clientEmail.trim();
  if (s.remindUnpaid) out.remindUnpaid = true;
  if (s.remindClosing) out.remindClosing = true;
  return out;
}

export async function writeSettings(token: string, folderId: string, fileId: string | undefined, settings: GallerySettings) {
  const content = JSON.stringify(cleanSettings(settings), null, 2);
  if (fileId) {
    try {
      const { body, headers } = multipart({}, content);
      await call(token, `${UPLOAD}/files/${fileId}?uploadType=multipart`, { method: "PATCH", body, headers });
      return fileId;
    } catch (e) {
      // gallery.json was added by hand in Drive, which this app can't edit. Replace it.
      if (!(e instanceof DriveError) || (e.status !== 403 && e.status !== 404)) throw e;
    }
  }
  const { body, headers } = multipart({ name: SETTINGS_FILE, parents: [folderId], mimeType: "application/json" }, content);
  const created = await call<{ id: string }>(token, `${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", body, headers });
  return created.id;
}

export async function createGallery(token: string, title: string, settings: GallerySettings) {
  const root = await ensureRoot(token);
  const folder = await call<{ id: string }>(token, `${API}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: title.trim(), mimeType: FOLDER, parents: [root] }),
  });
  await writeSettings(token, folder.id, undefined, settings);
  clearCache();
  return folder.id;
}

/** Renames a folder or file. */
export async function renameFolder(token: string, id: string, title: string) {
  await call(token, `${API}/files/${id}`, { method: "PATCH", body: JSON.stringify({ name: title.trim() }) });
}

/** Moves to Drive's trash (recoverable for 30 days), never a permanent delete. */
export async function trash(token: string, id: string) {
  await call(token, `${API}/files/${id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
}

/**
 * Starts a resumable upload in the owner's Drive. The browser then sends the file straight to Google,
 * so large videos never pass through this server.
 */
export async function startUpload(token: string, folderId: string, file: { name: string; type: string; size: number }, origin: string) {
  const res = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type || "application/octet-stream",
      "X-Upload-Content-Length": String(file.size),
      Origin: origin,
    },
    body: JSON.stringify({ name: file.name, parents: [folderId] }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new DriveError(res.status, body?.error?.message || `Couldn't start upload (${res.status})`);
  }
  const location = res.headers.get("location");
  if (!location) throw new Error("Google didn't return an upload link");
  return location;
}

export function friendlyDriveError(e: unknown) {
  if (e instanceof DriveError && (e.status === 403 || e.status === 404)) {
    return "This was added directly in Google Drive, so it has to be changed there.";
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

// ---------------------------------------------------------------- sections

export async function createFolder(token: string, parent: string, name: string) {
  const folder = await call<{ id: string }>(token, `${API}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), mimeType: FOLDER, parents: [parent] }),
  });
  return folder.id;
}

/** Moves a file between the gallery's main area and its sections. */
export async function moveFile(token: string, id: string, from: string, to: string) {
  await call(token, `${API}/files/${id}?addParents=${encodeURIComponent(to)}&removeParents=${encodeURIComponent(from)}`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------- branding

export async function ensureBrandFolder(token: string, existing?: string) {
  if (existing) return existing;
  const root = await ensureRoot(token);
  const found = await ownerFind(token, `name='${BRAND_FOLDER}' and mimeType='${FOLDER}' and '${root}' in parents and trashed=false`);
  return found ?? createFolder(token, root, BRAND_FOLDER);
}

export async function writeBrand(token: string, fileId: string | undefined, brand: object) {
  const content = JSON.stringify(brand, null, 2);
  if (!fileId) {
    const root = await ensureRoot(token);
    fileId = (await ownerFind(token, `name='${BRAND_FILE}' and '${root}' in parents and trashed=false`)) ?? undefined;
  }
  if (fileId) {
    try {
      const { body, headers } = multipart({}, content);
      await call(token, `${UPLOAD}/files/${fileId}?uploadType=multipart`, { method: "PATCH", body, headers });
      return fileId;
    } catch (e) {
      if (!(e instanceof DriveError) || (e.status !== 403 && e.status !== 404)) throw e;
    }
  }
  const root = await ensureRoot(token);
  const { body, headers } = multipart({ name: BRAND_FILE, parents: [root], mimeType: "application/json" }, content);
  const created = await call<{ id: string }>(token, `${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", body, headers });
  return created.id;
}

// ---------------------------------------------------------------- activity sheet

/** Creates the activity spreadsheet in CLIENTS (owned by you) and lets the service account add rows to it. */
export async function ensureActivitySheet(token: string) {
  const root = await ensureRoot(token);
  const existing =
    (await findActivitySheet(true)) ??
    (await ownerFind(token, `name='${ACTIVITY_NAME.replace(/'/g, "\\'")}' and mimeType='${SHEET_MIME}' and '${root}' in parents and trashed=false`));
  if (existing) {
    rememberActivitySheet(existing);
    return existing;
  }
  const sheet = await call<{ id: string }>(token, `${API}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: ACTIVITY_NAME, mimeType: SHEET_MIME, parents: [root] }),
  });
  await call(token, `${API}/files/${sheet.id}/permissions?sendNotificationEmail=false`, {
    method: "POST",
    body: JSON.stringify({ role: "writer", type: "user", emailAddress: serviceAccountEmail() }),
  });
  // Header row, written by the service account now that it can edit.
  for (let i = 0; i < 3; i++) {
    try {
      await sheets().spreadsheets.values.update({
        spreadsheetId: sheet.id,
        range: "A1:G1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  rememberActivitySheet(sheet.id);
  return sheet.id;
}

// ---------------------------------------------------------------- email sender key

export const MAILER_FILE = ".mailer-key";

/** Saves the owner's (encrypted) Google sign-in so scheduled reminders can send email as them. */
export async function writeMailerKey(token: string, sealed: string) {
  const root = await resolveRoot(true);
  if (!root) return; // no CLIENTS folder yet; saved on the next sign-in
  const existing = await ownerFind(token, `name='${MAILER_FILE}' and '${root}' in parents and trashed=false`);
  if (existing) {
    const { body, headers } = multipart({}, sealed);
    await call(token, `${UPLOAD}/files/${existing}?uploadType=multipart`, { method: "PATCH", body, headers });
    return;
  }
  const { body, headers } = multipart({ name: MAILER_FILE, parents: [root], mimeType: "text/plain" }, sealed);
  await call(token, `${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", body, headers });
}
