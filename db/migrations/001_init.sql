-- Spares Pro: core schema
-- Designed for millions of products: trigram search, keyset pagination,
-- partial indexes for low stock, and transactional stock movements.

create extension if not exists pg_trgm;
create extension if not exists citext;

-- ---------- Users & settings ----------
create table users (
  id            serial primary key,
  name          text not null,
  username      citext not null unique,
  password_hash text not null,
  role          text not null default 'staff' check (role in ('owner', 'staff')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table settings (
  id             int primary key default 1 check (id = 1),
  shop_name      text not null default 'My Spares Shop',
  address        text not null default '',
  phone          text not null default '',
  email          text not null default '',
  gstin          text not null default '',
  state_code     text not null default '33',   -- GST state code, 33 = Tamil Nadu
  invoice_prefix text not null default 'INV',
  invoice_footer text not null default 'Goods once sold will not be taken back.',
  updated_at     timestamptz not null default now()
);
insert into settings (id) values (1);

-- ---------- Catalogue ----------
create table brands (
  id          serial primary key,
  name        citext not null unique,
  sort_order  int not null default 100,
  is_universal boolean not null default false
);

create table bike_models (
  id        serial primary key,
  brand_id  int not null references brands(id) on delete cascade,
  name      text not null,
  active    boolean not null default true,
  unique (brand_id, name)
);
create index bike_models_brand_idx on bike_models (brand_id, name);

create table categories (
  id    serial primary key,
  name  citext not null unique
);

create table products (
  id            bigserial primary key,
  sku           text not null,                 -- part number
  name          text not null,
  brand_id      int references brands(id),
  category_id   int references categories(id),
  hsn           text not null default '8714',
  unit          text not null default 'pcs',
  cost_price    numeric(12,2) not null default 0,
  sale_price    numeric(12,2) not null default 0,
  mrp           numeric(12,2),
  gst_rate      numeric(5,2) not null default 18,
  stock         integer not null default 0,
  reorder_level integer not null default 0,
  rack          text not null default '',      -- shelf / bin location
  active        boolean not null default true,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  search        text generated always as (lower(sku || ' ' || name)) stored
);
create unique index products_sku_uq       on products (lower(sku));
create index products_sku_prefix_idx      on products (lower(sku) text_pattern_ops);
create index products_search_trgm_idx     on products using gin (search gin_trgm_ops);
create index products_brand_idx           on products (brand_id, id);
create index products_category_idx        on products (category_id, id);
create index products_low_stock_idx       on products (stock, id) where active and stock <= reorder_level;
create index products_demo_idx            on products (id) where is_demo;

-- Which bike models a part fits (many-to-many)
create table product_models (
  model_id   int    not null references bike_models(id) on delete cascade,
  product_id bigint not null references products(id) on delete cascade,
  primary key (model_id, product_id)
);
create index product_models_product_idx on product_models (product_id);

-- ---------- Customers & suppliers ----------
create table customers (
  id          bigserial primary key,
  name        text not null,
  phone       text,
  gstin       text not null default '',
  address     text not null default '',
  state_code  text not null default '',
  credit_limit numeric(12,2) not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index customers_phone_uq on customers (phone) where phone is not null and phone <> '';
create index customers_name_trgm_idx on customers using gin (lower(name) gin_trgm_ops);

create table suppliers (
  id         serial primary key,
  name       text not null unique,
  phone      text not null default '',
  gstin      text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Sales ----------
create table invoice_counters (
  fy        text primary key,   -- e.g. 2026-27
  last_seq  integer not null default 0
);

create table invoices (
  id              bigserial primary key,
  invoice_no      text not null unique,
  fy              text not null,
  seq             integer not null,
  invoice_date    date not null default current_date,
  created_at      timestamptz not null default now(),
  customer_id     bigint references customers(id),
  customer_name   text not null,
  customer_phone  text not null default '',
  customer_gstin  text not null default '',
  is_interstate   boolean not null default false,
  subtotal        numeric(14,2) not null,
  discount        numeric(14,2) not null default 0,
  taxable         numeric(14,2) not null,
  cgst            numeric(14,2) not null default 0,
  sgst            numeric(14,2) not null default 0,
  igst            numeric(14,2) not null default 0,
  round_off       numeric(6,2)  not null default 0,
  total           numeric(14,2) not null,
  cost_total      numeric(14,2) not null default 0,
  amount_paid     numeric(14,2) not null default 0,
  payment_mode    text not null default 'Cash',
  status          text not null default 'paid' check (status in ('paid','partial','due','cancelled')),
  notes           text not null default '',
  is_demo         boolean not null default false,
  user_id         int references users(id),
  unique (fy, seq)
);
create index invoices_date_idx     on invoices (invoice_date desc, id desc);
create index invoices_customer_idx on invoices (customer_id, invoice_date desc);
create index invoices_due_idx      on invoices (invoice_date) where status in ('due','partial');

create table invoice_items (
  id           bigserial primary key,
  invoice_id   bigint not null references invoices(id) on delete cascade,
  product_id   bigint not null references products(id),
  sku          text not null,
  name         text not null,
  hsn          text not null default '',
  brand        text not null default '',
  unit         text not null default 'pcs',
  qty          integer not null check (qty > 0),
  rate         numeric(12,2) not null,
  discount_pct numeric(5,2) not null default 0,
  taxable      numeric(14,2) not null,
  gst_rate     numeric(5,2) not null,
  tax          numeric(14,2) not null,
  total        numeric(14,2) not null,
  cost         numeric(14,2) not null default 0
);
create index invoice_items_invoice_idx on invoice_items (invoice_id);
create index invoice_items_product_idx on invoice_items (product_id);

create table payments (
  id          bigserial primary key,
  invoice_id  bigint references invoices(id) on delete cascade,
  customer_id bigint references customers(id),
  amount      numeric(14,2) not null check (amount > 0),
  mode        text not null default 'Cash',
  paid_on     date not null default current_date,
  note        text not null default '',
  user_id     int references users(id),
  created_at  timestamptz not null default now()
);
create index payments_invoice_idx on payments (invoice_id);

-- ---------- Purchases (stock inward) ----------
create table purchases (
  id           bigserial primary key,
  supplier_id  int references suppliers(id),
  supplier_name text not null default '',
  bill_ref     text not null default '',
  purchase_date date not null default current_date,
  total        numeric(14,2) not null default 0,
  notes        text not null default '',
  user_id      int references users(id),
  created_at   timestamptz not null default now()
);
create index purchases_date_idx on purchases (purchase_date desc, id desc);

create table purchase_items (
  id          bigserial primary key,
  purchase_id bigint not null references purchases(id) on delete cascade,
  product_id  bigint not null references products(id),
  qty         integer not null check (qty > 0),
  cost        numeric(12,2) not null
);
create index purchase_items_purchase_idx on purchase_items (purchase_id);

-- ---------- Stock ledger ----------
create table stock_movements (
  id          bigserial primary key,
  product_id  bigint not null references products(id) on delete cascade,
  change      integer not null,
  balance     integer not null,
  reason      text not null check (reason in ('opening','sale','purchase','adjust','cancel','import')),
  ref_id      bigint,
  note        text not null default '',
  user_id     int references users(id),
  created_at  timestamptz not null default now()
);
create index stock_movements_product_idx on stock_movements (product_id, id desc);
