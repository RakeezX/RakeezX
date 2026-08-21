-- ============================================================================
-- RAKEEZ X — الترحيلة ٢: الفهارس، وأختام الخادم، وسياسات الوصول
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

create index if not exists years_sync_idx          on rakeezx.years          (owner_id, updated_at);
create index if not exists terms_sync_idx          on rakeezx.terms          (owner_id, updated_at);
create index if not exists subjects_sync_idx       on rakeezx.subjects       (owner_id, updated_at);
create index if not exists sections_sync_idx       on rakeezx.sections       (owner_id, updated_at);
create index if not exists teachings_sync_idx      on rakeezx.teachings      (owner_id, updated_at);
create index if not exists students_sync_idx       on rakeezx.students       (owner_id, updated_at);
create index if not exists enrollments_sync_idx    on rakeezx.enrollments    (owner_id, updated_at);
create index if not exists units_sync_idx          on rakeezx.units          (owner_id, updated_at);
create index if not exists lessons_sync_idx        on rakeezx.lessons        (owner_id, updated_at);
create index if not exists items_sync_idx          on rakeezx.items          (owner_id, updated_at);
create index if not exists scores_sync_idx         on rakeezx.scores         (owner_id, updated_at);
create index if not exists time_profiles_sync_idx  on rakeezx.time_profiles  (owner_id, updated_at);
create index if not exists slots_sync_idx          on rakeezx.slots          (owner_id, updated_at);
create index if not exists sessions_sync_idx       on rakeezx.sessions       (owner_id, updated_at);
create index if not exists attendance_sync_idx     on rakeezx.attendance     (owner_id, updated_at);
create index if not exists logs_sync_idx           on rakeezx.logs           (owner_id, updated_at);
create index if not exists calendars_sync_idx      on rakeezx.calendars      (owner_id, updated_at);
create index if not exists calendar_days_sync_idx  on rakeezx.calendar_days  (owner_id, updated_at);

-- فهارس العلاقات كثيرة القراءة
create index if not exists terms_year_idx          on rakeezx.terms       (owner_id, year_id);
create index if not exists sections_year_idx       on rakeezx.sections    (owner_id, year_id);
create index if not exists teachings_term_idx      on rakeezx.teachings   (owner_id, term_id);
create index if not exists teachings_section_idx   on rakeezx.teachings   (owner_id, section_id);
create index if not exists enrollments_section_idx on rakeezx.enrollments (owner_id, section_id);
create index if not exists enrollments_student_idx on rakeezx.enrollments (owner_id, student_id);
create index if not exists items_teaching_idx      on rakeezx.items       (owner_id, teaching_id);
create index if not exists scores_student_idx      on rakeezx.scores      (owner_id, student_id);
create index if not exists units_curriculum_idx    on rakeezx.units       (owner_id, subject_id, grade, term_index);
create index if not exists lessons_unit_idx        on rakeezx.lessons     (owner_id, unit_id);
create index if not exists slots_teaching_idx      on rakeezx.slots       (owner_id, teaching_id);

-- «حصص هذا الفصل» و«حصص اليوم» — أكثر استعلامين في التطبيق
create index if not exists sessions_teaching_date_idx on rakeezx.sessions (owner_id, teaching_id, date);
create index if not exists sessions_date_idx          on rakeezx.sessions (owner_id, date);

-- الحضور يُقرأ بالحصة (شاشة الرصد) وبالطالب (تقريره) وبالمدى (كشف الحضور)
create index if not exists attendance_session_idx  on rakeezx.attendance (owner_id, session_id);
create index if not exists attendance_student_idx  on rakeezx.attendance (owner_id, student_id);
create index if not exists attendance_range_idx    on rakeezx.attendance (owner_id, teaching_id, date);

create index if not exists logs_teaching_date_idx  on rakeezx.logs (owner_id, teaching_id, date);
create index if not exists logs_student_idx        on rakeezx.logs (owner_id, student_id);

create index if not exists calendar_days_date_idx  on rakeezx.calendar_days (owner_id, date);

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

drop trigger if exists attendance_owner    on rakeezx.attendance;
drop trigger if exists attendance_touch    on rakeezx.attendance;
create trigger attendance_owner before insert on rakeezx.attendance
  for each row execute function rakeezx.force_owner();
create trigger attendance_touch before insert or update on rakeezx.attendance
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists calendar_days_owner on rakeezx.calendar_days;
drop trigger if exists calendar_days_touch on rakeezx.calendar_days;
create trigger calendar_days_owner before insert on rakeezx.calendar_days
  for each row execute function rakeezx.force_owner();
