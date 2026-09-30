-- Add the distinct non-teaching suspension kind without changing Calendar identity or Sync.
begin;

alter table rakeezx.calendar_days
  drop constraint calendar_days_kind_check;

alter table rakeezx.calendar_days
  add constraint calendar_days_kind_check
  check (kind in ('study', 'holiday', 'national', 'founding', 'exam', 'event', 'remote', 'suspension'));

commit;
