-- AI: N58 bounded additive empty-account foundation repair. No backfill.
begin;
set local lock_timeout = '10s';
do $$ declare v_table text; begin
  if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='rakeezx.apply_sync_v2_mutation(text,text,text,text,bigint,jsonb,text,bigint)'::regprocedure) is distinct from 'a6284ed21c86f1cafcac2d4d84a5fadc'
  or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='rakeezx.n58_guard_calendar_contract()'::regprocedure) is distinct from '6fc9fcdf35f78d0ae295fe61a833f70d'
  or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='rakeezx.lock_student_lifecycle(uuid)'::regprocedure) is distinct from 'de3fb7821244d83ebc0be45b0247ce22' then
    raise exception 'N58_REPAIR_DEFINITION_DRIFT';
  end if;
  foreach v_table in array array['years','terms','calendars','calendar_days','sections','teachings','students','enrollments','sessions','slots','items','scores','attendance','logs','notes','session_roster_snapshots','closed_term_reports','class_rules','class_goals','class_charter_selections','group_arrangements','assignments','submissions'] loop
   if not exists(select 1 from pg_trigger where tgrelid=('rakeezx.'||v_table)::regclass
     and tgname='00_student_lifecycle_statement_lock' and tgenabled='O'
     and tgfoid='rakeezx.lock_student_lifecycle_statement()'::regprocedure and tgtype=30) then raise exception 'N58_REPAIR_WRITER_LOCK_DRIFT: %',v_table; end if;
  end loop;
  if to_regclass('rakeezx.n58_foundation_repair_receipts') is not null
    or to_regprocedure('rakeezx.review_n58_empty_foundation(jsonb)') is not null
    or to_regprocedure('rakeezx.apply_n58_empty_foundation(text,jsonb)') is not null then
    raise exception 'N58_REPAIR_ALREADY_INSTALLED';
  end if;
end $$;

create table rakeezx.n58_foundation_repair_receipts (
  owner_id uuid not null references auth.users(id),
  repair_id text not null check(repair_id ~ '^[a-f0-9-]{36}$'),
  plan jsonb not null check(octet_length(plan::text)<=32768),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(owner_id,repair_id)
);
alter table rakeezx.n58_foundation_repair_receipts enable row level security;
alter table rakeezx.n58_foundation_repair_receipts force row level security;
revoke all on rakeezx.n58_foundation_repair_receipts from public,anon,authenticated;

-- Pure release-owned definitions: stable identities from the original catalog.
create function rakeezx.n58_repair_expected(p_preset text) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if p_preset not in ('sa-western-1448-1449','sa-general-1448-1449') or p_preset is null then raise exception 'N58_REPAIR_UNSUPPORTED_PRESET'; end if;
 return jsonb_build_object('year',jsonb_build_object('label','1448–1449 هـ','hijri_start',1448,'hijri_end',1449,'order',1448,'status','active'),
 'terms',jsonb_build_array(
 jsonb_build_object('year_id','y:1448-1449','calendar_id',null,'index',1,'name','الفصل الدراسي الأول','start_date',case when p_preset='sa-general-1448-1449' then '2026-08-23' else '2026-08-30' end,'end_date','2027-01-07','status','active'),
 jsonb_build_object('year_id','y:1448-1449','calendar_id',null,'index',2,'name','الفصل الدراسي الثاني','start_date','2027-01-17','end_date',case when p_preset='sa-general-1448-1449' then '2027-06-24' else '2027-07-01' end,'status','upcoming')));
end $$;
revoke all on function rakeezx.n58_repair_expected(text) from public,anon,authenticated;

