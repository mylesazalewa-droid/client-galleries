import { after } from "next/server";
import { cookies } from "next/headers";
import { oauthClientId, oauthClientSecret, ownerEmails, siteOrigin } from "@/lib/config";
import { writeSession } from "@/lib/owner";

export const runtime = "nodejs";

function back(req: Request, error: string) {
  return Response.redirect(new URL(`/admin?error=${error}`, req.url));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("oauth_state")?.value;
  jar.delete("oauth_state");
  if (url.searchParams.get("error")) return back(req, "cancelled");
  if (!expected || url.searchParams.get("state") !== expected) return back(req, "state");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: url.searchParams.get("code") ?? "",
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      redirect_uri: `${siteOrigin(url.origin)}/api/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tok = await res.json();
  if (!res.ok || !tok.id_token) return back(req, "google");

  // The id_token came straight from Google's token endpoint over TLS, so its payload can be trusted.
  const claims = JSON.parse(Buffer.from(String(tok.id_token).split(".")[1], "base64url").toString("utf8"));
  const email = String(claims.email ?? "").toLowerCase();
  if (!claims.email_verified || !ownerEmails.includes(email)) return back(req, "not-owner");
  if (!String(tok.scope ?? "").includes("drive.file")) return back(req, "scope");

  const gmail = String(tok.scope ?? "").includes("gmail.send");
  await writeSession({
    email,
    rt: tok.refresh_token,
    at: tok.access_token,
    exp: Date.now() + (tok.expires_in ?? 3600) * 1000,
    gmail,
  });
  // Keep a sealed copy of this sign-in in CLIENTS so the daily reminders can send email as you.
  if (gmail && tok.refresh_token) {
    after(async () => {
      try {
        const [{ writeMailerKey }, { sealMailer }] = await Promise.all([import("@/lib/drive-admin"), import("@/lib/mail")]);
        await writeMailerKey(tok.access_token, sealMailer(email, tok.refresh_token));
      } catch (e) {
        console.warn("couldn't save mailer key", e);
      }
    });
  }
  const next = jar.get("after_login")?.value;
  jar.delete("after_login");
  return Response.redirect(new URL(next && next.startsWith("/admin") ? next : "/admin", req.url));
}
