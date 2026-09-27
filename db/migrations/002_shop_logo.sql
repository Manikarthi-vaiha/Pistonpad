-- Shop logo shown on invoices, the sidebar and the sign-in page.
alter table settings
  add column logo       bytea,
  add column logo_type  text,
  add column logo_version int not null default 0;
