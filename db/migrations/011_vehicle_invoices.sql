-- Documents for the used-bike trade, each naming a seller and a buyer:
--   sale     = bike sale invoice, shop → customer        (BS/26-27/0001)
--   purchase = bike purchase receipt, owner → shop       (BP/26-27/0001)
-- Numbers run without gaps per financial year. An issued document is never deleted or edited: it
-- snapshots the bike and the other party, and can only be cancelled (it keeps its number).

create table vehicle_doc_counters (
  series    text not null,              -- BS or BP
  fy        text not null,              -- e.g. 26-27
  last_seq  integer not null default 0,
  primary key (series, fy)
);

create table vehicle_invoices (
  id              bigserial primary key,
  vehicle_id      bigint not null references vehicles(id) on delete restrict,
  kind            text not null check (kind in ('sale', 'purchase')),
  doc_no          text not null unique,
  fy              text not null,
  seq             integer not null,
  doc_date        date not null,
  handover_at     timestamptz not null,  -- date and time the bike changed hands (responsibility passes here)
  -- the other party: buyer on a sale, seller (previous owner) on a purchase
  party_name      text not null,
  party_phone     text not null default '',
  party_address   text not null default '',
  party_id_proof  text not null default '',
  -- money
  price           numeric(14,2) not null,            -- full deal value
  paid_amount     numeric(14,2) not null,            -- money between the shop and the party
  loan_amount     numeric(14,2) not null default 0,  -- seller's loan settled as part of the deal
  loan_payer      text not null default '',          -- owner / shop / buyer
  loan_financier  text not null default '',
  payment_mode    text not null default '',
  odometer_km     integer,
  bike            jsonb not null,                    -- snapshot of the bike's identity when issued
  papers          text[] not null default '{}',      -- keys from DOC_CHECKLIST handed over / received
  notes           text not null default '',
  status          text not null default 'issued' check (status in ('issued', 'cancelled')),
  cancel_reason   text not null default '',
  user_id         integer references users(id),
  created_at      timestamptz not null default now()
);
create index vehicle_invoices_vehicle_idx on vehicle_invoices (vehicle_id, kind, id desc);
create index vehicle_invoices_date_idx on vehicle_invoices (doc_date desc, id desc);

-- Buyer details collected when a bike is sold, shown on the sale invoice.
alter table vehicles
  add column sold_address  text not null default '',
  add column sold_id_proof text not null default '',
  add column owner_id_proof text not null default '';
