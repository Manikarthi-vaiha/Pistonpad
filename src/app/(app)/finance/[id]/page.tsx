import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getFinancier } from "@/lib/financiers";
import { FinancierForm } from "../FinancierForm";

export const metadata: Metadata = { title: "Edit finance company" };

export default async function EditFinancierPage({ params }: PageProps<"/finance/[id]">) {
  await requireUser("owner");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const f = await getFinancier(Number(id));
  if (!f) notFound();
  return (
    <>
      <Link href="/finance" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Finance companies
      </Link>
      <h1 className="mb-5 text-xl font-bold tracking-tight">Edit: {f.name}</h1>
      <Card className="max-w-2xl p-5">
        <FinancierForm id={f.id} defaults={f} />
      </Card>
    </>
  );
}
