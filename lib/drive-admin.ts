import "server-only";
import { rootFolderName } from "./config";
import { clearCache, resolveRoot, SETTINGS_FILE } from "./galleries";
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

/** Finds the CLIENTS folder, or creates it in the owner's Drive and shares it (read-only) with the service account. */
export async function ensureRoot(token: string) {
  const existing = await resolveRoot(true);
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
