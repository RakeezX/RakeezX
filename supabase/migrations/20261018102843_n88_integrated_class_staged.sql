-- AI: UNAPPLIED additive N88 integrated-class proposal. No hosted operation authorized.
set lock_timeout='5s';
begin;
do $$ begin
if current_user<>'postgres' then raise exception 'N88 management identity mismatch';end if;
if to_regnamespace('n88_private') is null or to_regrole('n88_backend') is null or to_regrole('n88_guard') is null then raise exception 'N88 baseline prerequisite';end if;
if to_regclass('n88_private.numeric_credentials') is not null or to_regclass('n88_private.class_visibility') is not null then raise exception 'N88 extension collision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: years.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: years.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: years.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: years.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='years' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: years.status';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.years'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.years'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: years';end if;
if not exists(select 1 from pg_class where oid='rakeezx.years'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: years';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: terms.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: terms.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: terms.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: terms.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='year_id' and udt_name='text') then raise exception 'N88 consumed column missing: terms.year_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: terms.status';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='start_date' and udt_name='date') then raise exception 'N88 consumed column missing: terms.start_date';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='terms' and column_name='end_date' and udt_name='date') then raise exception 'N88 consumed column missing: terms.end_date';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.terms'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: terms';end if;
if not exists(select 1 from pg_class where oid='rakeezx.terms'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: terms';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: sections.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: sections.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: sections.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: sections.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='year_id' and udt_name='text') then raise exception 'N88 consumed column missing: sections.year_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: sections.status';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='archived_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: sections.archived_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='grade' and udt_name='int4') then raise exception 'N88 consumed column missing: sections.grade';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='label' and udt_name='text') then raise exception 'N88 consumed column missing: sections.label';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sections' and column_name='name' and udt_name='text') then raise exception 'N88 consumed column missing: sections.name';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.sections'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: sections';end if;
if not exists(select 1 from pg_class where oid='rakeezx.sections'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: sections';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: students.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: students.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: students.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: students.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: students.status';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='students' and column_name='name' and udt_name='text') then raise exception 'N88 consumed column missing: students.name';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.students'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.students'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: students';end if;
if not exists(select 1 from pg_class where oid='rakeezx.students'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: students';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: enrollments.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: enrollments.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: enrollments.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: enrollments.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='student_id' and udt_name='text') then raise exception 'N88 consumed column missing: enrollments.student_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='section_id' and udt_name='text') then raise exception 'N88 consumed column missing: enrollments.section_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: enrollments.status';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='start_date' and udt_name='date') then raise exception 'N88 consumed column missing: enrollments.start_date';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='enrollments' and column_name='end_date' and udt_name='date') then raise exception 'N88 consumed column missing: enrollments.end_date';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.enrollments'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.enrollments'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: enrollments';end if;
if not exists(select 1 from pg_class where oid='rakeezx.enrollments'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: enrollments';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: teachings.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: teachings.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: teachings.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: teachings.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='section_id' and udt_name='text') then raise exception 'N88 consumed column missing: teachings.section_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='term_id' and udt_name='text') then raise exception 'N88 consumed column missing: teachings.term_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='teachings' and column_name='subject_id' and udt_name='text') then raise exception 'N88 consumed column missing: teachings.subject_id';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.teachings'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: teachings';end if;
if not exists(select 1 from pg_class where oid='rakeezx.teachings'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: teachings';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: items.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: items.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: items.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: items.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='teaching_id' and udt_name='text') then raise exception 'N88 consumed column missing: items.teaching_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='name' and udt_name='text') then raise exception 'N88 consumed column missing: items.name';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='max' and udt_name='numeric') then raise exception 'N88 consumed column missing: items.max';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='order' and udt_name='int4') then raise exception 'N88 consumed column missing: items.order';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='auto' and udt_name='text') then raise exception 'N88 consumed column missing: items.auto';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='per_point' and udt_name='numeric') then raise exception 'N88 consumed column missing: items.per_point';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='penalty' and udt_name='numeric') then raise exception 'N88 consumed column missing: items.penalty';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='score_mode' and udt_name='text') then raise exception 'N88 consumed column missing: items.score_mode';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='items' and column_name='portability_group_id' and udt_name='text') then raise exception 'N88 consumed column missing: items.portability_group_id';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.items'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: items';end if;
if not exists(select 1 from pg_class where oid='rakeezx.items'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: items';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: scores.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: scores.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: scores.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: scores.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='student_id' and udt_name='text') then raise exception 'N88 consumed column missing: scores.student_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='item_id' and udt_name='text') then raise exception 'N88 consumed column missing: scores.item_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='value' and udt_name='numeric') then raise exception 'N88 consumed column missing: scores.value';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='manual_value' and udt_name='numeric') then raise exception 'N88 consumed column missing: scores.manual_value';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='scores' and column_name='derived_value' and udt_name='numeric') then raise exception 'N88 consumed column missing: scores.derived_value';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.scores'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.scores'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: scores';end if;
if not exists(select 1 from pg_class where oid='rakeezx.scores'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: scores';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitems.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: score_subitems.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: score_subitems.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: score_subitems.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='item_id' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitems.item_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='name' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitems.name';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='value' and udt_name='numeric') then raise exception 'N88 consumed column missing: score_subitems.value';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='order' and udt_name='int4') then raise exception 'N88 consumed column missing: score_subitems.order';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='start_date' and udt_name='date') then raise exception 'N88 consumed column missing: score_subitems.start_date';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='due_date' and udt_name='date') then raise exception 'N88 consumed column missing: score_subitems.due_date';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitems' and column_name='late_points' and udt_name='numeric') then raise exception 'N88 consumed column missing: score_subitems.late_points';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitems'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitems'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: score_subitems';end if;
if not exists(select 1 from pg_class where oid='rakeezx.score_subitems'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: score_subitems';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitem_completions.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: score_subitem_completions.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: score_subitem_completions.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: score_subitem_completions.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='student_id' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitem_completions.student_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='subitem_id' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitem_completions.subitem_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='checked' and udt_name='bool') then raise exception 'N88 consumed column missing: score_subitem_completions.checked';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='score_subitem_completions' and column_name='completion_state' and udt_name='text') then raise exception 'N88 consumed column missing: score_subitem_completions.completion_state';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitem_completions'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.score_subitem_completions'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: score_subitem_completions';end if;
if not exists(select 1 from pg_class where oid='rakeezx.score_subitem_completions'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: score_subitem_completions';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: sessions.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: sessions.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: sessions.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: sessions.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='teaching_id' and udt_name='text') then raise exception 'N88 consumed column missing: sessions.teaching_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='date' and udt_name='date') then raise exception 'N88 consumed column missing: sessions.date';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='sessions' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: sessions.status';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.sessions'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.sessions'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: sessions';end if;
if not exists(select 1 from pg_class where oid='rakeezx.sessions'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: sessions';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: attendance.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: attendance.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: attendance.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: attendance.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='student_id' and udt_name='text') then raise exception 'N88 consumed column missing: attendance.student_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='teaching_id' and udt_name='text') then raise exception 'N88 consumed column missing: attendance.teaching_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='session_id' and udt_name='text') then raise exception 'N88 consumed column missing: attendance.session_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='attendance' and column_name='status' and udt_name='text') then raise exception 'N88 consumed column missing: attendance.status';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.attendance'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.attendance'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: attendance';end if;
if not exists(select 1 from pg_class where oid='rakeezx.attendance'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: attendance';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='id' and udt_name='text') then raise exception 'N88 consumed column missing: logs.id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='owner_id' and udt_name='uuid') then raise exception 'N88 consumed column missing: logs.owner_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='revision' and udt_name='int8') then raise exception 'N88 consumed column missing: logs.revision';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='deleted_at' and udt_name='timestamptz') then raise exception 'N88 consumed column missing: logs.deleted_at';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='student_id' and udt_name='text') then raise exception 'N88 consumed column missing: logs.student_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='teaching_id' and udt_name='text') then raise exception 'N88 consumed column missing: logs.teaching_id';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='kind' and udt_name='text') then raise exception 'N88 consumed column missing: logs.kind';end if;
if not exists(select 1 from information_schema.columns where table_schema='rakeezx' and table_name='logs' and column_name='delta' and udt_name='int4') then raise exception 'N88 consumed column missing: logs.delta';end if;
if not exists(select 1 from pg_constraint where conrelid='rakeezx.logs'::regclass and pg_get_constraintdef(oid)='PRIMARY KEY (owner_id, id)' and convalidated and not condeferrable) or not exists(select 1 from pg_constraint where conrelid='rakeezx.logs'::regclass and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE' and convalidated and not condeferrable) then raise exception 'N88 source topology mismatch: logs';end if;
if not exists(select 1 from pg_class where oid='rakeezx.logs'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'N88 source RLS mismatch: logs';end if;
end;$$;

-- AI: UNAPPLIED additive proposal after the preserved 20261018034356 baseline. Local synthetic only.
-- AI-authored, UNAPPLIED local proposal. Not included in activation manifest.
-- After exact existing N88 private schema/roles; CLI-staged local integration only.
-- JSON payloads are bounded, typed by this server codec, and contain NO plaintext.
create table n88_private.numeric_credentials (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2048),
  id uuid generated always as ((payload->>'id')::uuid) stored not null unique,
  owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null,
  student_id text generated always as (payload->>'studentId') stored not null,
  version bigint generated always as ((payload->>'version')::bigint) stored not null,
  reservation text generated always as (payload->>'reservation') stored not null unique,
  revoked_at bigint generated always as ((payload->>'revokedAt')::bigint) stored,
  foreign key(owner_id) references n88_private.contexts(owner_id),
  unique(owner_id,student_id,version), unique(id,owner_id,student_id,version),
  check(row_key=payload->>'id' and version>=1 and length(student_id) between 1 and 240),
  check(reservation ~ '^[a-f0-9]{64}$' and coalesce(payload->>'verifier' ~ '^[a-f0-9]{64}$',false)),
  check(coalesce(payload->>'keyVersion' ~ '^[A-Za-z0-9_-]{1,40}$',false)),
  check(payload ?& array['id','ownerId','studentId','version','reservation','verifier','keyVersion','revokedAt']),
  check((payload - array['id','ownerId','studentId','version','reservation','verifier','keyVersion','revokedAt'])='{}'::jsonb)
);
create unique index numeric_one_active_student on n88_private.numeric_credentials(owner_id,student_id) where revoked_at is null;
create function n88_private.numeric_tombstone_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if TG_OP='DELETE' then raise exception 'n88_numeric_unavailable'; end if;
  if (new.payload-'revokedAt') is distinct from (old.payload-'revokedAt') or
     new.row_key<>old.row_key or old.payload->>'revokedAt' is not null or new.payload->>'revokedAt' is null then
    raise exception 'n88_numeric_unavailable';
  end if;
  return new;
end; $$;
revoke all on function n88_private.numeric_tombstone_guard() from public;
create trigger numeric_tombstones before update or delete on n88_private.numeric_credentials
  for each row execute function n88_private.numeric_tombstone_guard();

create table n88_private.numeric_sessions (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=4096),
  credential_id uuid generated always as ((payload->>'credentialId')::uuid) stored not null,
  owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null,
  student_id text generated always as (payload->>'studentId') stored not null,
  version bigint generated always as ((payload->>'version')::bigint) stored not null,
  token_hash text generated always as (payload->>'tokenHash') stored not null unique,
  foreign key(credential_id,owner_id,student_id,version) references n88_private.numeric_credentials(id,owner_id,student_id,version),
  check(row_key=payload->>'id' and token_hash ~ '^[a-f0-9]{64}$'),
  check(payload ?& array['id','credentialId','ownerId','studentId','classId','enrollmentId','membershipRevision','canonicalStamp','version','tokenHash','expiresAt','revokedAt']),
  check((payload - array['id','credentialId','ownerId','studentId','classId','enrollmentId','membershipRevision','canonicalStamp','version','tokenHash','expiresAt','revokedAt'])='{}'::jsonb)
);
create table n88_private.numeric_rates (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=512),
  check(row_key=payload->>'key' and (row_key='global' or row_key ~ '^[a-f0-9]{64}$')),
  check((payload->>'count')::bigint>=0 and (payload->>'until')::bigint>0),
  check(payload ?& array['key','count','until'] and (payload-array['key','count','until'])='{}'::jsonb)
);
revoke all on n88_private.numeric_credentials,n88_private.numeric_sessions,n88_private.numeric_rates from public;
alter table n88_private.numeric_credentials enable row level security;
alter table n88_private.numeric_sessions enable row level security;
alter table n88_private.numeric_rates enable row level security;
create policy numeric_backend on n88_private.numeric_credentials to n88_backend using(true) with check(true);
create policy numeric_backend on n88_private.numeric_sessions to n88_backend using(true) with check(true);
create policy numeric_backend on n88_private.numeric_rates to n88_backend using(true) with check(true);
grant select,insert,update on n88_private.numeric_credentials to n88_backend;
grant select,insert,update,delete on n88_private.numeric_sessions,n88_private.numeric_rates to n88_backend;
-- No managed Auth/RLS changes, no canonical writes, no browser-role grants.

