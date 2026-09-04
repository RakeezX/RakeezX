-- SET-DATA-01: account-level principal identity for report headers.
-- Additive only; existing profile policies and ownership model remain unchanged.
begin;

alter table rakeezx.profile
  add column if not exists report_principal_name text not null default '';

commit;
