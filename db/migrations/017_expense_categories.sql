-- Custom expense category names that persist independently of expense records
create table if not exists expense_categories (
  id         serial primary key,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint expense_categories_name_key unique (name)
);