-- AI-authored, UNAPPLIED local proposal, after numeric-credentials.inactive.sql.
create table n88_private.class_credential_receipts (
  row_key text primary key,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=1048576),
  owner_id uuid generated always as ((payload->>'ownerId')::uuid) stored not null,
  request_id text generated always as (payload->>'requestId') stored not null,
  foreign key(owner_id) references n88_private.contexts(owner_id),
  unique(owner_id,request_id),
  check(request_id ~ '^[A-Za-z0-9_-]{16,100}$' and payload->>'binding' ~ '^[a-f0-9]{64}$'),
  check(jsonb_typeof(payload->'results')='array' and jsonb_array_length(payload->'results')<=2000),
  check(payload ?& array['ownerId','requestId','binding','results']),
  check((payload-array['ownerId','requestId','binding','results'])='{}'::jsonb)
);
create function n88_private.class_receipt_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
declare r jsonb;
begin
  if TG_OP<>'INSERT' then raise exception 'n88_class_unavailable'; end if;
  for r in select value from jsonb_array_elements(new.payload->'results') loop
    if (r-array['studentId','enrollmentId','credentialVersion','status','reason'])<>'{}'::jsonb or
       not (r ?& array['studentId','enrollmentId','credentialVersion','status']) or
       coalesce(r->>'status','') not in ('created','skipped','failed') or
       (r ? 'reason' and coalesce(r->>'reason','') not in ('existing','revoked_rotate_required','revoked','unavailable')) then raise exception 'n88_class_unavailable'; end if;
  end loop;
  return new;
