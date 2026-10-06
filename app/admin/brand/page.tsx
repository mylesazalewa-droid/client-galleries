import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import BrandEditor from "@/components/admin/BrandEditor";
import { clampOpacity, defaultMarkId, getStudio, loadBrand, markOptions, type Brand } from "@/lib/brand";
import { studio as envStudio, ownerEmails } from "@/lib/config";
import AccessPanel from "@/components/admin/AccessPanel";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Branding" };

export default async function BrandPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/admin");
  const [{ brand }, studio] = await Promise.all([loadBrand(true).catch(() => ({ brand: {} as Brand })), getStudio()]);
  return (
    <AdminShell studio={envStudio} email={owner.email} demo={owner.demo} back>
      <BrandEditor
        demo={owner.demo}
        brand={brand}
        studio={studio}
        marks={{
          options: markOptions(brand, studio.name),
          defaultId: defaultMarkId(brand),
          opacity: clampOpacity(brand.markOpacity, 0.3),
          layout: brand.markLayout ?? "tile",
        }}
      />
      <AccessPanel demo={owner.demo} owners={owner.demo ? ["you@example.com"] : ownerEmails} />
    </AdminShell>
  );
}
