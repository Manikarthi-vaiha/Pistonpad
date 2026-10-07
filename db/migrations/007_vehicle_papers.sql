-- Fuller papers for used bikes: RC, insurance and PUC details, and which documents we physically hold.
alter table vehicles
  add column rc_status       text not null default 'original'
                             check (rc_status in ('original', 'duplicate', 'with_financier', 'missing')),
  add column rc_type         text not null default 'smart_card' check (rc_type in ('smart_card', 'paper')),
  add column rc_owner_name   text not null default '',     -- name exactly as printed on the RC
  add column rto_office      text not null default '',     -- registering authority, e.g. "RTO Tenkasi"
  add column insurance_type  text not null default '',     -- comprehensive / third_party / zero_dep / own_damage
  add column insurance_idv   numeric(12,2),                -- insured declared value
  add column puc_cert_no     text not null default '',
  add column docs_in_hand    text[] not null default '{}'; -- keys from DOC_CHECKLIST in src/lib/regno.ts

-- Budget filter on the asking price.
create index vehicles_our_price_idx on vehicles (our_price) where status <> 'sold';
