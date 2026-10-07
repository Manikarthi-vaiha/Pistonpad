"use client";

import { useActionState, useEffect } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { login, type LoginState } from "./actions";
import { Button, Field, Input, Notice } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [scope, animate] = useAnimate<HTMLFormElement>();
  const reduce = useReducedMotion();

  // A short shake tells the user the sign-in failed, alongside the written error. The username is kept,
  // so focus goes straight to the password for the next try.
  useEffect(() => {
    if (!state.error) return;
    if (!reduce) animate(scope.current, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.45 });
    const field = scope.current?.querySelector<HTMLInputElement>(state.username ? "#password" : "#username");
    field?.focus();
  }, [state, reduce, animate, scope]);

  return (
    <form ref={scope} action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <AnimatePresence initial={false}>
        {state.error ? (
          <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
            <Notice tone="bad">{state.error}</Notice>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Field label="Username">
        <Input id="username" name="username" autoComplete="username" autoFocus required defaultValue={state.username} />
      </Field>
      <Field label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button variant="primary" size="lg" disabled={pending} className="mt-2 transition-transform active:scale-[0.98] motion-reduce:active:scale-100">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
