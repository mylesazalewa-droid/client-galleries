import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import GalleryManager from "@/components/admin/GalleryManager";
import { studio } from "@/lib/config";
import { getRecordById } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit gallery" };

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const g = await getRecordById((await params).id, true);
  if (!g) notFound();

  return (
    <AdminShell studio={studio} email={owner.email} demo={owner.demo} back>
      <GalleryManager
        demo={owner.demo}
        gallery={{
          id: g.id,
          slug: g.slug,
          title: g.title,
          settings: g.settings,
          hidden: !!g.hidden,
          items: g.items,
          cover: g.cover ?? null,
        }}
      />
    </AdminShell>
  );
}
