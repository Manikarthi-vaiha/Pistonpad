-- Loan (hypothecation) details for used bikes. `hypothecation` stays the financier name; `noc_received`
-- is kept in step with loan_status by the app so older checks keep working.
alter table vehicles
  add column loan_status        text not null default 'none'
                                check (loan_status in ('none', 'active', 'closed', 'noc_received', 'removed')),
  add column loan_branch        text not null default '',
  add column loan_account_no    text not null default '',
  add column loan_amount        numeric(12,2),
  add column loan_emi           numeric(12,2),
  add column loan_tenure_months int check (loan_tenure_months between 1 and 120),
  add column loan_start         date,
  add column loan_end           date,
  add column loan_emis_pending  int check (loan_emis_pending between 0 and 120),
  add column loan_closure_amount numeric(12,2),             -- amount needed to close (foreclose) the loan
  add column loan_paid_by       text not null default ''    -- who pays/paid the closure: owner / shop
                                check (loan_paid_by in ('', 'owner', 'shop')),
  add column loan_closed_on     date,
  add column noc_number         text not null default '',
  add column noc_date           date,
  add column form35_submitted   boolean not null default false,
  add column loan_notes         text not null default '';

update vehicles set loan_status = case
  when hypothecation = '' then 'none'
  when noc_received then 'noc_received'
  else 'active' end;
