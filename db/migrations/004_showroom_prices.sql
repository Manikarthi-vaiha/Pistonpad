-- Showroom prices.
--  showroom_cost: what the shop pays when it buys the part from a showroom / outside market.
--  retail_price:  the "showroom rate" charged to walk-in retail customers (sale_price stays the wholesale rate).
alter table products
  add column showroom_cost numeric(12,2),
  add column retail_price  numeric(12,2);

-- Which rate list a bill used.
alter table invoices
  add column price_type text not null default 'wholesale' check (price_type in ('wholesale', 'showroom'));

-- Where a sold line came from: own stock, or bought from a showroom / outside market for this sale
-- (outside lines don't reduce stock and are costed at what was paid outside).
alter table invoice_items
  add column source text not null default 'stock' check (source in ('stock', 'outside'));

create index invoice_items_outside_idx on invoice_items (invoice_id) where source = 'outside';
