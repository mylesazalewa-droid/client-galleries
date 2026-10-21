import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import BrandList from "@/components/admin/BrandList";
import { loadAll } from "@/lib/galleries";
import { loadBrand, profileLogo, type Brand } from "@/lib/brand";
import { studio as envStudio } from "@/lib/config";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Client brands" };

export default async function BrandsPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const [{ brand }, galleries] = await Promise.all([loadBrand(true).catch(() => ({ brand: {} as Brand })), loadAll().catch(() => [])]);
  const profiles = (brand.profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    accent: p.accent,
    logo: profileLogo(p),
    galleries: galleries.filter((g) => g.settings.brandId === p.id).length,
  }));
  return (
    <AdminShell studio={envStudio} email={owner.email} demo={owner.demo} back>
      <BrandList profiles={profiles} demo={owner.demo} />
    </AdminShell>
  );
}
