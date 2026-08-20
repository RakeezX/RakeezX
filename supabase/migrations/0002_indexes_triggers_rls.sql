-- ============================================================================
-- MADAR Z — الترحيلة ٢: الفهارس، وأختام الخادم، وسياسات الوصول
--
-- بُنيت هذه النسخة بعد فشل النسخة الأولى بـ deadlock (40P01) أثناء إنشاء
-- السياسات. السبب البنيوي: معاملة واحدة طويلة تمسك ACCESS EXCLUSIVE على
-- تسعة عشر جدولًا دفعة واحدة، فتتصادم مع أي جلسة أخرى تلمسها بترتيب مختلف.
--
-- ثلاثة مبادئ في هذا الملف:
--   ١. **أقصر عمر ممكن للقفل** — كل مجموعة أقفال في معاملتها، والسياسات
--      جدولًا جدولًا: قفل واحد يُؤخذ ويُطلق قبل أخذ الذي يليه.
--   ٢. **ترتيب حتمي ثابت** — أبجدي، بلا حلقات ولا SQL ديناميكي.
--   ٣. **قابل لإعادة التشغيل** — كل عبارة إما `if not exists` أو
--      `drop … if exists` قبلها، فإعادة التنفيذ بعد فشل جزئي آمنة.
--
-- اتجاه فشل آمن: RLS تُفعَّل **قبل** إنشاء السياسات. فإن انقطع التنفيذ بينهما
-- بقي الجدول مغلقًا على الجميع — لا مفتوحًا.
--
-- شغّل هذا الملف والقاعدة ساكنة: أغلق تبويبات Table Editor، ولا تشغّل شيئًا
-- آخر بالتوازي.
-- ============================================================================

-- انتظار قفل أطول من هذا يفشل برسالة واضحة بدل أن يتحوّل إلى جمود غامض.
set lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- المرحلة ١ — الفهارس   (قفل SHARE — الأخف)
--
-- فهرس المزامنة (owner_id, updated_at) هو الأهم في المخطط كله: كل سحب تفاضلي
-- يسأل «ما الذي تغيّر بعد هذه اللحظة؟» ويمر منه.
-- ---------------------------------------------------------------------------

begin;

create index if not exists years_sync_idx          on madarz.years          (owner_id, updated_at);
create index if not exists terms_sync_idx          on madarz.terms          (owner_id, updated_at);
create index if not exists subjects_sync_idx       on madarz.subjects       (owner_id, updated_at);
create index if not exists sections_sync_idx       on madarz.sections       (owner_id, updated_at);
create index if not exists teachings_sync_idx      on madarz.teachings      (owner_id, updated_at);
create index if not exists students_sync_idx       on madarz.students       (owner_id, updated_at);
create index if not exists enrollments_sync_idx    on madarz.enrollments    (owner_id, updated_at);
create index if not exists units_sync_idx          on madarz.units          (owner_id, updated_at);
create index if not exists lessons_sync_idx        on madarz.lessons        (owner_id, updated_at);
create index if not exists items_sync_idx          on madarz.items          (owner_id, updated_at);
create index if not exists scores_sync_idx         on madarz.scores         (owner_id, updated_at);
create index if not exists time_profiles_sync_idx  on madarz.time_profiles  (owner_id, updated_at);
create index if not exists slots_sync_idx          on madarz.slots          (owner_id, updated_at);
create index if not exists sessions_sync_idx       on madarz.sessions       (owner_id, updated_at);
create index if not exists attendance_sync_idx     on madarz.attendance     (owner_id, updated_at);
create index if not exists logs_sync_idx           on madarz.logs           (owner_id, updated_at);
create index if not exists calendars_sync_idx      on madarz.calendars      (owner_id, updated_at);
create index if not exists calendar_days_sync_idx  on madarz.calendar_days  (owner_id, updated_at);

