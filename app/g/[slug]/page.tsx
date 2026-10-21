import { galleryMetadata, renderGallery, type Props } from "@/components/routes/GalleryRoute";

export const dynamic = "force-dynamic";
export const generateMetadata = galleryMetadata;

export default function GalleryPage(props: Props) {
  return renderGallery(props, "g");
}
