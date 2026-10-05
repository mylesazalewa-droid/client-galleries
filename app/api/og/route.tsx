import { ImageResponse } from "next/og";
import { loadBrand, getStudio } from "@/lib/brand";
import { isDemo } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { getRecord, isExpired, toGallery } from "@/lib/galleries";
import { serveImage } from "@/lib/serve";
import { shareAllowed, validKey } from "@/lib/share";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

/** Turns a Drive image (or a demo URL) into a data URI the card renderer can draw. */
async function imageData(source: { id?: string; url?: string }, origin: string, size = 1200) {
  try {
    let res: Response;
    if (source.id && !isDemo) res = await serveImage(source.id, { size, isPhoto: true, cache: "no-store" });
    else if (source.url) res = await fetch(new URL(source.url, origin), { signal: AbortSignal.timeout(4000) });
    else return undefined;
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png|gif)/.test(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

async function serif(text: string) {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Instrument+Serif&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(3000) }).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return undefined;
    return await fetch(url, { signal: AbortSignal.timeout(3000) }).then((r) => r.arrayBuffer());
  } catch {
    return undefined;
  }
}

/**
 * Link preview card for a gallery or a single film: cover (only when it isn't private), title,
 * your logo and "Prepared for <client>". Used for iMessage/Slack/email previews.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const g = await getRecord(url.searchParams.get("g") ?? "");
  const studio = await getStudio();
  const origin = url.origin;

  const film = g && url.searchParams.get("f") ? g.items.find((i) => i.id === url.searchParams.get("f") && i.kind === "video") : undefined;
  const open = !!g && !isExpired(g.settings) && !g.settings.hold;
  const showImage = film
    ? open && shareAllowed(g!) && (validKey(g!.slug, film.id, url.searchParams.get("k")) || !g!.settings.password)
    : open && !g?.settings.password;

  const view = g ? toGallery(g) : undefined;
  const coverItem = film ?? view?.cover;
  const { brand } = await loadBrand().catch(() => ({ brand: {} as { logoId?: string } }));

  const [bg, studioLogo, clientLogo] = await Promise.all([
    showImage && coverItem ? imageData(isDemo ? { url: coverItem.full } : { id: coverItem.id }, origin) : undefined,
    brand.logoId ? imageData({ id: brand.logoId }, origin, 400) : undefined,
    g?.clientLogoId ? imageData({ id: g.clientLogoId }, origin, 400) : undefined,
  ]);

  const title = film ? film.title ?? film.name.replace(/\.[^.]+$/, "") : g?.title ?? studio.name;
  const client = g?.settings.client;
  const eyebrow = [film ? "Film" : g ? "Gallery" : studio.tagline, g?.settings.date && formatDate(g.settings.date)].filter(Boolean).join("  ·  ");
  const accent = studio.accent ?? "#c98a4b";
  const font = await serif(`${title}${studio.name}`);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: "#0d0d0e", color: "#f4f1ec", fontFamily: "Inter, sans-serif" }}>
        {bg ? (
          <img src={bg} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: W, height: H, objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", backgroundImage: `linear-gradient(135deg, #0d0d0e 0%, #0d0d0e 40%, ${accent}66 100%)` }} />
        )}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 35%, rgba(0,0,0,.25) 55%, rgba(0,0,0,.85) 100%)" }} />

        <div style={{ position: "absolute", top: 48, left: 60, right: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {studioLogo ? (
            <img src={studioLogo} height={56} style={{ height: 56, objectFit: "contain", maxWidth: 360 }} />
          ) : (
            <div style={{ display: "flex", fontSize: 34, ...(font ? { fontFamily: "Serif" } : {}), letterSpacing: -0.5 }}>{studio.name}</div>
          )}
          {film && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 74, height: 74, borderRadius: 74, background: "rgba(255,255,255,.18)", border: "2px solid rgba(255,255,255,.5)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" /></svg>
            </div>
          )}
        </div>

        <div style={{ position: "absolute", left: 60, right: 60, bottom: 54, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: accent, marginBottom: 14 }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: title.length > 40 ? 64 : 84, lineHeight: 1.02, ...(font ? { fontFamily: "Serif" } : {}), letterSpacing: -1, maxWidth: 1000 }}>{title}</div>
          {(client || clientLogo) && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 26, fontSize: 24, color: "rgba(244,241,236,.85)" }}>
              <span style={{ marginRight: 16 }}>Prepared for</span>
              {clientLogo ? (
                <div style={{ display: "flex", background: "rgba(255,255,255,.92)", borderRadius: 10, padding: "8px 14px" }}>
                  <img src={clientLogo} height={40} style={{ height: 40, objectFit: "contain", maxWidth: 260 }} />
                </div>
              ) : (
                <span style={{ fontWeight: 600, color: "#fff" }}>{client}</span>
              )}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      ...(font ? { fonts: [{ name: "Serif", data: font, style: "normal" as const, weight: 400 as const }] } : {}),
      headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" },
    },
  );
}
