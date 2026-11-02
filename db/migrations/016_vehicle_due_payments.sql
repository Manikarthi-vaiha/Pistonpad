-- Partial payment (credit sale): buyer pays part now, rest later
alter table vehicle_invoices
  add column if not exists amount_paid_now  numeric(12,2),
  add column if not exists due_amount       numeric(12,2),
  add column if not exists due_date         date,
  add column if not exists due_received_on  date;

-- Follow-up notes per invoice (for pending dues)
create table if not exists vehicle_due_notes (
  id          serial primary key,
  invoice_id  integer not null references vehicle_invoices(id) on delete cascade,
  note        text    not null,
  created_at  timestamptz not null default now(),
  user_id     integer references users(id)
);
create index if not exists vehicle_due_notes_invoice_id_idx on vehicle_due_notes(invoice_id);
