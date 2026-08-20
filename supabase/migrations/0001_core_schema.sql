-- ============================================================================
-- MADAR Z — الترحيلة ١: النواة
--
-- تنشئ الجداول الأساسية فقط، بما يطابق النموذج المحلي بعد الموجة الأولى.
-- لا جداول مستقبلية غير محسومة (الواجبات، التسليمات، الملاحظات).
--
-- مبادئ ثابتة في كل الجداول:
--   • owner_id      — مالك الصف، مربوط بالمستخدم المصادق عليه، تحرسه RLS
--   • id text       — المعرّف المشتق نفسه المستعمل محليًا، فلا تحويل عند المزامنة
--   • updated_at    — ختم **الخادم**، يضعه trigger ولا يثق بساعة الجهاز
--   • client_updated_at — ساعة الجهاز، للتشخيص والعرض فقط، لا للترتيب
--   • deleted_at    — حذف ناعم؛ لا حذف صلب لأنه لا يمكن مزامنته
--   • device_id     — الجهاز الذي كتب آخر تغيير
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- ٠. أدوات مشتركة
-- ---------------------------------------------------------------------------

create schema if not exists madarz;

comment on schema madarz is 'MADAR Z — سجل المعلّم';

-- ختم الخادم: يُفرض على كل كتابة، فلا يستطيع عميل تزوير ترتيب التعديلات.
--
-- `set search_path = ''` مع التأهيل الكامل لكل استدعاء: بدونه يستطيع مخطط
-- خبيث في مسار البحث أن يظلّل now() أو uid() ويتحكم بالأختام والملكية.
create or replace function madarz.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

-- الملكية تُفرض من الخادم لا من العميل: أي قيمة يرسلها العميل تُستبدل.
create or replace function madarz.force_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ١. ملف المعلّم  (سجل واحد لكل حساب)
--    إعدادات الجهاز (المظهر، الفصل النشط) **لا تُرفع أبدًا** — تبقى محلية.
-- ---------------------------------------------------------------------------

create table madarz.profile (
  owner_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  teacher_name        text not null default '',
  school_name         text not null default '',
  phone               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz
);

-- ---------------------------------------------------------------------------
-- ٢. السنوات الدراسية
-- ---------------------------------------------------------------------------

create table madarz.years (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label               text not null,
  hijri_start         int  not null,
  hijri_end           int  not null,
  "order"             int  not null default 0,
  status              text not null default 'active' check (status in ('active','archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  -- سنة هجرية واحدة لكل معلّم: يمنع تكرارها من جهازين دون إنترنت
  constraint years_hijri_uniq unique (owner_id, hijri_start)
);

-- ---------------------------------------------------------------------------
-- ٣. الفصول الدراسية
-- ---------------------------------------------------------------------------

create table madarz.terms (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year_id             text not null,
  name                text not null,
  "index"             int  not null check ("index" between 1 and 6),
  start_date          date,
  end_date            date,
  status              text not null default 'upcoming' check (status in ('upcoming','active','closed')),
  calendar_id         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, year_id) references madarz.years(owner_id, id) on delete cascade,
  -- ترتيب واحد لكل سنة: لا «فصل دراسي أول» مكرر
  constraint terms_index_uniq unique (owner_id, year_id, "index"),
  constraint terms_dates_ck check (start_date is null or end_date is null or start_date <= end_date)
);

-- ---------------------------------------------------------------------------
-- ٤. المواد
-- ---------------------------------------------------------------------------

create table madarz.subjects (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                text not null,
  slug                text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  constraint subjects_slug_uniq unique (owner_id, slug)
);

-- ---------------------------------------------------------------------------
-- ٥. الشعب  (مجموعة الطلاب — تعيش السنة كاملة)
-- ---------------------------------------------------------------------------

create table madarz.sections (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year_id             text not null,
  grade               int  not null check (grade between 1 and 12),
  label               text not null,
  name                text not null,
  color               text not null default '#0f766e',
  "order"             int  not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, year_id) references madarz.years(owner_id, id) on delete cascade,
  -- «٤/أ» واحدة في السنة الواحدة
  constraint sections_natural_uniq unique (owner_id, year_id, grade, label),
  constraint sections_color_ck check (color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$')
);

-- ---------------------------------------------------------------------------
-- ٦. الإسناد التدريسي  (شعبة × مادة × فصل دراسي)
-- ---------------------------------------------------------------------------

create table madarz.teachings (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id          text not null,
  subject_id          text not null,
  term_id             text not null,
  "order"             int  not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, section_id) references madarz.sections(owner_id, id) on delete cascade,
  foreign key (owner_id, subject_id) references madarz.subjects(owner_id, id) on delete cascade,
  foreign key (owner_id, term_id)    references madarz.terms(owner_id, id)    on delete cascade,
  -- إسناد واحد لنفس (الشعبة، المادة، الفصل الدراسي)
  constraint teachings_natural_uniq unique (owner_id, section_id, subject_id, term_id)
);

