-- Finance charges collected from the buyer and paid to the finance company.
-- Stored separately so the invoice can itemise them.
alter table vehicle_invoices
  add column buyer_doc_charge      numeric(14,2),  -- flat documentation fee from financiers.doc_charge
  add column buyer_processing_fee  numeric(14,2);  -- processing fee = loan × financiers.processing_fee_pct / 100
