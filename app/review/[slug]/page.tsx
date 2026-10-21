import { galleryMetadata, renderGallery, type Props } from "@/components/routes/GalleryRoute";

export const dynamic = "force-dynamic";
export const generateMetadata = galleryMetadata;

export default function ReviewPage(props: Props) {
  return renderGallery(props, "review");
}