-- فهارس العلاقات كثيرة القراءة
create index if not exists terms_year_idx          on madarz.terms       (owner_id, year_id);
create index if not exists sections_year_idx       on madarz.sections    (owner_id, year_id);
create index if not exists teachings_term_idx      on madarz.teachings   (owner_id, term_id);
create index if not exists teachings_section_idx   on madarz.teachings   (owner_id, section_id);
create index if not exists enrollments_section_idx on madarz.enrollments (owner_id, section_id);
create index if not exists enrollments_student_idx on madarz.enrollments (owner_id, student_id);
create index if not exists items_teaching_idx      on madarz.items       (owner_id, teaching_id);
create index if not exists scores_student_idx      on madarz.scores      (owner_id, student_id);
create index if not exists units_curriculum_idx    on madarz.units       (owner_id, subject_id, grade, term_index);
create index if not exists lessons_unit_idx        on madarz.lessons     (owner_id, unit_id);
create index if not exists slots_teaching_idx      on madarz.slots       (owner_id, teaching_id);

-- «حصص هذا الفصل» و«حصص اليوم» — أكثر استعلامين في التطبيق
create index if not exists sessions_teaching_date_idx on madarz.sessions (owner_id, teaching_id, date);
create index if not exists sessions_date_idx          on madarz.sessions (owner_id, date);

-- الحضور يُقرأ بالحصة (شاشة الرصد) وبالطالب (تقريره) وبالمدى (كشف الحضور)
create index if not exists attendance_session_idx  on madarz.attendance (owner_id, session_id);
create index if not exists attendance_student_idx  on madarz.attendance (owner_id, student_id);
create index if not exists attendance_range_idx    on madarz.attendance (owner_id, teaching_id, date);

create index if not exists logs_teaching_date_idx  on madarz.logs (owner_id, teaching_id, date);
create index if not exists logs_student_idx        on madarz.logs (owner_id, student_id);

create index if not exists calendar_days_date_idx  on madarz.calendar_days (owner_id, date);

commit;

-- ---------------------------------------------------------------------------
-- المرحلة ٢ — أختام الخادم   (قفل SHARE ROW EXCLUSIVE)
--
-- updated_at و owner_id يُفرضان من الخادم على كل كتابة، فلا يستطيع عميل —
-- ولا خطأ برمجي فيه — أن يزوّر ترتيب التعديلات أو ملكية الصف.
--
-- المحفّزات تُنفَّذ بترتيب أبجدي: `_owner` قبل `_touch`، فتُضبط الملكية ثم
-- يُختم الوقت.
-- ---------------------------------------------------------------------------

begin;

drop trigger if exists attendance_owner    on madarz.attendance;
drop trigger if exists attendance_touch    on madarz.attendance;
create trigger attendance_owner before insert on madarz.attendance
  for each row execute function madarz.force_owner();
create trigger attendance_touch before insert or update on madarz.attendance
  for each row execute function madarz.touch_updated_at();

drop trigger if exists calendar_days_owner on madarz.calendar_days;
drop trigger if exists calendar_days_touch on madarz.calendar_days;
create trigger calendar_days_owner before insert on madarz.calendar_days
  for each row execute function madarz.force_owner();
create trigger calendar_days_touch before insert or update on madarz.calendar_days
  for each row execute function madarz.touch_updated_at();

drop trigger if exists calendars_owner     on madarz.calendars;
drop trigger if exists calendars_touch     on madarz.calendars;
create trigger calendars_owner before insert on madarz.calendars
  for each row execute function madarz.force_owner();
create trigger calendars_touch before insert or update on madarz.calendars
  for each row execute function madarz.touch_updated_at();

drop trigger if exists enrollments_owner   on madarz.enrollments;
drop trigger if exists enrollments_touch   on madarz.enrollments;
create trigger enrollments_owner before insert on madarz.enrollments
  for each row execute function madarz.force_owner();
create trigger enrollments_touch before insert or update on madarz.enrollments
  for each row execute function madarz.touch_updated_at();

drop trigger if exists items_owner         on madarz.items;
drop trigger if exists items_touch         on madarz.items;
create trigger items_owner before insert on madarz.items
  for each row execute function madarz.force_owner();
create trigger items_touch before insert or update on madarz.items
  for each row execute function madarz.touch_updated_at();

drop trigger if exists lessons_owner       on madarz.lessons;
drop trigger if exists lessons_touch       on madarz.lessons;
create trigger lessons_owner before insert on madarz.lessons
  for each row execute function madarz.force_owner();
