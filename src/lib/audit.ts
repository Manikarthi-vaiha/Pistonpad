import { sql } from "./db";

export type AuditEntity = "vehicle" | "expense" | "invoice" | "product" | "stock" | "customer" | "settings" | "finance";

/** Fire-and-forget audit entry. Never throws — logging failure must not break the caller. */
export function audit(
  entity: AuditEntity,
  action: string,
  summary: string,
  opts: { entityId?: number | null; userId?: number | null; userName?: string | null } = {},
) {
  sql`insert into audit_logs (entity_type, entity_id, action, summary, user_id, user_name)
      values (${entity}, ${opts.entityId ?? null}, ${action}, ${summary}, ${opts.userId ?? null}, ${opts.userName ?? null})`
    .catch(() => {/* swallow — logging must never break the main flow */});
}
