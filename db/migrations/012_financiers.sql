-- Finance companies the shop works with for bike sales and purchase loans.
-- Fields are all optional — a shop may only record the name, or full EMI details.
create table financiers (
  id              serial primary key,
  name            text not null,
  interest_rate   numeric(5,2),        -- annual % (flat or reducing balance)
  rate_type       text not null default 'reducing' check (rate_type in ('flat', 'reducing')),
  doc_charge      numeric(12,2),       -- flat documentation fee per loan
  processing_fee_pct numeric(5,2),     -- % of loan amount charged as processing fee
  round_to        integer not null default 0,  -- round EMI up to nearest N (e.g. 100 → ₹3,247 → ₹3,300)
  notes           text not null default '',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- When a buyer takes a loan to purchase a bike, record the finance details on the sale invoice.
alter table vehicle_invoices
  add column buyer_finance_id      integer references financiers(id),
  add column buyer_finance_name    text not null default '',   -- free-text or copied from financiers.name
  add column buyer_down_payment    numeric(14,2),              -- cash paid by buyer directly to shop
  add column buyer_tenure_months   integer,                    -- loan tenure in months
  add column buyer_emi_amount      numeric(14,2);              -- agreed monthly EMI (may be estimated)