create trigger calendar_days_touch before insert or update on rakeezx.calendar_days
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists calendars_owner     on rakeezx.calendars;
drop trigger if exists calendars_touch     on rakeezx.calendars;
create trigger calendars_owner before insert on rakeezx.calendars
  for each row execute function rakeezx.force_owner();
create trigger calendars_touch before insert or update on rakeezx.calendars
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists enrollments_owner   on rakeezx.enrollments;
drop trigger if exists enrollments_touch   on rakeezx.enrollments;
create trigger enrollments_owner before insert on rakeezx.enrollments
  for each row execute function rakeezx.force_owner();
create trigger enrollments_touch before insert or update on rakeezx.enrollments
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists items_owner         on rakeezx.items;
drop trigger if exists items_touch         on rakeezx.items;
create trigger items_owner before insert on rakeezx.items
  for each row execute function rakeezx.force_owner();
create trigger items_touch before insert or update on rakeezx.items
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists lessons_owner       on rakeezx.lessons;
drop trigger if exists lessons_touch       on rakeezx.lessons;
create trigger lessons_owner before insert on rakeezx.lessons
  for each row execute function rakeezx.force_owner();
create trigger lessons_touch before insert or update on rakeezx.lessons
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists logs_owner          on rakeezx.logs;
drop trigger if exists logs_touch          on rakeezx.logs;
create trigger logs_owner before insert on rakeezx.logs
  for each row execute function rakeezx.force_owner();
create trigger logs_touch before insert or update on rakeezx.logs
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists profile_owner       on rakeezx.profile;
drop trigger if exists profile_touch       on rakeezx.profile;
create trigger profile_owner before insert on rakeezx.profile
  for each row execute function rakeezx.force_owner();
create trigger profile_touch before insert or update on rakeezx.profile
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists scores_owner        on rakeezx.scores;
drop trigger if exists scores_touch        on rakeezx.scores;
create trigger scores_owner before insert on rakeezx.scores
  for each row execute function rakeezx.force_owner();
create trigger scores_touch before insert or update on rakeezx.scores
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists sections_owner      on rakeezx.sections;
drop trigger if exists sections_touch      on rakeezx.sections;
create trigger sections_owner before insert on rakeezx.sections
  for each row execute function rakeezx.force_owner();
create trigger sections_touch before insert or update on rakeezx.sections
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists sessions_owner      on rakeezx.sessions;
drop trigger if exists sessions_touch      on rakeezx.sessions;
create trigger sessions_owner before insert on rakeezx.sessions
  for each row execute function rakeezx.force_owner();
create trigger sessions_touch before insert or update on rakeezx.sessions
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists slots_owner         on rakeezx.slots;
drop trigger if exists slots_touch         on rakeezx.slots;
create trigger slots_owner before insert on rakeezx.slots
  for each row execute function rakeezx.force_owner();
create trigger slots_touch before insert or update on rakeezx.slots
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists students_owner      on rakeezx.students;
drop trigger if exists students_touch      on rakeezx.students;
create trigger students_owner before insert on rakeezx.students
  for each row execute function rakeezx.force_owner();
create trigger students_touch before insert or update on rakeezx.students
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists subjects_owner      on rakeezx.subjects;
drop trigger if exists subjects_touch      on rakeezx.subjects;
create trigger subjects_owner before insert on rakeezx.subjects
  for each row execute function rakeezx.force_owner();
create trigger subjects_touch before insert or update on rakeezx.subjects
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists teachings_owner     on rakeezx.teachings;
drop trigger if exists teachings_touch     on rakeezx.teachings;
create trigger teachings_owner before insert on rakeezx.teachings
  for each row execute function rakeezx.force_owner();
create trigger teachings_touch before insert or update on rakeezx.teachings
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists terms_owner         on rakeezx.terms;
drop trigger if exists terms_touch         on rakeezx.terms;
create trigger terms_owner before insert on rakeezx.terms
  for each row execute function rakeezx.force_owner();
create trigger terms_touch before insert or update on rakeezx.terms
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists time_profiles_owner on rakeezx.time_profiles;
drop trigger if exists time_profiles_touch on rakeezx.time_profiles;
create trigger time_profiles_owner before insert on rakeezx.time_profiles
  for each row execute function rakeezx.force_owner();
