-- Two businesses under one roof: spare parts and used bikes. Expenses are tagged to one of them, or
-- 'shared' for costs both use (rent, electricity…). Older expenses all belonged to the parts shop.
alter table expenses
  add column business text not null default 'parts' check (business in ('parts', 'vehicles', 'shared'));
create index expenses_business_idx on expenses (business, expense_date);

-- How the buyer paid for a used bike, so bike sales show up in "Money received".
alter table vehicles add column sold_payment_mode text not null default '';
create index vehicles_sold_on_idx on vehicles (sold_on) where status = 'sold';
