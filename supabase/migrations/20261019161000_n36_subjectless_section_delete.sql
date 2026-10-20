-- AI N36: new section-only API; existing teaching Delete remains immutable.
-- Explicit activated-card filename; one append-only migration, no new tables.
begin;
set local lock_timeout='10s';
create function rakeezx.n36_delete_subjectless_section(
 p_section_id text,p_year_id text,p_term_id text,p_expected_fingerprint text default null,
 p_mutation_id text default null,p_device_id text default null,p_commit boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_owner uuid:=auth.uid(); v_section rakeezx.sections%rowtype;
 v_year rakeezx.years%rowtype; v_term rakeezx.terms%rowtype;
 v_receipt rakeezx.sync_mutation_receipts%rowtype;
 v_envelope jsonb; v_result jsonb; v_fingerprint text; v_ids text[];
 v_enrollments text[]; v_orphans text[]:='{}'::text[];
 v_scope text:='section'; v_now timestamptz:=pg_catalog.clock_timestamp();
begin
 if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if p_commit is null or coalesce(p_section_id,'')='' or coalesce(p_year_id,'')='' or coalesce(p_term_id,'')=''
 or greatest(char_length(p_section_id),char_length(p_year_id),char_length(p_term_id))>240 then
  raise exception using errcode='22023',message='Invalid N36 target'; end if;
 -- Same first lock as public lifecycle RPC wrappers and statement triggers.
 perform rakeezx.lock_student_lifecycle(v_owner);
 if p_commit then
  if coalesce(p_mutation_id,'')='' or coalesce(p_device_id,'')='' or coalesce(p_expected_fingerprint,'')=''
   or greatest(char_length(p_mutation_id),char_length(p_device_id))>200 or p_expected_fingerprint !~ '^[a-f0-9]{32}$' then
   raise exception using errcode='22023',message='Invalid N36 envelope'; end if;
  v_envelope:=pg_catalog.jsonb_build_object('protocol','N36_SECTION_DELETE_V1','sectionId',p_section_id,'yearId',p_year_id,
   'termId',p_term_id,'fingerprint',p_expected_fingerprint,'mutationId',p_mutation_id,'deviceId',p_device_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
   if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Mutation ID reused'; end if;
   return v_receipt.result;
  end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':section-lifecycle:'||p_section_id,0));
 select * into v_section from rakeezx.sections where owner_id=v_owner and id=p_section_id for update;
 if not found or v_section.deleted_at is not null or v_section.status<>'active' or v_section.year_id<>p_year_id then
  raise exception using errcode='22023',message='N36 scope stale'; end if;
 select * into v_year from rakeezx.years where owner_id=v_owner and id=p_year_id for share;
 if not found or v_year.deleted_at is not null or v_year.status<>'active' then raise exception using errcode='22023',message='N36 year unavailable'; end if;
 select * into v_term from rakeezx.terms where owner_id=v_owner and id=p_term_id and year_id=p_year_id for share;
 if not found or v_term.deleted_at is not null or v_term.status<>'active' then raise exception using errcode='22023',message='N36 term unavailable'; end if;
 if exists(select 1 from rakeezx.teachings where owner_id=v_owner and section_id=p_section_id and deleted_at is null) then
  raise exception using errcode='22023',message='N36 section has teaching'; end if;
 select coalesce(pg_catalog.array_agg(id order by id),'{}'::text[]) into v_ids from rakeezx.teachings where owner_id=v_owner and section_id=p_section_id;
 select coalesce(pg_catalog.array_agg(id order by id),'{}'::text[]) into v_enrollments from rakeezx.enrollments where owner_id=v_owner and section_id=p_section_id and deleted_at is null;
 select pg_catalog.md5(pg_catalog.jsonb_build_object('owner',v_owner,'section',pg_catalog.to_jsonb(v_section),'year',pg_catalog.to_jsonb(v_year),'term',pg_catalog.to_jsonb(v_term),
 'teachings',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.id),'[]'::jsonb) from rakeezx.teachings t where t.owner_id=v_owner and t.section_id=p_section_id),
 'enrollments',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.id),'[]'::jsonb) from rakeezx.enrollments e where e.owner_id=v_owner and e.section_id=p_section_id))::text) into v_fingerprint;
 if p_commit and p_expected_fingerprint<>v_fingerprint then raise exception using errcode='22023',message='N36 scope stale'; end if;
 v_result:=pg_catalog.jsonb_build_object('protocol','N36_SECTION_DELETE_V1','ownerId',v_owner,'sectionId',p_section_id,'yearId',p_year_id,'termId',p_term_id,
 'scope','section','selectedTeachingId',null,'teachingIds','[]'::jsonb,'cascadeTeachingIds',pg_catalog.to_jsonb(v_ids),'enrollmentIds',pg_catalog.to_jsonb(v_enrollments),'fingerprint',v_fingerprint);
 if not p_commit then return v_result; end if;
 -- Normal N77 descendant tombstones; preserve every pupil and immutable report.
  perform pg_catalog.set_config('rakeezx.section_lifecycle_delete','on',true);
  perform pg_catalog.set_config('rakeezx.score_domain_write','on',true);
  -- Descendants first. Every update and receipt shares this RPC transaction.
  update rakeezx.score_subitem_completions c set deleted_at=v_now,device_id=p_device_id
    where c.owner_id=v_owner and c.deleted_at is null and (
      c.subitem_id in (select si.id from rakeezx.score_subitems si join rakeezx.items i
        on i.owner_id=si.owner_id and i.id=si.item_id where si.owner_id=v_owner and i.teaching_id=any(v_ids))
      or c.student_id=any(v_orphans));
  update rakeezx.score_subitems si set deleted_at=v_now,device_id=p_device_id
    where si.owner_id=v_owner and si.deleted_at is null and si.item_id in
      (select id from rakeezx.items where owner_id=v_owner and teaching_id=any(v_ids));
  update rakeezx.scores s set deleted_at=v_now,device_id=p_device_id
    where s.owner_id=v_owner and s.deleted_at is null and (s.student_id=any(v_orphans) or s.item_id in
      (select id from rakeezx.items where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.attendance a set deleted_at=v_now,device_id=p_device_id
    where a.owner_id=v_owner and a.deleted_at is null and (a.student_id=any(v_orphans) or
      a.teaching_id=any(v_ids) or a.session_id in
      (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.session_roster_snapshots s set deleted_at=v_now,device_id=p_device_id
    where s.owner_id=v_owner and s.deleted_at is null and (s.teaching_id=any(v_ids) or
      s.session_id in (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)) or
      (v_scope='section' and s.section_id=v_section.id));
  update rakeezx.logs l set deleted_at=v_now,device_id=p_device_id
    where l.owner_id=v_owner and l.deleted_at is null and (l.student_id=any(v_orphans) or
      l.teaching_id=any(v_ids) or l.session_id in
      (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.notes n set deleted_at=v_now,device_id=p_device_id
    where n.owner_id=v_owner and n.deleted_at is null and (n.student_id=any(v_orphans) or
      n.teaching_id=any(v_ids) or n.session_id in
      (select id from rakeezx.sessions where owner_id=v_owner and teaching_id=any(v_ids)));
  update rakeezx.class_goals set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.class_charter_selections set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.group_arrangements set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.class_rules set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.slots set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.sessions set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.items set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and teaching_id=any(v_ids);
  update rakeezx.teachings set deleted_at=v_now,device_id=p_device_id
    where owner_id=v_owner and deleted_at is null and id=any(v_ids);
  if true then
    update rakeezx.enrollments set deleted_at=v_now,device_id=p_device_id
      where owner_id=v_owner and deleted_at is null and section_id=v_section.id;
    update rakeezx.students set deleted_at=v_now,device_id=p_device_id
      where owner_id=v_owner and deleted_at is null and id=any(v_orphans);
    update rakeezx.sections set deleted_at=v_now,device_id=p_device_id
      where owner_id=v_owner and deleted_at is null and id=v_section.id;
  end if;

 v_result:=v_result||pg_catalog.jsonb_build_object('mutationId',p_mutation_id,'outcome','deleted','orphanStudentIds','[]'::jsonb);
 insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,
 request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
 values(v_owner,p_mutation_id,'lifecycle',p_section_id,p_device_id,v_section.revision,'lifecycle','{}'::jsonb,v_envelope,'deleted',array['__deleted__']::text[],'{}'::text[],v_result);
 return v_result;
end; $$;
revoke all on function rakeezx.n36_delete_subjectless_section(text,text,text,text,text,text,boolean) from public,anon;
grant execute on function rakeezx.n36_delete_subjectless_section(text,text,text,text,text,text,boolean) to authenticated;
commit;
