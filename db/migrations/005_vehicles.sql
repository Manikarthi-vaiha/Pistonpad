-- Second-hand bikes the shop buys, refurbishes and sells. Not tied to billing or parts stock.
create table vehicles (
  id                   bigserial primary key,
  reg_no               text not null unique,              -- normalised, e.g. TN76AB1234
  status               text not null default 'in_stock'
                       check (status in ('in_stock', 'reserved', 'in_service', 'sold')),
  brand_id             int references brands(id),
  make                 text not null default '',          -- brand name as shown on the RC
  model                text not null default '',
  variant              text not null default '',
  mfg_year             int check (mfg_year between 1950 and 2100),
  reg_date             date,
  colour               text not null default '',
  fuel                 text not null default 'Petrol',
  engine_cc            int,
  chassis_no           text not null default '',
  engine_no            text not null default '',
  odometer_km          int check (odometer_km >= 0),
  condition            text not null default 'good',
  -- ownership
  owner_count          int not null default 1 check (owner_count between 0 and 20),
  current_owner        text not null default '',
  owner_phone          text not null default '',
  owner_address        text not null default '',
  -- documents
  rc_valid_till        date,
  insurance_company    text not null default '',
  insurance_policy_no  text not null default '',
  insurance_valid_till date,
  puc_valid_till       date,
  hypothecation        text not null default '',          -- financier, when the bike is under loan
  noc_received         boolean not null default false,
  -- money
  purchase_price       numeric(14,2),
  purchase_date        date,
  purchased_from       text not null default '',
  market_price         numeric(14,2),
  our_price            numeric(14,2),
  min_price            numeric(14,2),
  sold_price           numeric(14,2),
  sold_on              date,
  sold_to              text not null default '',
  sold_phone           text not null default '',
  notes                text not null default '',
  created_by           int references users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  search               text generated always as (
    lower(reg_no || ' ' || make || ' ' || model || ' ' || variant || ' ' || current_owner || ' ' || owner_phone || ' ' || chassis_no || ' ' || engine_no || ' ' || sold_to || ' ' || sold_phone)
  ) stored
);
create index vehicles_search_trgm on vehicles using gin (search gin_trgm_ops);
create index vehicles_status_idx on vehicles (status, id desc);

-- Earlier owners, oldest first (owner_no 1 = first owner).
create table vehicle_owners (
  id          bigserial primary key,
  vehicle_id  bigint not null references vehicles(id) on delete cascade,
  owner_no    int not null,
  name        text not null,
  phone       text not null default '',
  from_date   date,
  to_date     date,
  note        text not null default ''
);
create index vehicle_owners_vehicle_idx on vehicle_owners (vehicle_id, owner_no);

-- Traffic challans (e-challan) against the vehicle number.
create table vehicle_fines (
  id           bigserial primary key,
  vehicle_id   bigint not null references vehicles(id) on delete cascade,
  challan_no   text not null default '',
  challan_date date,
  offence      text not null,
  place        text not null default '',
  amount       numeric(12,2) not null check (amount >= 0),
  status       text not null default 'pending' check (status in ('pending', 'paid')),
  paid_on      date,
  created_at   timestamptz not null default now()
);
create index vehicle_fines_vehicle_idx on vehicle_fines (vehicle_id, status);

-- Everything that happened to the bike: bought, serviced, repaired, sold…
create table vehicle_events (
  id           bigserial primary key,
  vehicle_id   bigint not null references vehicles(id) on delete cascade,
  event_date   date not null default current_date,
  kind         text not null,
  title        text not null,
  odometer_km  int,
  cost         numeric(12,2) not null default 0,
  user_id      int references users(id),
  created_at   timestamptz not null default now()
);
create index vehicle_events_vehicle_idx on vehicle_events (vehicle_id, event_date desc, id desc);
