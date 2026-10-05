import type { Metadata, Viewport } from "next";
import { getStudio, inkFor } from "@/lib/brand";
import { studio } from "@/lib/config";
import "./globals.css";

const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: studio.name, template: `%s · ${studio.name}` },
  description: `${studio.tagline} — client galleries`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0d0e",
};

// Applies the saved theme before first paint so there's no flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Your accent color (set in the dashboard) replaces the default in both light and dark mode.
  const { accent } = await getStudio().catch(() => ({ accent: undefined }));
  const style = accent ? ({ "--accent": accent, "--accent-ink": inkFor(accent) } as React.CSSProperties) : undefined;
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning style={style}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
