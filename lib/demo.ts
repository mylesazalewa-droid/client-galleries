import type { GalleryRecord } from "./galleries";
import type { MediaItem } from "./types";
import { groupVersions } from "./versions";

// Demo mode: sample photos are drawn by /api/demo, and one tiny clip lives in /public/demo.
const sizes: [number, number][] = [
  [2400, 1600], [1600, 2400], [2400, 1600], [2000, 2000], [1600, 2400], [2400, 1350],
  [2400, 1600], [1600, 2400], [2400, 1600], [2400, 1600], [1600, 2000], [2400, 1600],
];

function photo(i: number): MediaItem {
  const [width, height] = sizes[i];
  const name = `photo-${String(i + 1).padStart(2, "0")}.svg`;
  const url = `/api/demo/${name}?w=${width}&h=${height}`;
  return { id: name, name, kind: "photo", width, height, thumb: url, full: url, download: url, section: i >= 8 ? "demo-stills" : "" };
}

function film(name: string, seed: number, duration: number, width = 16, height = 9): MediaItem {
  const poster = `/api/demo/poster-${seed}.svg?w=${width > height ? 1280 : 720}&h=${width > height ? 720 : width === height ? 720 : 1280}`;
  return {
    id: name, name, kind: "video", width, height, duration,
    thumb: poster, full: poster, src: "/demo/film.mp4", download: "/demo/film.mp4", section: "",
  };
}

function caption(name: string): MediaItem {
  return { id: name, name, kind: "caption", width: 0, height: 0, thumb: "", full: "", src: "/demo/captions.vtt", download: "/demo/captions.vtt", section: "" };
}

export function demoGalleries(): GalleryRecord[] {
  const p = sizes.map((_, i) => photo(i));
  return [
    {
      id: "demo-1",
      slug: "lakeshore-credit-union-brand-film",
      title: "Lakeshore Credit Union — Brand Film",
      settings: {
        client: "Lakeshore Credit Union",
        date: "2026-09-18",
        message: "Your brand film in every format, plus stills from the two-day shoot.",
        license: "Licensed for Lakeshore Credit Union's website, social channels and internal events through October 2027.\nMusic is licensed for web and social. Paid advertising or broadcast needs an upgraded music license.",
      },
      clientLogoId: undefined,
      cover: p[2],
      sections: [{ id: "demo-stills", name: "Behind the scenes" }],
      ...groupVersions(
        [film("Hero cut — 16x9.mp4", 21, 5), film("Hero cut — 9x16.mp4", 23, 5, 9, 16), film("Hero cut — 1x1.mp4", 24, 5, 1, 1), p[0], p[1], film("Social teaser.mp4", 26, 5), p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11]],
        [caption("Hero cut.en.srt")],
      ),
    },
    {
      id: "demo-2",
      slug: "fall-leadership-conference",
      title: "Fall Leadership Conference",
      settings: { client: "Great Lakes Financial Network", date: "2026-08-02", password: "demo", hold: true, payUrl: "https://buy.stripe.com/test_demo" },
      cover: p[9],
      sections: [],
      extras: [],
      items: [p[6], p[7], p[8], p[10], p[11], film("Conference recap.mp4", 22, 5)].map((x) => ({ ...x, section: "" })),
    },
  ];
}
