import type { GalleryRecord } from "./galleries";
import type { MediaItem } from "./types";

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

function film(name: string, seed: number, duration: number): MediaItem {
  const poster = `/api/demo/poster-${seed}.svg?w=1280&h=720`;
  return {
    id: name, name, kind: "video", width: 16, height: 9, duration,
    thumb: poster, full: poster, src: "/demo/film.mp4", download: "/demo/film.mp4", section: "",
  };
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
        message: "Final cuts, social versions and stills from the two-day shoot. Heart anything you'd like to use and send your picks when you're ready.",
      },
      cover: p[2],
      sections: [{ id: "demo-stills", name: "Behind the scenes" }],
      items: [film("01 Hero cut.mp4", 21, 5), p[0], p[1], film("02 Social cut.mp4", 26, 5), p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11]],
    },
    {
      id: "demo-2",
      slug: "fall-leadership-conference",
      title: "Fall Leadership Conference",
      settings: { client: "Great Lakes Financial Network", date: "2026-08-02", password: "demo", hold: true },
      cover: p[9],
      sections: [],
      items: [p[6], p[7], p[8], p[10], p[11], film("Conference recap.mp4", 22, 5)].map((x) => ({ ...x, section: "" })),
    },
  ];
}
