create table if not exists audit_logs (
  id          bigserial primary key,
  entity_type text        not null,  -- vehicle, expense, invoice, product, stock, customer, settings
  entity_id   integer,               -- nullable for global actions (settings, login)
  action      text        not null,  -- create, update, delete, sell, cancel, void, login, etc.
  summary     text        not null,  -- human-readable one-liner
  user_id     integer     references users(id) on delete set null,
  user_name   text,                  -- denormalised so it survives user deletion
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx  on audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx      on audit_logs(entity_type, entity_id);
create index if not exists audit_logs_user_idx        on audit_logs(user_id);
