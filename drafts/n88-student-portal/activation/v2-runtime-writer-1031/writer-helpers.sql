-- AI: N88-only observation. No canonical writes, grade overrides or admission policy.
create function n88_private.v2_writer_lock_1031() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$begin
 perform pg_advisory_xact_lock(1312307256,88);return null;
end $$;

create function n88_private.v2_writer_retire_1031(p_owner uuid,p_scope text,p_item text,p_subitem text,p_revision bigint) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare teaching text;
begin
 select payload->'scope'->>'teachingId' into strict teaching from n88_private.publication_v2_scopes where owner_id=p_owner and scope_key=p_scope;
 insert into n88_private.publication_v2_high_water(owner_id,scope_key,source_key,canonical_revision,retired)
 select p_owner,p_scope,key,max(rev),true from (
  select 'items:'||i.id as key,i.revision as rev from rakeezx.items i where i.owner_id=p_owner and i.teaching_id=teaching and p_subitem is null and (p_item is null or i.id=p_item)
  union all select 'scoreSubitems:'||d.id,d.revision from rakeezx.score_subitems d where d.owner_id=p_owner and (p_subitem is null or d.id=p_subitem) and
   (p_item is not null and d.item_id=p_item or p_item is null and exists(select 1 from rakeezx.items i where i.owner_id=p_owner and i.id=d.item_id and i.teaching_id=teaching))
  union all select case when p_subitem is null then 'items:'||p_item else 'scoreSubitems:'||p_subitem end,greatest(p_revision,1) where p_item is not null
 ) sources group by key
 on conflict(owner_id,scope_key,source_key) do update set canonical_revision=greatest(publication_v2_high_water.canonical_revision,excluded.canonical_revision),retired=true;
 update n88_private.publication_v2_high_water set retired=true where owner_id=p_owner and scope_key=p_scope and p_item is null;
 update n88_private.publication_v2_items set publication_revision=publication_revision+1,tombstone=true,
  payload=payload||jsonb_build_object('publicationRevision',publication_revision+1,'tombstone',true,'decisions',jsonb_build_object('required',false,'scheduled',false,'completed',false,'grade',false))
 where owner_id=p_owner and scope_key=p_scope and not tombstone and (p_item is null or
  p_subitem is null and row_id::jsonb->>1=p_item or p_subitem is not null and row_id::jsonb->>0='subitem' and row_id::jsonb->>2=p_subitem);
 update n88_private.publication_v2_scopes set store_revision=store_revision+1,
  payload=case when p_item is null then jsonb_set(payload,'{manualTasks}','[]'::jsonb) else payload end
 where owner_id=p_owner and scope_key=p_scope;
end $$;

create function n88_private.v2_writer_after_1031() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb;v_owner uuid;source text;parent text;teaching text;s record;revision bigint;
begin
 if tg_table_schema<>'rakeezx' or tg_table_name not in ('items','score_subitems','teachings','sections','terms','years','subjects') then raise exception 'n88_invalid_trigger_binding';end if;
 r:=to_jsonb(old);
 if tg_op='UPDATE' then
  if r->>'deleted_at' is not null or to_jsonb(new)->>'deleted_at' is null then return new;end if;
  revision:=(to_jsonb(new)->>'revision')::bigint;
 else revision:=(r->>'revision')::bigint;end if;
 v_owner:=(r->>'owner_id')::uuid;source:=r->>'id';
 if tg_table_name='items' then parent:=source;teaching:=r->>'teaching_id';
 elsif tg_table_name='score_subitems' then parent:=r->>'item_id';select teaching_id into teaching from rakeezx.items where owner_id=v_owner and id=parent;end if;
 for s in select scope_key from n88_private.publication_v2_scopes v where v.owner_id=v_owner and
  case tg_table_name
   when 'items' then v.payload->'scope'->>'teachingId'=teaching
   when 'score_subitems' then v.payload->'scope'->>'teachingId'=teaching or exists(select 1 from n88_private.publication_v2_items p where p.owner_id=v_owner and p.scope_key=v.scope_key and p.row_id::jsonb->>1=parent)
   when 'teachings' then v.payload->'scope'->>'teachingId'=source
   when 'sections' then v.payload->'scope'->>'sectionId'=source
   when 'terms' then v.payload->'scope'->>'termId'=source
   when 'subjects' then v.payload->'scope'->>'subjectId'=source
   when 'years' then exists(select 1 from rakeezx.terms t where t.owner_id=v_owner and t.id=v.payload->'scope'->>'termId' and t.year_id=source)
  end
 loop
  perform n88_private.v2_writer_retire_1031(v_owner,s.scope_key,parent,case when tg_table_name='score_subitems' then source else null end,revision);
 end loop;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function n88_private.v2_writer_lock_1031(),n88_private.v2_writer_after_1031(),n88_private.v2_writer_retire_1031(uuid,text,text,text,bigint) from public,anon,authenticated,n88_backend;
