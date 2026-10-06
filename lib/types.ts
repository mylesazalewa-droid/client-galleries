export type MediaKind = "photo" | "video" | "caption";

/** Another format of the same film, e.g. the 9:16 social cut of a 16:9 master. */
export type Version = { id: string; label: string; name: string; src: string; download: string; width: number; height: number };

/** A caption/subtitle file attached to a film. */
export type Caption = { id: string; label: string; name: string; lang?: string; src: string; download: string };

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
  /** Display title for grouped films (file name without format tag/extension) */
  title?: string;
  /** All formats of this film, primary first (only when there's more than one) */
  versions?: Version[];
  captions?: Caption[];
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
  /** let clients share single films and embed them on their website (default on) */
  share?: boolean;
  /** usage rights / licensing note shown to the client */
  license?: string;
  /** Stripe Payment Link that unlocks a payment hold */
  payUrl?: string;
  /** Stripe Payment Link created from the dashboard */
  payLinkId?: string;
  /** amount in cents and what it's for (shown to the client) */
  payAmount?: number;
  payLabel?: string;
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
  share: boolean;
  /** signed keys for sharing single films (video id → key), when sharing is on */
  shareKeys?: Record<string, { k: string; d?: string }>;
  license?: string;
  /** link to pay, while on hold */
  payUrl?: string;
  /** e.g. "$2,500.00" */
  payDue?: string;
  /** URL of the client's logo for "Prepared for" */
  clientLogo?: string;
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
  /** image tiled over previews while a payment hold is on */
  watermark?: string;
  /** URL + kind of the landing page background, if any */
  landing?: { src: string; poster?: string; kind: MediaKind };
};