create trigger time_profiles_touch before insert or update on rakeezx.time_profiles
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists units_owner         on rakeezx.units;
drop trigger if exists units_touch         on rakeezx.units;
create trigger units_owner before insert on rakeezx.units
  for each row execute function rakeezx.force_owner();
create trigger units_touch before insert or update on rakeezx.units
  for each row execute function rakeezx.touch_updated_at();

drop trigger if exists years_owner         on rakeezx.years;
drop trigger if exists years_touch         on rakeezx.years;
create trigger years_owner before insert on rakeezx.years
  for each row execute function rakeezx.force_owner();
create trigger years_touch before insert or update on rakeezx.years
  for each row execute function rakeezx.touch_updated_at();

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
--   • لا سياسة DELETE     الحذف في RAKEEZ X ناعم، والصلاحية مسحوبة في المرحلة ٤
-- ---------------------------------------------------------------------------

begin;
alter table rakeezx.attendance enable row level security;
alter table rakeezx.attendance force  row level security;
drop policy if exists attendance_select on rakeezx.attendance;
create policy attendance_select on rakeezx.attendance for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists attendance_insert on rakeezx.attendance;
create policy attendance_insert on rakeezx.attendance for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists attendance_update on rakeezx.attendance;
create policy attendance_update on rakeezx.attendance for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.calendar_days enable row level security;
alter table rakeezx.calendar_days force  row level security;
drop policy if exists calendar_days_select on rakeezx.calendar_days;
create policy calendar_days_select on rakeezx.calendar_days for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists calendar_days_insert on rakeezx.calendar_days;
create policy calendar_days_insert on rakeezx.calendar_days for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists calendar_days_update on rakeezx.calendar_days;
create policy calendar_days_update on rakeezx.calendar_days for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.calendars enable row level security;
alter table rakeezx.calendars force  row level security;
drop policy if exists calendars_select on rakeezx.calendars;
create policy calendars_select on rakeezx.calendars for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists calendars_insert on rakeezx.calendars;
create policy calendars_insert on rakeezx.calendars for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists calendars_update on rakeezx.calendars;
create policy calendars_update on rakeezx.calendars for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.enrollments enable row level security;
alter table rakeezx.enrollments force  row level security;
drop policy if exists enrollments_select on rakeezx.enrollments;
create policy enrollments_select on rakeezx.enrollments for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists enrollments_insert on rakeezx.enrollments;
create policy enrollments_insert on rakeezx.enrollments for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists enrollments_update on rakeezx.enrollments;
create policy enrollments_update on rakeezx.enrollments for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.items enable row level security;
alter table rakeezx.items force  row level security;
drop policy if exists items_select on rakeezx.items;
create policy items_select on rakeezx.items for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists items_insert on rakeezx.items;
create policy items_insert on rakeezx.items for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists items_update on rakeezx.items;
create policy items_update on rakeezx.items for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.lessons enable row level security;
alter table rakeezx.lessons force  row level security;
drop policy if exists lessons_select on rakeezx.lessons;
create policy lessons_select on rakeezx.lessons for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists lessons_insert on rakeezx.lessons;
create policy lessons_insert on rakeezx.lessons for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists lessons_update on rakeezx.lessons;
create policy lessons_update on rakeezx.lessons for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.logs enable row level security;
alter table rakeezx.logs force  row level security;
drop policy if exists logs_select on rakeezx.logs;
create policy logs_select on rakeezx.logs for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists logs_insert on rakeezx.logs;
create policy logs_insert on rakeezx.logs for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists logs_update on rakeezx.logs;
create policy logs_update on rakeezx.logs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.profile enable row level security;
alter table rakeezx.profile force  row level security;
drop policy if exists profile_select on rakeezx.profile;
create policy profile_select on rakeezx.profile for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists profile_insert on rakeezx.profile;
create policy profile_insert on rakeezx.profile for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists profile_update on rakeezx.profile;
create policy profile_update on rakeezx.profile for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.scores enable row level security;
alter table rakeezx.scores force  row level security;
drop policy if exists scores_select on rakeezx.scores;
create policy scores_select on rakeezx.scores for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists scores_insert on rakeezx.scores;
create policy scores_insert on rakeezx.scores for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists scores_update on rakeezx.scores;
create policy scores_update on rakeezx.scores for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.sections enable row level security;
alter table rakeezx.sections force  row level security;
drop policy if exists sections_select on rakeezx.sections;
create policy sections_select on rakeezx.sections for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sections_insert on rakeezx.sections;
create policy sections_insert on rakeezx.sections for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists sections_update on rakeezx.sections;
create policy sections_update on rakeezx.sections for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.sessions enable row level security;
alter table rakeezx.sessions force  row level security;
drop policy if exists sessions_select on rakeezx.sessions;
create policy sessions_select on rakeezx.sessions for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists sessions_insert on rakeezx.sessions;
create policy sessions_insert on rakeezx.sessions for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists sessions_update on rakeezx.sessions;
create policy sessions_update on rakeezx.sessions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.slots enable row level security;
alter table rakeezx.slots force  row level security;
drop policy if exists slots_select on rakeezx.slots;
create policy slots_select on rakeezx.slots for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists slots_insert on rakeezx.slots;
create policy slots_insert on rakeezx.slots for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists slots_update on rakeezx.slots;
create policy slots_update on rakeezx.slots for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.students enable row level security;
alter table rakeezx.students force  row level security;
drop policy if exists students_select on rakeezx.students;
create policy students_select on rakeezx.students for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists students_insert on rakeezx.students;
create policy students_insert on rakeezx.students for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists students_update on rakeezx.students;
create policy students_update on rakeezx.students for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.subjects enable row level security;
alter table rakeezx.subjects force  row level security;
drop policy if exists subjects_select on rakeezx.subjects;
create policy subjects_select on rakeezx.subjects for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists subjects_insert on rakeezx.subjects;
create policy subjects_insert on rakeezx.subjects for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists subjects_update on rakeezx.subjects;
create policy subjects_update on rakeezx.subjects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.teachings enable row level security;
alter table rakeezx.teachings force  row level security;
drop policy if exists teachings_select on rakeezx.teachings;
create policy teachings_select on rakeezx.teachings for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists teachings_insert on rakeezx.teachings;
create policy teachings_insert on rakeezx.teachings for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists teachings_update on rakeezx.teachings;
create policy teachings_update on rakeezx.teachings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.terms enable row level security;
alter table rakeezx.terms force  row level security;
drop policy if exists terms_select on rakeezx.terms;
create policy terms_select on rakeezx.terms for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists terms_insert on rakeezx.terms;
create policy terms_insert on rakeezx.terms for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists terms_update on rakeezx.terms;
create policy terms_update on rakeezx.terms for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.time_profiles enable row level security;
alter table rakeezx.time_profiles force  row level security;
drop policy if exists time_profiles_select on rakeezx.time_profiles;
create policy time_profiles_select on rakeezx.time_profiles for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists time_profiles_insert on rakeezx.time_profiles;
create policy time_profiles_insert on rakeezx.time_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists time_profiles_update on rakeezx.time_profiles;
create policy time_profiles_update on rakeezx.time_profiles for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.units enable row level security;
alter table rakeezx.units force  row level security;
drop policy if exists units_select on rakeezx.units;
create policy units_select on rakeezx.units for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists units_insert on rakeezx.units;
create policy units_insert on rakeezx.units for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists units_update on rakeezx.units;
create policy units_update on rakeezx.units for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

begin;
alter table rakeezx.years enable row level security;
alter table rakeezx.years force  row level security;
drop policy if exists years_select on rakeezx.years;
create policy years_select on rakeezx.years for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists years_insert on rakeezx.years;
create policy years_insert on rakeezx.years for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists years_update on rakeezx.years;
create policy years_update on rakeezx.years for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
commit;

-- ---------------------------------------------------------------------------
-- المرحلة ٤ — الصلاحيات
--
-- الأدوار العامة لا تملك شيئًا افتراضيًا، والحذف الصلب ممنوع على الجميع:
-- الحذف في RAKEEZ X ناعم (deleted_at) لأن الحذف الصلب لا يمكن مزامنته —
-- الجهاز الآخر لا يفرّق بين «حُذف» و«لم يصل بعد».
-- ---------------------------------------------------------------------------

begin;

revoke all on all tables in schema rakeezx from anon;
revoke all on schema rakeezx from anon;

grant usage on schema rakeezx to authenticated;
grant select, insert, update on all tables in schema rakeezx to authenticated;
revoke delete on all tables in schema rakeezx from authenticated, anon;

alter default privileges in schema rakeezx
  grant select, insert, update on tables to authenticated;

commit;

reset lock_timeout;
