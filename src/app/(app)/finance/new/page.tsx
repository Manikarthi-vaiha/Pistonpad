import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { FinancierForm } from "../FinancierForm";

export const metadata: Metadata = { title: "Add finance company" };

export default async function NewFinancierPage() {
  await requireUser("owner");
  return (
    <>
      <Link href="/finance" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Finance companies
      </Link>
      <h1 className="mb-5 text-xl font-bold tracking-tight">Add finance company</h1>
      <Card className="max-w-2xl p-5">
        <FinancierForm id={null} />
      </Card>
    </>
  );
}
