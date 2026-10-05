import type { Caption, MediaItem, Version } from "./types";

/**
 * Groups formats of the same film by file name:
 *   "Hero cut — 16x9.mp4", "Hero cut — 9x16.mp4", "Hero cut — 1x1.mp4", "Hero cut.srt"
 * become one film with a format switcher and captions.
 */

const FORMATS: { re: RegExp; label: string; rank: number }[] = [
  { re: /^(16x9|16-9|16by9|widescreen|horizontal|landscape|master)$/i, label: "Widescreen 16:9", rank: 0 },
  { re: /^(2\.39|239|2x39|cinema|scope|21x9)$/i, label: "Cinema 2.39", rank: 1 },
  { re: /^(4x3|4-3)$/i, label: "Classic 4:3", rank: 2 },
  { re: /^(1x1|1-1|square)$/i, label: "Square 1:1", rank: 3 },
  { re: /^(4x5|4-5|portrait|feed)$/i, label: "Portrait 4:5", rank: 4 },
  { re: /^(9x16|9-16|vertical|story|stories|reels?|tiktok|shorts?)$/i, label: "Vertical 9:16", rank: 5 },
  { re: /^(cutdown|cut-?down|teaser|15s|30s|60s|:15|:30|:60)$/i, label: "", rank: 6 },
];

const LANGS: Record<string, string> = { en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", zh: "Chinese", ko: "Korean", ja: "Japanese", vi: "Vietnamese", ar: "Arabic" };
const SEP = /[\s_\-—–.]+/;

export function stripExt(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "");
}

/** Splits "Hero cut — 9x16" into { base: "Hero cut", token: "9x16" }. */
export function parseFormat(name: string) {
  const plain = stripExt(name).trim();
  const parts = plain.split(SEP);
  const last = parts[parts.length - 1] ?? "";
  const fmt = FORMATS.find((f) => f.re.test(last));
  if (fmt && parts.length > 1) {
    const base = plain.slice(0, plain.length - last.length).replace(/[\s_\-—–.(]+$/, "").trim();
    return { base, label: fmt.label || last, rank: fmt.rank };
  }
  return { base: plain, label: "", rank: 99 };
}

/** "Hero cut.en.srt" / "Hero cut — captions.srt" → { base: "Hero cut", lang: "en" } */
export function parseCaption(name: string) {
  let plain = stripExt(name).trim();
  let lang: string | undefined;
  const m = plain.match(/[\s_\-—–.(]+([a-z]{2})(?:[-_][A-Za-z]{2})?\)?$/);
  if (m && LANGS[m[1].toLowerCase()]) {
    lang = m[1].toLowerCase();
    plain = plain.slice(0, m.index).trim();
  }
  plain = plain.replace(/[\s_\-—–.(]+(captions?|subtitles?|subs|cc|srt|vtt)\)?$/i, "").trim();
  return { base: parseFormat(plain).base, lang };
}

function aspectLabel(w: number, h: number) {
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.05) return "Widescreen 16:9";
  if (Math.abs(r - 9 / 16) < 0.05) return "Vertical 9:16";
  if (Math.abs(r - 1) < 0.03) return "Square 1:1";
  if (Math.abs(r - 0.8) < 0.03) return "Portrait 4:5";
  if (r > 2.2) return "Cinema 2.39";
  return r > 1 ? "Horizontal" : "Vertical";
}

/**
 * Merges videos that share a base name into one film (primary = widescreen) and attaches captions.
 * Returns the visible items plus "extras" (alternate formats, caption files) that stay downloadable.
 */
export function groupVersions(media: MediaItem[], captions: MediaItem[]) {
  const videos = media.filter((m) => m.kind === "video");
  const groups = new Map<string, MediaItem[]>();
  for (const v of videos) {
    const key = `${v.section}|${parseFormat(v.name).base.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }

  const extras: MediaItem[] = [];
  const primaryOf = new Map<string, MediaItem>(); // video id → primary
  const merged = new Map<string, MediaItem>(); // primary id → merged item

  for (const [, list] of groups) {
    const sorted = [...list].sort((a, b) => parseFormat(a.name).rank - parseFormat(b.name).rank || a.name.localeCompare(b.name));
    const primary = sorted[0];
    const base = parseFormat(primary.name).base;
    const versions: Version[] = sorted.map((v) => {
      const f = parseFormat(v.name);
      return { id: v.id, label: f.label || aspectLabel(v.width, v.height), name: v.name, src: v.src!, download: v.download, width: v.width, height: v.height };
    });
    // de-duplicate identical labels ("Vertical 9:16", "Vertical 9:16 (2)")
    const seen = new Map<string, number>();
    for (const v of versions) {
      const n = (seen.get(v.label) ?? 0) + 1;
      seen.set(v.label, n);
      if (n > 1) v.label = `${v.label} (${n})`;
    }
    const item: MediaItem = { ...primary, title: list.length > 1 || parseFormat(primary.name).label ? base : undefined, versions: list.length > 1 ? versions : undefined };
    merged.set(primary.id, item);
    for (const v of sorted) primaryOf.set(v.id, item);
    extras.push(...sorted.slice(1));
  }

  // Attach captions to the film with the same base name (or the only film in that section).
  for (const c of captions) {
    const { base, lang } = parseCaption(c.name);
    const inSection = [...merged.values()].filter((m) => m.section === c.section);
    const target =
      inSection.find((m) => parseFormat(m.name).base.toLowerCase() === base.toLowerCase()) ?? (inSection.length === 1 ? inSection[0] : undefined);
    extras.push(c);
    if (!target) continue;
    const cap: Caption = {
      id: c.id,
      name: c.name,
      lang,
      label: lang ? LANGS[lang] : "Captions",
      src: c.src!,
      download: c.download,
    };
    target.captions = [...(target.captions ?? []), cap];
  }

  const items = media.flatMap((m) => (m.kind !== "video" ? [m] : merged.has(m.id) ? [merged.get(m.id)!] : []));
  return { items, extras };
}
