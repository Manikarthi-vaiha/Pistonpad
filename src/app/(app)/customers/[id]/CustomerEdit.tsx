"use client";

import { useActionState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Textarea } from "@/components/ui";
import { saveCustomer } from "../actions";

type C = { id: number; name: string; phone: string; gstin: string; address: string; credit_limit: number };

export function CustomerEdit({ customer }: { customer: C }) {
  const [state, action, pending] = useActionState(saveCustomer.bind(null, customer.id), {} as { error?: string });
  return (
    <Card className="xl:self-start">
      <CardHeader title="Details" />
      <form action={action} className="flex flex-col gap-4 p-5">
        <Field label="Name"><Input name="name" defaultValue={customer.name} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input name="phone" defaultValue={customer.phone} inputMode="tel" /></Field>
          <Field label="GSTIN"><Input name="gstin" defaultValue={customer.gstin} className="font-mono uppercase" maxLength={15} /></Field>
        </div>
        <Field label="Address"><Textarea name="address" rows={2} defaultValue={customer.address} /></Field>
        <Field label="Credit limit ₹" hint="Warns at billing when the balance goes over this. 0 = no limit."><Input name="creditLimit" inputMode="decimal" defaultValue={customer.credit_limit} /></Field>
        {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
        <Button variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      </form>
    </Card>
  );
}
