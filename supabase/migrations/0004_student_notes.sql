-- ============================================================================
-- RAKEEZ X — الترحيلة ٤: سجل ملاحظات الطلاب المؤرّخ
--
-- إضافة مستقلة قابلة لإعادة التشغيل. الملاحظات حذفها ناعم؛ لا سياسة DELETE.
-- ============================================================================
set lock_timeout = '10s';

begin;
create table if not exists rakeezx.notes (
  id                text not null,
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id        text not null,
  teaching_id       text,
  session_id        text,
  date              date not null,
  kind              text not null default 'general',
  text              text not null check (char_length(text) between 1 and 1200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  client_updated_at bigint,
  device_id         text,
  deleted_at        timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, student_id) references rakeezx.students(owner_id, id) on delete cascade,
  foreign key (owner_id, teaching_id) references rakeezx.teachings(owner_id, id) on delete set null,
  foreign key (owner_id, session_id) references rakeezx.sessions(owner_id, id) on delete set null
);
create index if not exists notes_sync_idx on rakeezx.notes (owner_id, updated_at);
create index if not exists notes_student_date_idx on rakeezx.notes (owner_id, student_id, date desc, created_at desc);
commit;

begin;
drop trigger if exists notes_owner on rakeezx.notes;
drop trigger if exists notes_touch on rakeezx.notes;
create trigger notes_owner before insert on rakeezx.notes
  for each row execute function rakeezx.force_owner();
create trigger notes_touch before insert or update on rakeezx.notes
  for each row execute function rakeezx.touch_updated_at();
commit;

begin;
alter table rakeezx.notes enable row level security;
alter table rakeezx.notes force row level security;
drop policy if exists notes_select on rakeezx.notes;
create policy notes_select on rakeezx.notes for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists notes_insert on rakeezx.notes;
create policy notes_insert on rakeezx.notes for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists notes_update on rakeezx.notes;
create policy notes_update on rakeezx.notes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;