-- ---------------------------------------------------------------------------
-- ٧. الطلاب  (هوية مستقلة — بلا انتماء دائم لشعبة)
-- ---------------------------------------------------------------------------

create table madarz.students (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                text not null check (length(btrim(name)) >= 2 and length(name) <= 80),
  note                text not null default '',
  status              text not null default 'active' check (status in ('active','withdrawn')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id)
);

-- ---------------------------------------------------------------------------
-- ٨. الانتساب  (الطالب ↔ الشعبة خلال مدة)
-- ---------------------------------------------------------------------------

create table madarz.enrollments (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id          text not null,
  section_id          text not null,
  roll_no             int  check (roll_no between 1 and 999),
  start_date          date,
  end_date            date,
  status              text not null default 'active'
                        check (status in ('active','transferred','withdrawn','completed')),
  transfer_note       text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, student_id) references madarz.students(owner_id, id) on delete cascade,
  foreign key (owner_id, section_id) references madarz.sections(owner_id, id) on delete cascade,
  -- انتساب واحد لكل (طالب، شعبة) — يطابق المعرّف المشتق محليًا
  constraint enrollments_natural_uniq unique (owner_id, student_id, section_id),
  constraint enrollments_dates_ck check (start_date is null or end_date is null or start_date <= end_date)
);

-- رقم الكشف فريد بين المنتسبين **النشطين** في الشعبة الواحدة.
-- فهرس جزئي لا قيد جدول، لأن المنتقل يحتفظ برقمه القديم في سجله التاريخي.
create unique index enrollments_active_roll_uniq
  on madarz.enrollments (owner_id, section_id, roll_no)
  where status = 'active' and roll_no is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- ٩. المنهج: الوحدات  (مادة + صف + رقم الفصل الدراسي — لا سنة ولا شعبة)
-- ---------------------------------------------------------------------------

create table madarz.units (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id          text not null,
  grade               int  not null check (grade between 1 and 12),
  term_index          int  not null check (term_index between 1 and 6),
  name                text not null,
  "order"             int  not null default 0,
  planned_sessions    int  not null default 0 check (planned_sessions >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, subject_id) references madarz.subjects(owner_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- ١٠. المنهج: الدروس
-- ---------------------------------------------------------------------------

create table madarz.lessons (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit_id             text not null,
  name                text not null,
  "order"             int  not null default 0,
  planned_sessions    int  not null default 1 check (planned_sessions >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, unit_id) references madarz.units(owner_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- ١١. بنود التقييم
--     الربط بالمنهج اختياري: يحوّل «الطالب ٦٢٪» إلى «يحتاج دعمًا في الوحدة X».
-- ---------------------------------------------------------------------------

create table madarz.items (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id         text not null,
  name                text not null,
  max                 numeric(6,2) not null check (max > 0),
  "order"             int  not null default 0,
  auto                text check (auto in ('participation','attendance')),
  per_point           numeric(6,2) not null default 1,
  penalty             numeric(6,2) not null default 1,
  unit_id             text,
  lesson_id           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, teaching_id) references madarz.teachings(owner_id, id) on delete cascade,
  foreign key (owner_id, unit_id)     references madarz.units(owner_id, id)     on delete set null (unit_id),
  foreign key (owner_id, lesson_id)   references madarz.lessons(owner_id, id)   on delete set null (lesson_id)
);

-- ---------------------------------------------------------------------------
-- ١٢. الدرجات
--     المفتاح الطبيعي (طالب، بند) — وهذا ما يمنع جهازين دون إنترنت من خلق صفَّين.
-- ---------------------------------------------------------------------------

create table madarz.scores (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id          text not null,
  item_id             text not null,
  value               numeric(6,2),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, student_id) references madarz.students(owner_id, id) on delete cascade,
  foreign key (owner_id, item_id)    references madarz.items(owner_id, id)    on delete cascade,
  constraint scores_natural_uniq unique (owner_id, student_id, item_id)
);

-- ---------------------------------------------------------------------------
-- ١٣. ملفات توقيت الحصص
--     الأوقات مصفوفة JSON: عدد الحصص مرن، والاستثناءات محفوظة بمفتاح رقم اليوم.
-- ---------------------------------------------------------------------------

create table madarz.time_profiles (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                text not null,
  "order"             int  not null default 0,
  periods             jsonb not null default '[]'::jsonb,
  overrides           jsonb not null default '{}'::jsonb,
  active_from         date,
  active_to           date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  constraint time_profiles_periods_ck  check (jsonb_typeof(periods) = 'array'),
  constraint time_profiles_overrides_ck check (jsonb_typeof(overrides) = 'object')
);

-- ---------------------------------------------------------------------------
-- ١٤. الجدول الأسبوعي  (الخانات المتكررة — بلا أوقات، فالوقت من ملف التوقيت)
-- ---------------------------------------------------------------------------

create table madarz.slots (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id         text not null,
  weekday             int  not null check (weekday between 0 and 6),
  period              int  not null check (period between 1 and 12),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, teaching_id) references madarz.teachings(owner_id, id) on delete cascade,
  constraint slots_natural_uniq unique (owner_id, teaching_id, weekday, period)
);

-- ---------------------------------------------------------------------------
-- ١٥. الحصص
--     تحمل وقتها **مطبوعًا فيها**: تغيير ملف التوقيت لا يعيد كتابة الماضي.
-- ---------------------------------------------------------------------------

create table madarz.sessions (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  teaching_id         text not null,
  date                date not null,
  period              int  not null check (period between 1 and 12),
  slot_id             text,
  start_time          time,
  end_time            time,
  time_profile_id     text,
  status              text not null default 'scheduled'
                        check (status in ('scheduled','held','missed','postponed',
                                          'cancelled','cancelled_holiday','makeup')),
  reason              text not null default '',
  makeup_for_id       text,
  lesson_id           text,
  note                text not null default '',
  homework            text not null default '',
  covered             text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, teaching_id)     references madarz.teachings(owner_id, id)     on delete cascade,
  foreign key (owner_id, slot_id)         references madarz.slots(owner_id, id)         on delete set null (slot_id),
  foreign key (owner_id, time_profile_id) references madarz.time_profiles(owner_id, id) on delete set null (time_profile_id),
  foreign key (owner_id, lesson_id)       references madarz.lessons(owner_id, id)       on delete set null (lesson_id),
  foreign key (owner_id, makeup_for_id)   references madarz.sessions(owner_id, id)      on delete set null (makeup_for_id),
  -- حصة واحدة لكل (إسناد، تاريخ، رقم حصة) — أساس دعم حصتين في يوم واحد
  constraint sessions_natural_uniq unique (owner_id, teaching_id, date, period)
);

