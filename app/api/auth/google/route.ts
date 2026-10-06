import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { oauthClientId, oauthReady, siteOrigin } from "@/lib/config";

export const runtime = "nodejs";

// drive.file: the app can only touch files and folders it creates (plus anything shared with the service account for reading).
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];

export async function GET(req: Request) {
  if (!oauthReady) return Response.redirect(new URL("/admin?error=setup", req.url));
  // Started on another address for the site (e.g. a Vercel preview URL)? Continue on the main one.
  const here = new URL(req.url);
  const main = siteOrigin(here.origin);
  if (main !== here.origin) return Response.redirect(`${main}${here.pathname}${here.search}`);
  const state = randomBytes(16).toString("hex");
  const back = here.searchParams.get("back");
  if (back?.startsWith("/admin")) (await cookies()).set("after_login", back, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  (await cookies()).set("oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });

  const origin = main;
  // "Connect Gmail" asks for permission to send email as you, on top of Drive.
  const scopes = here.searchParams.get("gmail") ? [...SCOPES, "https://www.googleapis.com/auth/gmail.send"] : SCOPES;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: oauthClientId,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return Response.redirect(url.toString());
}
