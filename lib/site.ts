import "server-only";
import { loadAll, type GalleryRecord } from "./galleries";

/** What the studio offers. Edit here to change the Home and Pricing pages. */
export const SERVICES = [
  {
    id: "brand",
    title: "Brand & story edits",
    short: "Your footage, shaped into a story people finish.",
    body: "Interviews and b-roll cut into brand films, member and customer stories, launches and campaign pieces.",
    includes: ["Story edit from your footage", "Music selection and licensing guidance", "Color correction and sound mix", "Captions and every format you need"],
  },
  {
    id: "events",
    title: "Conference & event edits",
    short: "Sessions, highlights and recaps, turned around fast.",
    body: "Keynotes and breakout sessions cleaned up and published, plus speaker highlights and a recap your attendees will share.",
    includes: ["Session edits with titles and lower thirds", "Multi-camera syncing and switching", "Recap and highlight films", "Fast turnaround for next-day use"],
  },
  {
    id: "social",
    title: "Social cuts & versions",
    short: "One edit, every shape and length.",
    body: "Vertical, square and widescreen versions, short cutdowns and captioned clips made from your finished film or raw footage.",
    includes: ["9×16, 1×1 and 16×9 versions", "15, 30 and 60 second cutdowns", "Burned-in or SRT captions", "Thumbnails and stills from the edit"],
  },
  {
    id: "post",
    title: "Post-production for agencies",
    short: "Your shoot, my edit, delivered under your brand.",
    body: "Editing, color and sound finishing for agencies and videographers, with review and delivery pages branded as you.",
    includes: ["Edit, color and sound finishing", "Client review page with timestamped notes", "White-label delivery under your brand", "Project files on request"],
  },
] as const;

export const PROCESS = [
  { title: "Send footage", text: "Share your footage and a few notes on goals, audience, length and deadline. You get a clear quote and plan." },
  { title: "Edit", text: "I build the first cut: story, pacing, music, color and sound." },
  { title: "Review", text: "You leave notes right on the video, pinned to the exact moment, and approve each piece." },
  { title: "Deliver", text: "Final files in a private gallery, in every format, ready to download and share." },
];

export type Project = { slug: string; title: string; client?: string; blurb?: string; date?: string; cover?: string; videos: number; photos: number };

/** Galleries you've marked "Show on my website", newest first. */
export async function showcase(): Promise<GalleryRecord[]> {
  const all = await loadAll().catch(() => []);
  return all
    .filter((g) => g.settings.showcase && !g.hidden && !g.settings.hold && g.items.length)
    .sort((a, b) => (b.settings.date ?? "").localeCompare(a.settings.date ?? ""));
}

export function toProject(g: GalleryRecord): Project {
  const cover = g.cover ?? g.items.find((i) => i.kind === "photo") ?? g.items[0];
  return {
    slug: g.slug,
    title: g.title,
    client: g.settings.client,
    blurb: g.settings.blurb,
    date: g.settings.date,
    cover: cover?.full || cover?.thumb,
    videos: g.items.filter((i) => i.kind === "video").length,
    photos: g.items.filter((i) => i.kind === "photo").length,
  };
}