create trigger lessons_touch before insert or update on madarz.lessons
  for each row execute function madarz.touch_updated_at();

drop trigger if exists logs_owner          on madarz.logs;
drop trigger if exists logs_touch          on madarz.logs;
create trigger logs_owner before insert on madarz.logs
  for each row execute function madarz.force_owner();
create trigger logs_touch before insert or update on madarz.logs
  for each row execute function madarz.touch_updated_at();

drop trigger if exists profile_owner       on madarz.profile;
drop trigger if exists profile_touch       on madarz.profile;
create trigger profile_owner before insert on madarz.profile
  for each row execute function madarz.force_owner();
create trigger profile_touch before insert or update on madarz.profile
  for each row execute function madarz.touch_updated_at();

drop trigger if exists scores_owner        on madarz.scores;
drop trigger if exists scores_touch        on madarz.scores;
create trigger scores_owner before insert on madarz.scores
  for each row execute function madarz.force_owner();
create trigger scores_touch before insert or update on madarz.scores
  for each row execute function madarz.touch_updated_at();

drop trigger if exists sections_owner      on madarz.sections;
drop trigger if exists sections_touch      on madarz.sections;
create trigger sections_owner before insert on madarz.sections
  for each row execute function madarz.force_owner();
create trigger sections_touch before insert or update on madarz.sections
  for each row execute function madarz.touch_updated_at();

drop trigger if exists sessions_owner      on madarz.sessions;
drop trigger if exists sessions_touch      on madarz.sessions;
create trigger sessions_owner before insert on madarz.sessions
  for each row execute function madarz.force_owner();
create trigger sessions_touch before insert or update on madarz.sessions
  for each row execute function madarz.touch_updated_at();

drop trigger if exists slots_owner         on madarz.slots;
drop trigger if exists slots_touch         on madarz.slots;
create trigger slots_owner before insert on madarz.slots
  for each row execute function madarz.force_owner();
create trigger slots_touch before insert or update on madarz.slots
  for each row execute function madarz.touch_updated_at();

drop trigger if exists students_owner      on madarz.students;
drop trigger if exists students_touch      on madarz.students;
create trigger students_owner before insert on madarz.students
  for each row execute function madarz.force_owner();
create trigger students_touch before insert or update on madarz.students
  for each row execute function madarz.touch_updated_at();

drop trigger if exists subjects_owner      on madarz.subjects;
drop trigger if exists subjects_touch      on madarz.subjects;
create trigger subjects_owner before insert on madarz.subjects
  for each row execute function madarz.force_owner();
create trigger subjects_touch before insert or update on madarz.subjects
  for each row execute function madarz.touch_updated_at();

drop trigger if exists teachings_owner     on madarz.teachings;
drop trigger if exists teachings_touch     on madarz.teachings;
create trigger teachings_owner before insert on madarz.teachings
  for each row execute function madarz.force_owner();
create trigger teachings_touch before insert or update on madarz.teachings
  for each row execute function madarz.touch_updated_at();

drop trigger if exists terms_owner         on madarz.terms;
drop trigger if exists terms_touch         on madarz.terms;
create trigger terms_owner before insert on madarz.terms
  for each row execute function madarz.force_owner();
create trigger terms_touch before insert or update on madarz.terms
  for each row execute function madarz.touch_updated_at();

drop trigger if exists time_profiles_owner on madarz.time_profiles;
drop trigger if exists time_profiles_touch on madarz.time_profiles;
create trigger time_profiles_owner before insert on madarz.time_profiles
  for each row execute function madarz.force_owner();
create trigger time_profiles_touch before insert or update on madarz.time_profiles
  for each row execute function madarz.touch_updated_at();

drop trigger if exists units_owner         on madarz.units;
drop trigger if exists units_touch         on madarz.units;
create trigger units_owner before insert on madarz.units
  for each row execute function madarz.force_owner();
create trigger units_touch before insert or update on madarz.units
  for each row execute function madarz.touch_updated_at();

drop trigger if exists years_owner         on madarz.years;
drop trigger if exists years_touch         on madarz.years;
create trigger years_owner before insert on madarz.years
  for each row execute function madarz.force_owner();
create trigger years_touch before insert or update on madarz.years
  for each row execute function madarz.touch_updated_at();

