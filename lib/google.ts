import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

let auth: InstanceType<typeof google.auth.JWT> | null = null;

export function getAuth() {
  if (!auth) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    // Accept the JSON key pasted as-is or base64-encoded.
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const key = JSON.parse(json);
    auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
  }
  return auth;
}

export function drive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export async function accessToken(): Promise<string> {
  const res = await getAuth().getAccessToken();
  if (!res.token) throw new Error("Could not get a Google access token");
  return res.token;
}

/** Raw authenticated fetch against the Drive media endpoint (supports Range). */
export async function driveMedia(id: string, init: { range?: string | null; signal?: AbortSignal } = {}) {
  const token = await accessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init.range) headers.Range = init.range;
  return fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
    { headers, signal: init.signal },
  );
}
