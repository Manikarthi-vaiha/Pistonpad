-- Exchange deal: customer gives their old bike as part-payment for a new one.
-- Columns on the sold bike record what was received; exchange_vehicle_id points
-- to the auto-created inventory record for the received bike.

alter table vehicles
  add column if not exists exchange_reg_no       text not null default '',
  add column if not exists exchange_make         text not null default '',
  add column if not exists exchange_model        text not null default '',
  add column if not exists exchange_year         integer,
  add column if not exists exchange_value        numeric(12,2),
  add column if not exists exchange_vehicle_id   integer references vehicles(id),
  add column if not exists exchange_balance_mode text not null default '';

-- Snapshot the exchange details onto the invoice so it prints correctly even
-- if the exchange bike record is later edited.
alter table vehicle_invoices
  add column if not exists exchange_reg_no       text not null default '',
  add column if not exists exchange_make_model   text not null default '',
  add column if not exists exchange_year         integer,
  add column if not exists exchange_value        numeric(12,2),
  add column if not exists exchange_balance_mode text not null default '';