end; $$;
revoke all on function n88_private.class_receipt_guard() from public;
create trigger class_receipts_immutable before insert or update or delete on n88_private.class_credential_receipts
  for each row execute function n88_private.class_receipt_guard();
revoke all on n88_private.class_credential_receipts from public;
alter table n88_private.class_credential_receipts enable row level security;
create policy class_backend on n88_private.class_credential_receipts to n88_backend using(true) with check(true);
grant select,insert on n88_private.class_credential_receipts to n88_backend;
-- Receipts/reservations are never TTL-evicted. Capacity exhaustion fails closed;
-- archival/key migration needs its own exact design, not a silent retry/reset.

create table n88_private.class_visibility(owner_id uuid not null references n88_private.contexts(owner_id),class_id text not null,term_id text not null,payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2097152),primary key(owner_id,class_id,term_id));
revoke all on n88_private.class_visibility from public,anon,authenticated;
alter table n88_private.class_visibility enable row level security;
create policy class_visibility_backend on n88_private.class_visibility to n88_backend using(true) with check(true);
grant select,insert,update on n88_private.class_visibility to n88_backend;
create function n88_private.lock_projection_sources(p_owner uuid,p_max integer) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare t text;n integer;
begin
 if p_owner is null or p_max is null or p_max<1 or p_max>2000 then raise exception 'n88_projection_unavailable';end if;
 perform n88_private.lock_canonical_sources(p_owner,p_max);
 foreach t in array array['scores','score_subitems','score_subitem_completions','sessions','attendance','logs'] loop
  execute format('select count(*) from (select id from rakeezx.%I where owner_id=$1 order by id limit $2 for update) locked',t) into n using p_owner,p_max+1;
  if n>p_max then raise exception 'n88_projection_unavailable';end if;
 end loop;
