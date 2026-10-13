-- N77 explicit create starts a fresh generation; tombstones/receipts stay intact.
-- Replace only the public creation RPC, inlining its read-back 0016 body and
-- retaining the 0029 owner lock. CREATE OR REPLACE preserves its existing ACL.
begin;
set local lock_timeout = '10s';
alter table rakeezx.teachings drop constraint teachings_natural_uniq;
create unique index teachings_natural_uniq on rakeezx.teachings(owner_id,section_id,subject_id,term_id) where deleted_at is null;

create or replace function rakeezx.apply_sync_v2_teaching_creation_command(
  p_mutation_id text, p_device_id text, p_teaching_id text, p_section_id text, p_subject_id text, p_term_id text,
  p_order integer, p_item_ids jsonb default '[]'::jsonb, p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_section rakeezx.sections%rowtype; v_teaching rakeezx.teachings%rowtype; v_envelope jsonb; v_result jsonb; v_items jsonb;
  v_defaults jsonb := '[
    {"name":"المشاركة والتفاعل","max":10,"auto":"participation","perPoint":1,"penalty":1},
    {"name":"الواجبات","max":10,"auto":null,"perPoint":1,"penalty":1},
    {"name":"الأنشطة والمشاريع","max":20,"auto":null,"perPoint":1,"penalty":1},
    {"name":"الاختبارات القصيرة","max":20,"auto":null,"perPoint":1,"penalty":1},
    {"name":"الاختبار النهائي","max":40,"auto":null,"perPoint":1,"penalty":1}
  ]'::jsonb;
  v_index integer; v_default jsonb; v_item_id text;
begin
  if v_owner is null then raise exception using errcode='42501', message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or coalesce(p_device_id,'')='' or coalesce(p_teaching_id,'')='' or
    coalesce(p_section_id,'')='' or coalesce(p_subject_id,'')='' or coalesce(p_term_id,'')='' or
    p_order is null or jsonb_typeof(p_item_ids) <> 'array' or jsonb_array_length(p_item_ids) <> 5 then
    raise exception using errcode='22023', message='Invalid Sync V2 teaching creation command';
  end if;
  perform rakeezx.lock_student_lifecycle(v_owner);
  v_envelope := jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,'teachingId',p_teaching_id,
    'sectionId',p_section_id,'subjectId',p_subject_id,'termId',p_term_id,'order',p_order,'itemIds',p_item_ids,'clientUpdatedAt',p_client_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Mutation ID was reused with a different request'; end if; return v_receipt.result; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':teaching:'||p_section_id||':'||p_subject_id||':'||p_term_id,0));
  select * into v_section from rakeezx.sections where owner_id=v_owner and id=p_section_id and deleted_at is null for update;
  if not found then raise exception using errcode='22023',message='Teaching section is unavailable'; end if;
  if v_section.status<>'active' or not exists(select 1 from rakeezx.years where owner_id=v_owner and id=v_section.year_id and deleted_at is null and status<>'archived') then
    raise exception using errcode='22023',message='Teaching year or section is unavailable'; end if;
  perform 1 from rakeezx.subjects where owner_id=v_owner and id=p_subject_id and deleted_at is null for update;
  if not found then raise exception using errcode='22023',message='Teaching subject is unavailable'; end if;
  perform 1 from rakeezx.terms where owner_id=v_owner and id=p_term_id and year_id=v_section.year_id and status<>'closed' and deleted_at is null for update;
  if not found then raise exception using errcode='22023',message='Teaching term is unavailable'; end if;
  -- Receipt replay above is exact; a new command cannot name a retired identity.
  if exists(select 1 from rakeezx.teachings where owner_id=v_owner and id=p_teaching_id and deleted_at is not null) then
    raise exception using errcode='22023',message='Teaching tombstone cannot be recreated'; end if;
  if exists(select 1 from rakeezx.teachings where owner_id=v_owner and id=p_teaching_id and
    (section_id<>p_section_id or subject_id<>p_subject_id or term_id<>p_term_id)) then
    raise exception using errcode='22023',message='Teaching identity scope mismatch'; end if;
  select * into v_teaching from rakeezx.teachings where owner_id=v_owner and deleted_at is null and section_id=p_section_id and subject_id=p_subject_id and term_id=p_term_id for update;
  if not found then
    insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id,"order",client_updated_at,device_id)
      values(v_owner,p_teaching_id,p_section_id,p_subject_id,p_term_id,p_order,p_client_updated_at,p_device_id) returning * into v_teaching;
  end if;
  for v_index in 0..4 loop
    v_default := v_defaults->v_index; v_item_id := p_item_ids->>v_index;
    if coalesce(v_item_id,'')='' then raise exception using errcode='22023',message='Invalid default item identity'; end if;
    if not exists (select 1 from rakeezx.items where owner_id=v_owner and teaching_id=v_teaching.id and "order"=v_index and deleted_at is null) then
      insert into rakeezx.items(owner_id,id,teaching_id,name,max,"order",auto,per_point,penalty,client_updated_at,device_id)
      values(v_owner,v_item_id,v_teaching.id,v_default->>'name',(v_default->>'max')::integer,v_index,
        v_default->>'auto',(v_default->>'perPoint')::integer,(v_default->>'penalty')::integer,p_client_updated_at,p_device_id);
    end if;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(i) order by i."order"),'[]'::jsonb) into v_items from rakeezx.items i where owner_id=v_owner and teaching_id=v_teaching.id and deleted_at is null;
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'outcome','applied','canonicalTeaching',to_jsonb(v_teaching),'items',v_items);
  insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
    values(v_owner,p_mutation_id,'teachings',p_teaching_id,p_device_id,0,'create_teaching',p_client_updated_at,'{}'::jsonb,v_envelope,'applied',array['__create__']::text[],array[]::text[],v_result);
  return v_result;
end; $$;

commit;
