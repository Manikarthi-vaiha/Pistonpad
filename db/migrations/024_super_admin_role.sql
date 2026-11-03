-- Add super_admin role: can permanently (hard) delete invoices and vehicle receipts.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('owner', 'staff', 'super_admin'));
