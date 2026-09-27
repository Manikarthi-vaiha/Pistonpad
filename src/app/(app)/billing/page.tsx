import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { BillingClient } from "./BillingClient";

export const metadata: Metadata = { title: "New bill" };

export default async function BillingPage() {
  await requireUser();
  const [s] = await sql<{ state_code: string }[]>`select state_code from settings where id = 1`;
  return (
    <>
      <PageHeader title="New bill" sub="F2 search · ↑↓ Enter add · F9 save" />
      <BillingClient shopState={s?.state_code ?? "33"} />
    </>
  );
}
