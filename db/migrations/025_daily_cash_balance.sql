create table if not exists daily_cash_balance (
  id         bigserial primary key,
  balance_date date not null,
  branch_id  int not null references branches(id) on delete cascade,
  opening    numeric(14,2) not null default 0,
  created_by int references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (balance_date, branch_id)
);
