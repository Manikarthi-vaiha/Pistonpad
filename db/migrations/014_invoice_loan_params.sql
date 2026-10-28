-- Loan parameters entered at checkout time (not from the financier record)
alter table vehicle_invoices
  add column if not exists buyer_interest_rate numeric(6,2),
  add column if not exists buyer_rate_type     text not null default 'reducing',
  add column if not exists buyer_round_to      integer not null default 0;
