-- Shop running costs (rent, salaries, electricity, freight…), used for net profit.
create table expenses (
  id           bigserial primary key,
  expense_date date not null default current_date,
  category     text not null,
  amount       numeric(14,2) not null check (amount > 0),
  payment_mode text not null default 'Cash',
  paid_to      text not null default '',
  note         text not null default '',
  user_id      int references users(id),
  created_at   timestamptz not null default now()
);
create index expenses_date_idx on expenses (expense_date desc, id desc);
create index expenses_category_idx on expenses (category, expense_date);