create function rakeezx.n58_repair_snapshot(p_owner uuid,p_preset text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_table text; v_has boolean; v_year jsonb; v_terms jsonb; v_expected jsonb; v_row jsonb; v_index integer;
begin
 -- No deleted_at filter: tombstones are content/history too. All creation paths
 -- are serialized by the existing owner mutex or depend on a locked parent.
 foreach v_table in array array['sections','teachings','students','enrollments','sessions','slots','items','scores','attendance','logs','notes','session_roster_snapshots','closed_term_reports','class_rules','class_goals','class_charter_selections','group_arrangements','assignments','submissions','score_subitems','score_subitem_completions'] loop
  execute format('select exists(select 1 from rakeezx.%I where owner_id=$1)',v_table) into v_has using p_owner;
  if v_has then raise exception using errcode='22023',message='N58_REPAIR_ACCOUNT_NOT_EMPTY',detail=v_table; end if;
 end loop;
 if exists(select 1 from rakeezx.calendars where owner_id=p_owner) or exists(select 1 from rakeezx.calendar_days where owner_id=p_owner) then raise exception 'N58_REPAIR_CUSTOM_OR_CALENDAR_HISTORY'; end if;
 v_expected:=rakeezx.n58_repair_expected(p_preset);
 select coalesce(jsonb_agg(to_jsonb(y) order by id),'[]') into v_year from rakeezx.years y where owner_id=p_owner;
 select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') into v_terms from rakeezx.terms t where owner_id=p_owner;
 if jsonb_array_length(v_year)>1 or jsonb_array_length(v_terms)>2 then raise exception 'N58_REPAIR_AMBIGUOUS_ACADEMIC_HISTORY'; end if;
 if jsonb_array_length(v_year)=1 then
  v_row:=v_year->0;
  if v_row->>'id'<>'y:1448-1449' or v_row->>'deleted_at' is not null or not v_row @> (v_expected->'year')
    or (v_row->>'calendar_preset_id' is not null and v_row->>'calendar_preset_id'<>p_preset) then raise exception 'N58_REPAIR_CUSTOM_YEAR'; end if;
 end if;
 for v_row in select value from jsonb_array_elements(v_terms) loop
  v_index:=(v_row->>'index')::integer;
  if v_index not in (1,2) or v_row->>'id'<>'tm:y:1448-1449:'||v_index or v_row->>'deleted_at' is not null
    or not v_row @> (v_expected->'terms'->(v_index-1)) then raise exception 'N58_REPAIR_CUSTOM_TERM'; end if;
 end loop;
 return jsonb_build_object('years',v_year,'terms',v_terms,'calendars','[]'::jsonb,'calendarDays','[]'::jsonb);
end $$;
revoke all on function rakeezx.n58_repair_snapshot(uuid,text) from public,anon,authenticated;

create function rakeezx.review_n58_empty_foundation(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_snapshot jsonb;
begin
 if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>4096
   or p_request->>'ownerId' is distinct from v_owner::text or p_request->>'version' is distinct from 'N58_EMPTY_V1'
   or p_request->>'originalDigest' !~ '^[a-f0-9]{64}$' or p_request->>'originalDigest' is null
   or p_request->>'rootMutationId' !~ '^[a-f0-9-]{36}$' or p_request->>'rootMutationId' is null
   or (select count(*) from jsonb_object_keys(p_request))<>5 then raise exception 'N58_REPAIR_INVALID_REQUEST'; end if;
 perform rakeezx.lock_student_lifecycle(v_owner);
 v_snapshot:=rakeezx.n58_repair_snapshot(v_owner,p_request->>'presetId');
 return jsonb_build_object('protocol','N58_EMPTY_V1','ownerId',v_owner,'request',p_request,'snapshot',v_snapshot,
  'snapshotDigest',encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex'));
end $$;
revoke all on function rakeezx.review_n58_empty_foundation(jsonb) from public,anon;
grant execute on function rakeezx.review_n58_empty_foundation(jsonb) to authenticated;

create function rakeezx.apply_n58_empty_foundation(p_repair_id text,p_plan jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_prior rakeezx.n58_foundation_repair_receipts%rowtype;
 v_fresh jsonb; v_expected jsonb; v_result jsonb; v_results jsonb:='[]'; v_year jsonb; v_index integer; v_term jsonb; v_preset text;
begin
 if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if p_repair_id is null or p_repair_id !~ '^[a-f0-9-]{36}$' or jsonb_typeof(p_plan) is distinct from 'object'
   or octet_length(p_plan::text)>32768 or p_plan->>'ownerId' is distinct from v_owner::text then raise exception 'N58_REPAIR_INVALID_PLAN'; end if;
 perform rakeezx.lock_student_lifecycle(v_owner);
 select * into v_prior from rakeezx.n58_foundation_repair_receipts where owner_id=v_owner and repair_id=p_repair_id;
 if found then
  if v_prior.plan is distinct from p_plan then raise exception 'N58_REPAIR_ID_REUSED'; end if;
  return v_prior.result; -- before rechecking later legitimate school additions
 end if;
 v_fresh:=rakeezx.review_n58_empty_foundation(p_plan->'request');
 if v_fresh is distinct from p_plan then raise exception 'N58_REPAIR_STALE_PLAN'; end if;
 v_preset:=p_plan->'request'->>'presetId';v_expected:=rakeezx.n58_repair_expected(v_preset);
 if jsonb_array_length(p_plan->'snapshot'->'years')=0 then
  v_result:=rakeezx.apply_sync_v2_mutation('years','y:1448-1449',p_repair_id||':year',p_repair_id,0,v_expected->'year','create',null);
  if v_result->>'outcome'<>'applied' then raise exception 'N58_REPAIR_YEAR_NOT_APPLIED'; end if;
  v_results:=v_results||jsonb_build_array(v_result);
 end if;
 for v_index in 1..2 loop
  if not exists(select 1 from rakeezx.terms where owner_id=v_owner and id='tm:y:1448-1449:'||v_index) then
   v_result:=rakeezx.apply_sync_v2_mutation('terms','tm:y:1448-1449:'||v_index,p_repair_id||':term'||v_index,p_repair_id,0,v_expected->'terms'->(v_index-1),'create',null);
   if v_result->>'outcome'<>'applied' then raise exception 'N58_REPAIR_TERM_NOT_APPLIED'; end if;
   v_results:=v_results||jsonb_build_array(v_result);
  end if;
 end loop;
 select to_jsonb(y) into v_year from rakeezx.years y where owner_id=v_owner and id='y:1448-1449';
 if v_year->>'calendar_preset_id' is distinct from v_preset then
  v_result:=rakeezx.apply_sync_v2_mutation('years','y:1448-1449',p_repair_id||':select',p_repair_id,(v_year->>'revision')::bigint,jsonb_build_object('calendar_preset_id',v_preset),'patch',null);
  if v_result->>'outcome'<>'applied' then raise exception 'N58_REPAIR_SELECTION_NOT_APPLIED'; end if;
  v_results:=v_results||jsonb_build_array(v_result);
 end if;
 v_result:=jsonb_build_object('protocol','N58_EMPTY_V1','ownerId',v_owner,'repairId',p_repair_id,
  'planDigest',encode(sha256(convert_to(p_plan::text,'UTF8')),'hex'),
  'canonical',rakeezx.n58_repair_snapshot(v_owner,v_preset),'mutationReceipts',v_results);
 insert into rakeezx.n58_foundation_repair_receipts(owner_id,repair_id,plan,result) values(v_owner,p_repair_id,p_plan,v_result);
 return v_result;
end $$;
revoke all on function rakeezx.apply_n58_empty_foundation(text,jsonb) from public,anon;
grant execute on function rakeezx.apply_n58_empty_foundation(text,jsonb) to authenticated;
commit;
