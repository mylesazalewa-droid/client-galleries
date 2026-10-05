export type MediaKind = "photo" | "video";

export type MediaItem = {
  id: string;
  name: string;
  kind: MediaKind;
  width: number;
  height: number;
  /** seconds, videos only */
  duration?: number;
  /** grid-sized image */
  thumb: string;
  /** large image for the lightbox (poster frame for videos) */
  full: string;
  /** playable source, videos only */
  src?: string;
  download: string;
  /** Drive folder ID of the section this file lives in ("" = main area of the gallery) */
  section: string;
};

export type Section = { id: string; name: string };

export type GallerySettings = {
  client?: string;
  date?: string;
  password?: string;
  downloads?: boolean;
  /** file name of the cover image inside the folder */
  cover?: string;
  /** optional intro line under the title */
  message?: string;
  /** draft: only visible in the dashboard */
  hidden?: boolean;
  /** YYYY-MM-DD; the gallery closes after this day */
  expires?: string;
  /** previews only (watermarked, no downloads) until paid */
  hold?: boolean;
  /** let clients heart favorites and send picks */
  picks?: boolean;
};

export type GallerySummary = {
  id: string;
  slug: string;
  title: string;
  client?: string;
  date?: string;
  locked: boolean;
  coverThumb?: string;
};

export type Gallery = GallerySummary & {
  message?: string;
  allowDownload: boolean;
  hold: boolean;
  picks: boolean;
  expires?: string;
  cover?: MediaItem;
  items: MediaItem[];
  sections: Section[];
  zip: string;
};

export type Studio = {
  name: string;
  tagline: string;
  headline?: string;
  url?: string;
  email?: string;
  accent?: string;
  /** URL of the uploaded logo, if any */
  logo?: string;
  /** URL + kind of the landing page background, if any */
  landing?: { src: string; poster?: string; kind: MediaKind };
};
