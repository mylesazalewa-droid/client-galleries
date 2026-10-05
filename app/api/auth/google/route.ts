import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { oauthClientId, oauthReady } from "@/lib/config";

export const runtime = "nodejs";

// drive.file: the app can only touch files and folders it creates (plus anything shared with the service account for reading).
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];

export async function GET(req: Request) {
  if (!oauthReady) return Response.redirect(new URL("/admin?error=setup", req.url));
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });

  const origin = new URL(req.url).origin;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: oauthClientId,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return Response.redirect(url.toString());
}
