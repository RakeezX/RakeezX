-- AI: inactive exact writer-owned helpers. No browser/backend execution grant.
create function n88_private.v2_writer_capture_1031(p_owner uuid,p_entity text,p_id text,p_old jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare result jsonb; teaching text;
begin
 if p_owner is distinct from auth.uid() or p_entity not in ('items','score_subitems') or p_old->>'id' is distinct from p_id then raise exception 'n88_writer_capture';end if;
 if p_entity='items' then teaching:=p_old->>'teaching_id';
 else select teaching_id into strict teaching from rakeezx.items where owner_id=p_owner and id=p_old->>'item_id' for update;end if;
 select coalesce(jsonb_agg(jsonb_build_object('scope',s.scope_key,'family',q.family,'id',q.id,'parent',q.parent,'revision',q.revision) order by s.scope_key,q.family,q.id),'[]'::jsonb) into result
 from n88_private.publication_v2_scopes s cross join lateral (
 select 'items'::text as family,p_id as id,p_id as parent,(p_old->>'revision')::bigint as revision where p_entity='items'
 union all select 'scoreSubitems',d.id,d.item_id,d.revision from rakeezx.score_subitems d where d.owner_id=p_owner and
 (p_entity='items' and d.item_id=p_id or p_entity='score_subitems' and d.id=p_id)
 ) q where s.owner_id=p_owner and s.payload->'scope'->>'teachingId'=teaching;
 if jsonb_array_length(result)>8000 or octet_length(result::text)>2097152 then raise exception 'n88_writer_capture_budget';end if;
 return result;
end $$;

create function n88_private.v2_writer_delete_children_1031(p_owner uuid,p_entity text,p_id text) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare dependency record; has_live boolean; inspected integer:=0;
begin
 if p_owner is distinct from auth.uid() then raise exception 'n88_writer_owner';end if;
 -- Higher-level lifecycle commands must delete their genuine dependencies first.
 -- Reject generic parent-only deletions rather than inventing a domain cascade.
 if p_entity in ('items','score_subitems') then
  -- The accepted source deletion is one atomic score-domain removal. No score
  -- value, rounding, manual/derived algorithm or existing trigger is rewritten.
  perform set_config('rakeezx.score_domain_write','on',true);
  update rakeezx.score_subitem_completions c set deleted_at=clock_timestamp() where c.owner_id=p_owner and c.deleted_at is null and exists(
   select 1 from rakeezx.score_subitems d where d.owner_id=p_owner and c.subitem_id=d.id and (p_entity='items' and d.item_id=p_id or p_entity='score_subitems' and d.id=p_id));
  if p_entity='items' then
   update rakeezx.score_subitems set deleted_at=clock_timestamp() where owner_id=p_owner and item_id=p_id and deleted_at is null;
   update rakeezx.scores set deleted_at=clock_timestamp() where owner_id=p_owner and item_id=p_id and deleted_at is null;
  end if;
 end if;
  for dependency in
   select n.nspname,c.relname,a.attname,
    exists(select 1 from pg_attribute d where d.attrelid=c.oid and d.attname='deleted_at' and not d.attisdropped) as soft_delete
   from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace
   cross join lateral unnest(f.confkey,f.conkey) keys(parent_key,child_key)
   join pg_attribute parent_col on parent_col.attrelid=f.confrelid and parent_col.attnum=keys.parent_key
   join pg_attribute a on a.attrelid=c.oid and a.attnum=keys.child_key
   where f.contype='f' and f.confrelid=to_regclass(format('rakeezx.%I',p_entity)) and n.nspname='rakeezx' and parent_col.attname='id'
    and exists(select 1 from pg_attribute o where o.attrelid=c.oid and o.attname='owner_id' and not o.attisdropped)
  loop
   inspected:=inspected+1;if inspected>128 then raise exception 'n88_dependency_budget';end if;
   execute format('select exists(select 1 from %I.%I where owner_id=$1 and %I=$2%s)',dependency.nspname,dependency.relname,dependency.attname,case when dependency.soft_delete then ' and deleted_at is null' else '' end) into has_live using p_owner,p_id;
   if has_live then raise exception 'n88_parent_has_live_children';end if;
  end loop;

end $$;

create function n88_private.v2_writer_finalize_domain_1031(p_owner uuid,p_entity text,p_id text) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare parent text; pupil text; n integer:=0; previous_flag text:=current_setting('rakeezx.score_domain_write',true);
begin
 if p_owner is distinct from auth.uid() then raise exception 'n88_writer_owner';end if;
 if p_entity='score_subitems' then
  select item_id into strict parent from rakeezx.score_subitems where owner_id=p_owner and id=p_id;
  for pupil in select distinct student_id from rakeezx.scores where owner_id=p_owner and item_id=parent and deleted_at is null loop
   n:=n+1;if n>2000 then raise exception 'n88_writer_score_budget';end if;
   perform rakeezx.recompute_subitem_score(p_owner,parent,pupil,'n88-source-delete');
  end loop;
 end if;
 perform set_config('rakeezx.score_domain_write',coalesce(previous_flag,''),true);
end $$;

create function n88_private.v2_writer_complete_1031(p_owner uuid,p_capture jsonb,p_deleted boolean) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare r jsonb; current_revision bigint; gone boolean;
begin
 if p_owner is distinct from auth.uid() or jsonb_typeof(p_capture)<>'array' then raise exception 'n88_writer_owner';end if;
 for r in select value from jsonb_array_elements(p_capture) loop
  if r->>'family'='items' then select revision,deleted_at is not null into strict current_revision,gone from rakeezx.items where owner_id=p_owner and id=r->>'id';
  else select revision,deleted_at is not null into strict current_revision,gone from rakeezx.score_subitems where owner_id=p_owner and id=r->>'id';end if;
  if p_deleted then
   if not gone then raise exception 'n88_writer_incomplete_child_delete';end if;
   perform n88_private.publication_v2_retire_source(p_owner,r->>'scope',r->>'family',r->>'id',current_revision);
  else
   -- Accepted definition edit invalidates publication decisions, not receipts.
   update n88_private.publication_v2_items set publication_revision=publication_revision+1,
    payload=payload||jsonb_build_object('publicationRevision',publication_revision+1,'decisions',jsonb_build_object('required',false,'scheduled',false,'completed',false,'grade',false))
    where owner_id=p_owner and scope_key=r->>'scope' and not tombstone and
    (r->>'family'='items' and row_id::jsonb->>1=r->>'id' or r->>'family'='scoreSubitems' and row_id::jsonb->>0='subitem' and row_id::jsonb->>2=r->>'id');
   update n88_private.publication_v2_scopes set store_revision=store_revision+1 where owner_id=p_owner and scope_key=r->>'scope';
  end if;
 end loop;
end $$;
revoke all on function n88_private.v2_writer_capture_1031(uuid,text,text,jsonb),n88_private.v2_writer_delete_children_1031(uuid,text,text),n88_private.v2_writer_finalize_domain_1031(uuid,text,text),n88_private.v2_writer_complete_1031(uuid,jsonb,boolean) from public,anon,authenticated,n88_backend;
