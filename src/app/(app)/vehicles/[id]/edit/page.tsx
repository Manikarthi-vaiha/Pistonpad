import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/products";
import { formatReg } from "@/lib/regno";
import { getVehicle } from "@/lib/vehicles";
import { VehicleForm } from "../../VehicleForm";

export const metadata: Metadata = { title: "Edit bike" };

export default async function EditVehiclePage({ params }: PageProps<"/vehicles/[id]/edit">) {
  await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [v, catalog] = await Promise.all([getVehicle(Number(id)), getCatalog()]);
  if (!v) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/vehicles/${v.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> {formatReg(v.reg_no)}</Link>
      <PageHeader title="Edit bike" />
      <VehicleForm catalog={catalog} initial={v} />
    </div>
  );
}