-- ---------------------------------------------------------------------------
-- ١٦. الحضور  (مربوط بالحصة لا باليوم)
-- ---------------------------------------------------------------------------

create table madarz.attendance (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id          text not null,
  session_id          text not null,
  teaching_id         text not null,   -- مشتق من الحصة، مخزّن للاستعلام السريع
  date                date not null,   -- مشتق من الحصة، مخزّن للاستعلام السريع
  status              text not null check (status in ('present','late','excused','absent')),
  note                text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, student_id)  references madarz.students(owner_id, id)  on delete cascade,
  foreign key (owner_id, session_id)  references madarz.sessions(owner_id, id)  on delete cascade,
  foreign key (owner_id, teaching_id) references madarz.teachings(owner_id, id) on delete cascade,
  -- سجل حضور واحد لكل (طالب، حصة)
  constraint attendance_natural_uniq unique (owner_id, student_id, session_id)
);

-- ---------------------------------------------------------------------------
-- ١٧. الرصد السريع  (سجل أحداث — لا مفتاح طبيعي، والتكرار مقصود)
-- ---------------------------------------------------------------------------

create table madarz.logs (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id          text not null,
  teaching_id         text not null,
  session_id          text,
  date                date not null,
  kind                text not null check (kind in ('participation','behavior')),
  delta               int  not null check (delta between -10 and 10),
  tag                 text not null default '',
  note                text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, student_id)  references madarz.students(owner_id, id)  on delete cascade,
  foreign key (owner_id, teaching_id) references madarz.teachings(owner_id, id) on delete cascade,
  foreign key (owner_id, session_id)  references madarz.sessions(owner_id, id)  on delete set null (session_id)
);

-- ---------------------------------------------------------------------------
-- ١٨. التقويم الدراسي
-- ---------------------------------------------------------------------------

create table madarz.calendars (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year_id             text not null,
  source              text not null default 'custom' check (source in ('moe','custom')),
  label               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, year_id) references madarz.years(owner_id, id) on delete cascade,
  constraint calendars_source_uniq unique (owner_id, year_id, source)
);

create table madarz.calendar_days (
  id                  text not null,
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  calendar_id         text not null,
  date                date not null,
  kind                text not null
                        check (kind in ('study','holiday','national','founding','exam','event')),
  label               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  client_updated_at   bigint,
  device_id           text,
  deleted_at          timestamptz,
  primary key (owner_id, id),
  foreign key (owner_id, calendar_id) references madarz.calendars(owner_id, id) on delete cascade,
  constraint calendar_days_natural_uniq unique (owner_id, calendar_id, date)
);

-- الآن يمكن ربط الفصل الدراسي بتقويمه (أُجّل لأن calendars تأتي بعد terms)
alter table madarz.terms
  add constraint terms_calendar_fk
  foreign key (owner_id, calendar_id) references madarz.calendars(owner_id, id) on delete set null (calendar_id);

commit;
