import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import MarkupShell from "@/components/admin/markup/MarkupShell";
import ReviewManager from "@/components/admin/markup/ReviewManager";
import { loadBrand, type Brand } from "@/lib/brand";
import { studio } from "@/lib/config";
import { loadReviews } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review project" };

export default async function ReviewProject({ params }: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const { id } = await params;
  let p = (await loadReviews()).find((r) => r.id === id);
  for (let i = 0; !p && i < 3; i++) {
    await new Promise((r) => setTimeout(r, 1200)); // Drive may take a moment to list a brand-new folder
    p = (await loadReviews(true)).find((r) => r.id === id);
  }
  if (!p) notFound();
  const { brand } = await loadBrand().catch(() => ({ brand: {} as Brand }));
  return (
    <MarkupShell studio={studio} email={owner.email} demo={owner.demo} active={p.hidden ? "archive" : "projects"}>
      <ReviewManager
        demo={owner.demo}
        brands={(brand.profiles ?? []).map((b) => ({ id: b.id, name: b.name }))}
        project={{ id: p.id, slug: p.slug, title: p.title, settings: p.settings, hidden: !!p.hidden, items: p.items, sections: p.sections }}
      />
    </MarkupShell>
  );
}