commit;

-- ---------------------------------------------------------------------------
-- المرحلة ٣ — RLS والسياسات   (قفل ACCESS EXCLUSIVE — الأثقل)
--
-- **معاملة لكل جدول.** هذا هو الإصلاح الجوهري للـ deadlock: القفل يُؤخذ على
-- جدول واحد ويُطلق فور `commit` قبل أخذ الذي يليه، بدل تسعة عشر قفلًا
-- محتجزة معًا. وترتيب الجداول أبجدي ثابت، بلا حلقة ولا SQL ديناميكي.
--
-- القاعدة واحدة في كل جدول: المستخدم يرى ويكتب صفوفه وحدها.
--   • `to authenticated`  تمنع الوصول المجهول تمامًا
--   • `with check`        تمنع كتابة صف باسم مالك آخر — لا القراءة فقط
--   • `(select auth.uid())` يُقيَّم مرة لكل استعلام لا مرة لكل صف
--   • لا سياسة DELETE     الحذف في MADAR Z ناعم، والصلاحية مسحوبة في المرحلة ٤
-- ---------------------------------------------------------------------------

begin;
alter table madarz.attendance enable row level security;
alter table madarz.attendance force  row level security;
drop policy if exists attendance_select on madarz.attendance;
create policy attendance_select on madarz.attendance for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists attendance_insert on madarz.attendance;
create policy attendance_insert on madarz.attendance for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists attendance_update on madarz.attendance;
create policy attendance_update on madarz.attendance for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.calendar_days enable row level security;
alter table madarz.calendar_days force  row level security;
drop policy if exists calendar_days_select on madarz.calendar_days;
create policy calendar_days_select on madarz.calendar_days for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists calendar_days_insert on madarz.calendar_days;
create policy calendar_days_insert on madarz.calendar_days for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists calendar_days_update on madarz.calendar_days;
create policy calendar_days_update on madarz.calendar_days for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.calendars enable row level security;
alter table madarz.calendars force  row level security;
drop policy if exists calendars_select on madarz.calendars;
create policy calendars_select on madarz.calendars for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists calendars_insert on madarz.calendars;
create policy calendars_insert on madarz.calendars for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists calendars_update on madarz.calendars;
create policy calendars_update on madarz.calendars for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.enrollments enable row level security;
alter table madarz.enrollments force  row level security;
drop policy if exists enrollments_select on madarz.enrollments;
create policy enrollments_select on madarz.enrollments for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists enrollments_insert on madarz.enrollments;
create policy enrollments_insert on madarz.enrollments for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists enrollments_update on madarz.enrollments;
create policy enrollments_update on madarz.enrollments for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.items enable row level security;
alter table madarz.items force  row level security;
drop policy if exists items_select on madarz.items;
create policy items_select on madarz.items for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists items_insert on madarz.items;
create policy items_insert on madarz.items for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists items_update on madarz.items;
create policy items_update on madarz.items for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.lessons enable row level security;
alter table madarz.lessons force  row level security;
drop policy if exists lessons_select on madarz.lessons;
create policy lessons_select on madarz.lessons for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists lessons_insert on madarz.lessons;
create policy lessons_insert on madarz.lessons for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists lessons_update on madarz.lessons;
create policy lessons_update on madarz.lessons for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.logs enable row level security;
alter table madarz.logs force  row level security;
drop policy if exists logs_select on madarz.logs;
create policy logs_select on madarz.logs for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists logs_insert on madarz.logs;
create policy logs_insert on madarz.logs for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists logs_update on madarz.logs;
create policy logs_update on madarz.logs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.profile enable row level security;
alter table madarz.profile force  row level security;
drop policy if exists profile_select on madarz.profile;
create policy profile_select on madarz.profile for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists profile_insert on madarz.profile;
create policy profile_insert on madarz.profile for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists profile_update on madarz.profile;
create policy profile_update on madarz.profile for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.scores enable row level security;
alter table madarz.scores force  row level security;
drop policy if exists scores_select on madarz.scores;
create policy scores_select on madarz.scores for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists scores_insert on madarz.scores;
create policy scores_insert on madarz.scores for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists scores_update on madarz.scores;
create policy scores_update on madarz.scores for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.sections enable row level security;
alter table madarz.sections force  row level security;
drop policy if exists sections_select on madarz.sections;
create policy sections_select on madarz.sections for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sections_insert on madarz.sections;
create policy sections_insert on madarz.sections for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists sections_update on madarz.sections;
create policy sections_update on madarz.sections for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.sessions enable row level security;
alter table madarz.sessions force  row level security;
drop policy if exists sessions_select on madarz.sessions;
create policy sessions_select on madarz.sessions for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sessions_insert on madarz.sessions;
create policy sessions_insert on madarz.sessions for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists sessions_update on madarz.sessions;
create policy sessions_update on madarz.sessions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.slots enable row level security;
alter table madarz.slots force  row level security;
drop policy if exists slots_select on madarz.slots;
create policy slots_select on madarz.slots for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists slots_insert on madarz.slots;
create policy slots_insert on madarz.slots for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists slots_update on madarz.slots;
create policy slots_update on madarz.slots for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.students enable row level security;
alter table madarz.students force  row level security;
drop policy if exists students_select on madarz.students;
create policy students_select on madarz.students for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists students_insert on madarz.students;
create policy students_insert on madarz.students for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists students_update on madarz.students;
create policy students_update on madarz.students for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.subjects enable row level security;
alter table madarz.subjects force  row level security;
drop policy if exists subjects_select on madarz.subjects;
create policy subjects_select on madarz.subjects for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists subjects_insert on madarz.subjects;
create policy subjects_insert on madarz.subjects for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists subjects_update on madarz.subjects;
create policy subjects_update on madarz.subjects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.teachings enable row level security;
alter table madarz.teachings force  row level security;
drop policy if exists teachings_select on madarz.teachings;
create policy teachings_select on madarz.teachings for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists teachings_insert on madarz.teachings;
create policy teachings_insert on madarz.teachings for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists teachings_update on madarz.teachings;
create policy teachings_update on madarz.teachings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.terms enable row level security;
alter table madarz.terms force  row level security;
drop policy if exists terms_select on madarz.terms;
create policy terms_select on madarz.terms for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists terms_insert on madarz.terms;
create policy terms_insert on madarz.terms for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists terms_update on madarz.terms;
create policy terms_update on madarz.terms for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.time_profiles enable row level security;
alter table madarz.time_profiles force  row level security;
drop policy if exists time_profiles_select on madarz.time_profiles;
create policy time_profiles_select on madarz.time_profiles for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists time_profiles_insert on madarz.time_profiles;
create policy time_profiles_insert on madarz.time_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists time_profiles_update on madarz.time_profiles;
create policy time_profiles_update on madarz.time_profiles for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.units enable row level security;
alter table madarz.units force  row level security;
drop policy if exists units_select on madarz.units;
create policy units_select on madarz.units for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists units_insert on madarz.units;
create policy units_insert on madarz.units for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists units_update on madarz.units;
create policy units_update on madarz.units for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table madarz.years enable row level security;
alter table madarz.years force  row level security;
drop policy if exists years_select on madarz.years;
create policy years_select on madarz.years for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists years_insert on madarz.years;
create policy years_insert on madarz.years for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists years_update on madarz.years;
create policy years_update on madarz.years for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

-- ---------------------------------------------------------------------------
-- المرحلة ٤ — الصلاحيات
--
-- الأدوار العامة لا تملك شيئًا افتراضيًا، والحذف الصلب ممنوع على الجميع:
-- الحذف في MADAR Z ناعم (deleted_at) لأن الحذف الصلب لا يمكن مزامنته —
-- الجهاز الآخر لا يفرّق بين «حُذف» و«لم يصل بعد».
-- ---------------------------------------------------------------------------

begin;

revoke all on all tables in schema madarz from anon;
revoke all on schema madarz from anon;

grant usage on schema madarz to authenticated;
grant select, insert, update on all tables in schema madarz to authenticated;
revoke delete on all tables in schema madarz from authenticated, anon;

alter default privileges in schema madarz
  grant select, insert, update on tables to authenticated;

commit;

reset lock_timeout;
