import "server-only";
import { loadAll, type GalleryRecord } from "./galleries";

/** What the studio offers. Edit here to change the Home and Pricing pages. */
export const SERVICES = [
  {
    id: "brand",
    title: "Brand & story films",
    short: "Films that show who you are and why it matters.",
    body: "Interviews, b-roll and story-driven edits for your website, campaigns, annual meetings and launches.",
    includes: ["Planning call and creative approach", "Interviews and on-location filming", "Edit, color, sound mix and captions", "Every format you need (16×9, 9×16, 1×1)"],
  },
  {
    id: "events",
    title: "Conferences & events",
    short: "Multi-camera coverage, sessions and recap films.",
    body: "Keynotes and breakout sessions, speaker highlights and a recap film your attendees will actually share.",
    includes: ["Multi-camera session recording", "Clean audio from the board or lavs", "Recap and highlight edits", "Fast turnaround for next-day use"],
  },
  {
    id: "photo",
    title: "Photography",
    short: "Events, headshots and on-location stills.",
    body: "Edited photos delivered in a private gallery your team can browse, favorite and download.",
    includes: ["Event and on-location coverage", "Team and leadership headshots", "Color-corrected, web and print sizes", "Private gallery with downloads"],
  },
  {
    id: "post",
    title: "Editing & post-production",
    short: "Already have footage? I'll take it from here.",
    body: "Editing, color, sound and captions. Agencies can have everything delivered under their own brand.",
    includes: ["Story edit from your footage", "Color and sound finishing", "Captions and versions", "White-label delivery for agencies"],
  },
] as const;

export const PROCESS = [
  { title: "Plan", text: "A quick call about goals, audience, dates and budget. You get a clear quote and plan." },
  { title: "Create", text: "Filming and photography on location, then the edit." },
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
