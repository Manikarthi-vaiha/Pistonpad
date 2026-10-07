import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/products";
import { normalizeReg } from "@/lib/regno";
import { VehicleForm } from "../VehicleForm";

export const metadata: Metadata = { title: "Add bike" };

export default async function NewVehiclePage({ searchParams }: PageProps<"/vehicles/new">) {
  await requireUser();
  const { reg } = await searchParams;
  const catalog = await getCatalog();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Add bike" sub="Fill what you know from the RC and insurance. Everything except the number and model can be added later." />
      <VehicleForm catalog={catalog} regNo={typeof reg === "string" ? normalizeReg(reg) : undefined} />
    </div>
  );
}
