-- Preserve deleted calendar-day evidence while allowing a fresh active record
-- at the same owner/calendar/date natural identity. Old IDs remain tombstoned.
begin;

alter table rakeezx.calendar_days
  drop constraint calendar_days_natural_uniq;

create unique index calendar_days_active_natural_uniq
  on rakeezx.calendar_days (owner_id, calendar_id, date)
  where deleted_at is null;

create or replace function rakeezx.sync_v2_natural_key_reusable_after_delete(p_entity text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_entity in ('sections', 'slots', 'calendar_days');
$$;

commit;
