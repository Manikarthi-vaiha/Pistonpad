import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/products";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Add part" };

export default async function NewProductPage() {
  const user = await requireUser();
  const catalog = await getCatalog();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Add part" sub="Choose the brand, then tap every bike model this part fits." />
      <ProductForm catalog={catalog} isOwner={user.role === "owner"} />
    </div>
  );
}
