import type { Studio } from "@/lib/types";
import { Lock } from "../icons";

const ERRORS: Record<string, string> = {
  "not-owner": "That Google account isn't on the owner list.",
  cancelled: "Sign-in was cancelled.",
  state: "Sign-in expired. Try again.",
  google: "Google didn't complete the sign-in. Try again.",
  scope: "Please allow access to Google Drive when signing in — uploads need it.",
  setup: "Google sign-in isn't configured yet.",
};

export default function AdminLogin({ studio, demo, oauthReady, error }: { studio: Studio; demo: boolean; oauthReady: boolean; error?: string }) {
  return (
    <main className="center-page">
      <div className="lock">
        <div className="badge"><Lock /></div>
        <div className="eyebrow">{studio.name}</div>
        <h1 className="serif">Owner dashboard</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>Create galleries and upload photos and films straight to your Google Drive.</p>

        <div style={{ display: "grid", gap: 10, marginTop: 26 }}>
          {oauthReady && (
            <a className="btn primary" href="/api/auth/google" style={{ justifyContent: "center", height: 46 }}>
              <GoogleMark /> Sign in with Google
            </a>
          )}
          {demo && (
            <form action="/api/auth/demo" method="post">
              <button className="btn" style={{ width: "100%", justifyContent: "center", height: 46 }}>Preview the dashboard (demo)</button>
            </form>
          )}
        </div>

        {error && <p className="error" role="alert" style={{ marginTop: 14 }}>{ERRORS[error] ?? "Something went wrong."}</p>}
        {!oauthReady && !demo && (
          <p className="error" style={{ marginTop: 14 }}>
            Google sign-in isn&apos;t set up. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and OWNER_EMAILS in Vercel.
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
      <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.4z" opacity=".95" />
      <path fill="#fff" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" opacity=".8" />
      <path fill="#fff" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z" opacity=".65" />
      <path fill="#fff" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" opacity=".9" />
    </svg>
  );
}
