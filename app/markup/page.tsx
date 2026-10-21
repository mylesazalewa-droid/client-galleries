import { redirect } from "next/navigation";

/** Short address for the review dashboard: galleries.sowcreativestudios.com/markup */
export default function Markup() {
  redirect("/admin/reviews");
}
