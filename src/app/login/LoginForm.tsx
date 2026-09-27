"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button, Field, Input, Notice } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <Field label="Username">
        <Input id="username" name="username" autoComplete="username" autoFocus required />
      </Field>
      <Field label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button variant="primary" size="lg" disabled={pending} className="mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
