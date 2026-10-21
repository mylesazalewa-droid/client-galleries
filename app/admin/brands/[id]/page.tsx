import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import BrandProfileEditor from "@/components/admin/BrandProfileEditor";
import { clampOpacity, defaultMarkId, loadBrand, markOptions, profileLogo, type Brand } from "@/lib/brand";
import { studio as envStudio } from "@/lib/config";
import { loadAll } from "@/lib/galleries";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Client brand" };

export default async function BrandProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const { id } = await params;
  const [{ brand }, galleries] = await Promise.all([loadBrand(true).catch(() => ({ brand: {} as Brand })), loadAll().catch(() => [])]);
  const profile = brand.profiles?.find((p) => p.id === id);
  if (!profile) notFound();
  const used = galleries.filter((g) => g.settings.brandId === id).map((g) => ({ id: g.id, title: g.title, slug: g.slug }));
  return (
    <AdminShell studio={envStudio} email={owner.email} demo={owner.demo} back>
      <BrandProfileEditor
        demo={owner.demo}
        profile={profile}
        logo={profileLogo(profile)}
        galleries={used}
        marks={{
          options: markOptions(brand, profile.name, profile),
          defaultId: defaultMarkId(brand, profile),
          opacity: clampOpacity(profile.markOpacity, clampOpacity(brand.markOpacity, 0.3)),
          layout: profile.markLayout ?? brand.markLayout ?? "tile",
        }}
      />
    </AdminShell>
  );
}
