-- A seller's loan can also be cleared by the customer who buys the bike from us (paid to the financier
-- directly, as part of the price). Counts in the bike's cost like a shop-paid loan, but it's not our cash.
alter table vehicles drop constraint vehicles_loan_paid_by_check;
alter table vehicles add constraint vehicles_loan_paid_by_check check (loan_paid_by in ('', 'owner', 'shop', 'buyer'));