end;$$;
revoke all on function n88_private.lock_projection_sources(uuid,integer) from public;
grant execute on function n88_private.lock_projection_sources(uuid,integer) to n88_backend;
grant select(owner_id,id),update(id) on rakeezx.scores,rakeezx.score_subitems,rakeezx.score_subitem_completions,rakeezx.sessions,rakeezx.attendance,rakeezx.logs to n88_guard;
do $$ declare t text;begin
 foreach t in array array['scores','score_subitems','score_subitem_completions','sessions','attendance','logs'] loop
  execute format('create policy n88_canonical_read on rakeezx.%I for select to n88_backend using(owner_id::text=current_setting(''n88.canonical_owner'',true))',t);
  execute format('create policy n88_guard_lock on rakeezx.%I to n88_guard using(owner_id::text=current_setting(''n88.canonical_owner'',true)) with check(false)',t);
 end loop;
end;$$;
grant create on schema n88_private to n88_guard;
grant n88_guard to postgres with set true;
alter function n88_private.lock_projection_sources(uuid,integer) owner to n88_guard;
grant n88_guard to postgres with set false;
revoke create on schema n88_private from n88_guard;
grant select(id,owner_id,revision,deleted_at,status) on rakeezx.years to n88_backend;
grant select(id,owner_id,revision,deleted_at,year_id,status,start_date,end_date) on rakeezx.terms to n88_backend;
grant select(id,owner_id,revision,deleted_at,year_id,status,archived_at,grade,label,name) on rakeezx.sections to n88_backend;
grant select(id,owner_id,revision,deleted_at,status,name) on rakeezx.students to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,section_id,status,start_date,end_date) on rakeezx.enrollments to n88_backend;
grant select(id,owner_id,revision,deleted_at,section_id,term_id,subject_id) on rakeezx.teachings to n88_backend;
grant select(id,owner_id,revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id) on rakeezx.items to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,item_id,value,manual_value,derived_value) on rakeezx.scores to n88_backend;
grant select(id,owner_id,revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points) on rakeezx.score_subitems to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,subitem_id,checked,completion_state) on rakeezx.score_subitem_completions to n88_backend;
grant select(id,owner_id,revision,deleted_at,teaching_id,date,status) on rakeezx.sessions to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,session_id,status) on rakeezx.attendance to n88_backend;
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,kind,delta) on rakeezx.logs to n88_backend;

commit;
