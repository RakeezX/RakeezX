-- AI: INACTIVE N88 guidance closure v1. Synthetic PG only, NEVER hosted.
-- Not a migration. Original catalog/migrations remain immutable. No source writes.
-- Owner FOR UPDATE blocks owner-FK inserts. Existing core rows FOR UPDATE block
-- membership/teaching moves and child FK retargets; selected child row locks block
-- value/revision/deletion changes. Lock/statement deadlines abort, never truncate.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
grant select(id,owner_id,revision,deleted_at,status) on rakeezx.years to n88_guard;
grant select(id,owner_id,revision,deleted_at,year_id,status,start_date,end_date) on rakeezx.terms to n88_guard;
grant select(id,owner_id,revision,deleted_at,year_id,status,archived_at,grade,label,name) on rakeezx.sections to n88_guard;
grant select(id,owner_id,revision,deleted_at,status,name) on rakeezx.students to n88_guard;
grant select(id,owner_id,revision,deleted_at,student_id,section_id,status,start_date,end_date) on rakeezx.enrollments to n88_guard;
grant select(id,owner_id,revision,deleted_at,section_id,term_id,subject_id) on rakeezx.teachings to n88_guard;
grant select(id,owner_id,revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id) on rakeezx.items to n88_guard;
grant select(id,owner_id,revision,deleted_at,student_id,item_id,value,manual_value,derived_value) on rakeezx.scores to n88_guard;
grant select(id,owner_id,revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points) on rakeezx.score_subitems to n88_guard;
grant select(id,owner_id,revision,deleted_at,student_id,subitem_id,checked,completion_state) on rakeezx.score_subitem_completions to n88_guard;
grant select(id,owner_id,revision,deleted_at,teaching_id,date,status) on rakeezx.sessions to n88_guard;
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,session_id,status) on rakeezx.attendance to n88_guard;
grant select(id,owner_id,revision,deleted_at,student_id,teaching_id,kind,delta) on rakeezx.logs to n88_guard;
create function n88_private.boundary_guidance_sources_v1(p_owner uuid,p_class text,p_term text)
returns table(table_index integer,payload text)
language plpgsql security definer set search_path=pg_catalog as $n88_guidance$
declare v_students text[];v_teachings text[];v_items text[];v_subitems text[];v_year text;v_grade integer;v_bytes integer:=0;v_count integer;state text;
begin
 if p_owner is null or p_class is null or p_term is null then raise exception 'n88_guidance_unavailable';end if;
 perform n88_private.lock_canonical_sources(p_owner,2000);
 select c.year_id,c.grade into strict v_year,v_grade from rakeezx.sections c
 join rakeezx.years y on y.owner_id=c.owner_id and y.id=c.year_id
 join rakeezx.terms t on t.owner_id=c.owner_id and t.year_id=c.year_id and t.id=p_term
 where c.owner_id=p_owner and c.id=p_class and c.status='active' and c.deleted_at is null and c.archived_at is null
 and y.status='active' and y.deleted_at is null and t.status='active' and t.deleted_at is null;
 select coalesce(array_agg(distinct e.student_id),'{}') into v_students from rakeezx.enrollments e
 join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id
 where e.owner_id=p_owner and e.section_id=p_class and e.status='active' and e.end_date is null and e.deleted_at is null and s.status='active' and s.deleted_at is null;
 -- Preserve all same-year enrollments/core rows for original uniqueness. Include
 -- transferred teacher context, not an invented empty portable-grade context.
 select coalesce(array_agg(t.id),'{}') into v_teachings from rakeezx.teachings t
 join rakeezx.sections c on c.owner_id=t.owner_id and c.id=t.section_id
 where t.owner_id=p_owner and t.term_id=p_term and (t.section_id=p_class or
 (c.year_id=v_year and c.grade is not distinct from v_grade and exists(select 1 from rakeezx.enrollments e
 where e.owner_id=p_owner and e.student_id=any(v_students) and e.section_id=c.id and e.status='transferred' and e.deleted_at is null)));
 select coalesce(array_agg(i.id),'{}') into v_items from rakeezx.items i where i.owner_id=p_owner and i.teaching_id=any(v_teachings);
