import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { cookieSecret, isDemo, oauthClientId, oauthClientSecret, oauthReady, ownerEmails } from "./config";

/**
 * The owner's Google sign-in lives in an encrypted, http-only cookie.
 * It holds the refresh token so uploads can go into Drive as the owner (using their storage).
 */
export const OWNER_COOKIE = "owner";

type Session = { email: string; rt?: string; at?: string; exp?: number; demo?: boolean; gmail?: boolean; iat?: number };

const key = () => createHash("sha256").update(`owner:${cookieSecret}`).digest();

export function seal(data: object) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(value?: string): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function readSession(): Promise<Session | null> {
  const s = unseal<Session>((await cookies()).get(OWNER_COOKIE)?.value);
  if (!s) return null;
  if (s.demo) return isDemo ? s : null;
  if (isDemo || !oauthReady) return null;
  if (!ownerEmails.includes(s.email.toLowerCase())) return null;
  // "Sign out everywhere" in the dashboard ends every session that started before it.
  const { signedOutBefore } = await import("./brand");
  const cutoff = await signedOutBefore().catch(() => 0);
  if (cutoff && (s.iat ?? 0) < cutoff) return null;
  return s;
}

/** For server components: who is signed in (no token refresh). */
export async function currentOwner() {
  const s = await readSession();
  return s ? { email: s.email, demo: !!s.demo, gmail: !!s.gmail } : null;
}

export async function writeSession(s: Session) {
  (await cookies()).set(OWNER_COOKIE, seal({ ...s, iat: s.iat ?? Date.now() }), cookieOpts);
}

export class NotOwner extends Error {}

/** For route handlers: the owner's Google access token, refreshed when needed. */
export async function ownerToken(): Promise<{ email: string; token: string }> {
  const s = await readSession();
  if (!s || s.demo || !s.rt) throw new NotOwner("Sign in required");
  if (s.at && s.exp && s.exp - Date.now() > 60_000) return { email: s.email, token: s.at };

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      refresh_token: s.rt,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new NotOwner("Google sign-in expired — sign in again");
  const next = { ...s, at: json.access_token as string, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  await writeSession(next);
  return { email: s.email, token: next.at };
}

/** Wraps an admin route: rejects anyone but the owner, turns errors into JSON. */
export function adminRoute<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      const s = await readSession();
      if (!s) return Response.json({ ok: false, error: "Sign in required" }, { status: 401 });
      if (s.demo) return Response.json({ ok: false, error: "Demo mode — connect Google to make changes." }, { status: 400 });
      if (!oauthReady) return Response.json({ ok: false, error: "Google sign-in isn't configured" }, { status: 500 });
      return await fn(...args);
    } catch (e) {
      if (e instanceof NotOwner) return Response.json({ ok: false, error: e.message }, { status: 401 });
      console.error("admin route failed", e);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      return Response.json({ ok: false, error: msg }, { status: 500 });
    }
  };
}
