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
};

export type GallerySettings = {
  client?: string;
  date?: string;
  password?: string;
  downloads?: boolean;
  /** file name of the cover image inside the folder */
  cover?: string;
  /** optional intro line under the title */
  message?: string;
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
  cover?: MediaItem;
  items: MediaItem[];
  zip: string;
};

export type Studio = {
  name: string;
  tagline: string;
  url?: string;
  email?: string;
};