perform id from rakeezx.score_subitems where owner_id=p_owner and item_id=any(v_items) order by id limit 2001 for update;
 select coalesce(array_agg(id),'{}') into v_subitems from (select id from rakeezx.score_subitems where owner_id=p_owner and item_id=any(v_items) order by id limit 2001) x;
 if cardinality(v_subitems)>2000 then raise exception 'n88_projection_bound';end if;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,status from rakeezx.years where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=0;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,start_date,end_date from rakeezx.terms where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=1;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,year_id,status,archived_at,grade,label,name from rakeezx.sections where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=2;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,status,name from rakeezx.students where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=3;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,section_id,status,start_date,end_date from rakeezx.enrollments where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=4;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,section_id,term_id,subject_id from rakeezx.teachings where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=5;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,name,max,"order",auto,per_point,penalty,score_mode,portability_group_id from rakeezx.items where owner_id=p_owner and (true) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=6;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,item_id,value,manual_value,derived_value from rakeezx.scores where owner_id=p_owner and (student_id=any(v_students) and item_id=any(v_items)) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=7;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,item_id,name,value,"order",start_date,due_date,late_points from rakeezx.score_subitems where owner_id=p_owner and (item_id=any(v_items)) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=8;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,subitem_id,checked,completion_state from rakeezx.score_subitem_completions where owner_id=p_owner and (student_id=any(v_students) and subitem_id=any(v_subitems)) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=9;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,teaching_id,date,status from rakeezx.sessions where owner_id=p_owner and (teaching_id=any(v_teachings)) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=10;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,session_id,status from rakeezx.attendance where owner_id=p_owner and (student_id=any(v_students) and teaching_id=any(v_teachings)) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=11;return next;
select count(*)::integer,coalesce(json_agg(x)::text,'[]') into v_count,payload from (select id,owner_id,revision::text as revision,deleted_at,student_id,teaching_id,kind,delta from rakeezx.logs where owner_id=p_owner and (teaching_id=any(v_teachings)) order by id limit 2001 for update) x;
 v_bytes:=v_bytes+octet_length(payload);
 if v_count>2000 or v_bytes>2097152 then raise exception 'n88_projection_bound';end if;
 table_index:=12;return next;
exception when others or query_canceled or assert_failure then
 get stacked diagnostics state=returned_sqlstate;
 raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_guidance$;
revoke all on function n88_private.boundary_guidance_sources_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_guidance_sources_v1(uuid,text,text) to n88_backend;
grant create on schema n88_private to n88_guard;
grant n88_guard to postgres with set true;
alter function n88_private.boundary_guidance_sources_v1(uuid,text,text) owner to n88_guard;
grant n88_guard to postgres with set false;
revoke create on schema n88_private from n88_guard;
create function n88_private.boundary_fe813d4f5db3d68913a8d78d(p1 text,p2 text,p3 text) returns table(table_index integer,payload text)
language plpgsql security invoker set search_path=pg_catalog as $n88_wire$
declare state text;
begin
 return query select * from n88_private.boundary_guidance_sources_v1(convert_from(decode(p1,'base64'),'UTF8')::uuid,convert_from(decode(p2,'base64'),'UTF8'),convert_from(decode(p3,'base64'),'UTF8'));
exception when others or query_canceled or assert_failure then
 get stacked diagnostics state=returned_sqlstate;
 raise exception using errcode=state,message='n88_private_database_error',detail='',hint='';
end;
$n88_wire$;
revoke all on function n88_private.boundary_fe813d4f5db3d68913a8d78d(text,text,text) from public,anon,authenticated;
grant execute on function n88_private.boundary_fe813d4f5db3d68913a8d78d(text,text,text) to n88_backend;
commit;
