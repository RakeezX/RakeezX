-- N73/N94 compatibility; preserves current function delegation, ACL and all applied migrations.
BEGIN;
CREATE OR REPLACE FUNCTION rakeezx.n73_build_distribution(p_source text, p_targets text[], p_remove text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_source rakeezx.teachings%rowtype; v_target rakeezx.teachings%rowtype;
  v_section rakeezx.sections%rowtype; v_target_section rakeezx.sections%rowtype;
  s rakeezx.items%rowtype; t rakeezx.items%rowtype; d rakeezx.score_subitems%rowtype; e rakeezx.score_subitems%rowtype;
  v_target_id text; v_item_id text; v_sub_id text; v_count int; v_used text[]; v_subused text[];
  v_ops jsonb:='[]'; v_target_ops jsonb; v_impact jsonb; v_targets jsonb:='[]'; v_excluded jsonb:='[]';
  v_extras jsonb; v_extra jsonb; v_patch jsonb; v_subpatch jsonb; v_subs jsonb; v_score jsonb; v_completion jsonb;
  v_student text; v_old numeric; v_value numeric; v_manual numeric; v_derived numeric; v_recorded boolean;
  v_changed boolean; v_mode_changed boolean; v_affected int; v_removed int; v_examples jsonb;
  v_requires boolean:=false; v_target_requires boolean; v_removable text[]:='{}'; v_target_removable text[];
  v_version bigint; v_error text; v_field text;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if p_targets is null or cardinality(p_targets)<1 or cardinality(p_targets)>50 or
    array_position(p_targets,null) is not null or
    (select count(distinct x) from unnest(p_targets) x)<>cardinality(p_targets) or
    p_remove is null or array_position(p_remove,null) is not null or
    (select count(distinct x) from unnest(p_remove) x)<>cardinality(p_remove) then
    raise exception using errcode='22023',message='Choose distinct targets and removals'; end if;
  select * into v_source from rakeezx.teachings where owner_id=v_owner and id=p_source and deleted_at is null;
  select * into v_section from rakeezx.sections where owner_id=v_owner and id=v_source.section_id and deleted_at is null;
  if v_source.id is null or v_section.id is null or v_section.status='archived' or not exists
    (select 1 from rakeezx.terms where owner_id=v_owner and id=v_source.term_id and year_id=v_section.year_id and deleted_at is null) then
    raise exception using errcode='42501',message='Source teaching unavailable'; end if;
  for v_target_id in select unnest(p_targets) order by 1 loop
    select * into v_target from rakeezx.teachings where owner_id=v_owner and id=v_target_id and deleted_at is null;
    select * into v_target_section from rakeezx.sections where owner_id=v_owner and id=v_target.section_id and deleted_at is null;
    if v_target.id is null or v_target_section.id is null or v_target_section.status='archived' or
      v_target.section_id=v_source.section_id or v_target.subject_id<>v_source.subject_id or v_target.term_id<>v_source.term_id or
      v_target_section.year_id<>v_section.year_id or v_target_section.grade<>v_section.grade then
      raise exception using errcode='42501',message='Target teaching unavailable or outside source boundary'; end if;
    v_target_ops:='[]'; v_impact:='[]'; v_used:='{}'; v_target_requires:=false; v_target_removable:='{}';
    begin
      for s in select * from rakeezx.items where owner_id=v_owner and teaching_id=p_source and deleted_at is null order by "order",id loop
        select count(*) into v_count from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and distribution_origin_id=s.id;
        if v_count=0 then
          select count(*) into v_count from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and btrim(name)=btrim(s.name);
          select * into t from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and btrim(name)=btrim(s.name) order by id limit 1;
        else
          select * into t from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and distribution_origin_id=s.id order by id limit 1;
        end if;
        if v_count>1 or t.id=any(v_used) then raise exception using errcode='P7301',message='البند «'||s.name||'» مكرر. عدّل أسماء البنود في الفصل المستهدف.'; end if;
        if t.id is not null then v_used:=array_append(v_used,t.id); end if;
        v_item_id:=coalesce(t.id,'n73:i:'||md5(v_owner::text||':'||v_target_id||':'||s.id));
        if t.id is null and exists(select 1 from rakeezx.items where owner_id=v_owner and id=v_item_id) then
          raise exception using errcode='P7301',message='هوية بند محذوف محفوظة؛ راجع توزيع الفصل المستهدف.'; end if;
        v_patch:=jsonb_build_object('teaching_id',v_target_id,'name',s.name,'max',s.max,'order',s."order",'auto',s.auto,
          'per_point',s.per_point,'penalty',s.penalty,'unit_id',s.unit_id,'lesson_id',s.lesson_id,
          'score_mode',s.score_mode,'distribution_mode',s.distribution_mode,'distribution_origin_id',s.id,'portability_group_id',null);
        if (s.unit_id is not null and not exists(select 1 from rakeezx.units where owner_id=v_owner and id=s.unit_id and subject_id=v_source.subject_id and deleted_at is null)) or
          (s.lesson_id is not null and not exists(select 1 from rakeezx.lessons l join rakeezx.units u on u.owner_id=l.owner_id and u.id=l.unit_id
            where l.owner_id=v_owner and l.id=s.lesson_id and l.deleted_at is null and u.deleted_at is null and u.subject_id=v_source.subject_id and (s.unit_id is null or u.id=s.unit_id))) then
          raise exception using errcode='P7301',message='راجع ارتباط المنهج في البند المصدر.'; end if;
        v_changed:=t.id is null or (select jsonb_object_agg(k,to_jsonb(t)->k) from jsonb_object_keys(v_patch) k) is distinct from v_patch;
        v_mode_changed:=t.id is not null and (t.score_mode,t.auto) is distinct from (s.score_mode,s.auto);
        v_subs:='[]'; v_subused:='{}'; v_removed:=0;
        if s.score_mode='subitems' and not exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null) then
          raise exception using errcode='P7301',message='راجع البنود الفرعية في الفصل المصدر.'; end if;
        for d in select * from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null and s.score_mode='subitems' order by "order",id loop
          select count(*) into v_count from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and distribution_origin_id=d.id;
          if v_count=0 then
            select count(*) into v_count from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and btrim(name)=btrim(d.name);
            select * into e from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and btrim(name)=btrim(d.name) order by id limit 1;
          else
            select * into e from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and distribution_origin_id=d.id order by id limit 1;
          end if;
          if v_count>1 or e.id=any(v_subused) then raise exception using errcode='P7301',message='العنصر «'||d.name||'» مكرر. عدّل أسماء العناصر في الفصل المستهدف.'; end if;
          if e.id is not null then v_subused:=array_append(v_subused,e.id); end if;
          v_sub_id:=coalesce(e.id,'n73:d:'||md5(v_owner::text||':'||v_target_id||':'||d.id));
          if e.id is null and exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and id=v_sub_id) then
            raise exception using errcode='P7301',message='هوية عنصر محذوف محفوظة؛ راجع الفصل المستهدف.'; end if;
          v_subpatch:=jsonb_build_object('item_id',v_item_id,'name',d.name,'value',d.value,'order',d."order",'distribution_origin_id',d.id);
          -- Preserve newly shipped definition metadata if present; created_at is
          -- an audit identity and is never copied from another record.
          for v_field in select unnest(array['start_date','due_date','late_points']) loop
            if to_jsonb(d)?v_field then v_subpatch:=v_subpatch||jsonb_build_object(v_field,to_jsonb(d)->v_field); end if;
          end loop;
          v_changed:=v_changed or e.id is null or (select jsonb_object_agg(k,to_jsonb(e)->k) from jsonb_object_keys(v_subpatch) k) is distinct from v_subpatch;
          v_subs:=v_subs||jsonb_build_array(jsonb_build_object('id',v_sub_id,'patch',v_subpatch,'create',e.id is null));
        end loop;
        select count(*) into v_removed from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and not(id=any(v_subused));
        v_changed:=v_changed or v_removed>0;
        if not v_changed then continue; end if;
        v_version:=coalesce(t.distribution_version+1,1);
        v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','items','id',v_item_id,'create',t.id is null,'patch',v_patch||jsonb_build_object('distribution_version',v_version)));
        for v_extra in select value from jsonb_array_elements(v_subs) loop
          v_target_ops:=v_target_ops||jsonb_build_array(v_extra||jsonb_build_object('entity','score_subitems','patch',(v_extra->'patch')||jsonb_build_object('distribution_version',v_version)));
        end loop;
        for d in select * from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and not(id=any(v_subused)) loop
          v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','score_subitems','id',d.id,'patch',jsonb_build_object('deleted_at','__now__')));
          for v_completion in select to_jsonb(c) from rakeezx.score_subitem_completions c where owner_id=v_owner and subitem_id=d.id and deleted_at is null loop
            v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','score_subitem_completions','id',v_completion->>'id','patch',jsonb_build_object('deleted_at','__now__')));
          end loop;
        end loop;
        v_affected:=0; v_examples:='[]';
        -- Existing target evidence only. New subitems begin unchecked; compatible
        -- completions retain their target IDs and student decisions.
        for v_score in select to_jsonb(sc) from rakeezx.scores sc where owner_id=v_owner and item_id=t.id and deleted_at is null loop
          v_student:=v_score->>'student_id'; v_old:=(v_score->>'value')::numeric; v_manual:=null; v_derived:=null;
          if not exists(select 1 from rakeezx.students where owner_id=v_owner and id=v_student and deleted_at is null) then
            raise exception using errcode='P7301',message='راجع سجل الطالب في الفصل المستهدف.'; end if;
          if s.score_mode='subitems' then
            select least(s.max,coalesce(sum(case when c.completion_state='late' then coalesce((x->'patch'->>'late_points')::numeric,(x->'patch'->>'value')::numeric) else (x->'patch'->>'value')::numeric end),0)),count(*)>0 into v_derived,v_recorded
              from jsonb_array_elements(v_subs) x join rakeezx.score_subitem_completions c on c.subitem_id=x->>'id' and c.owner_id=v_owner
              where c.student_id=v_student and c.checked and c.deleted_at is null;
            v_manual:=case when t.score_mode='direct' and t.auto is null then v_old else (v_score->>'manual_value')::numeric end;
            v_manual:=least(v_manual,greatest(0,s.max-v_derived));
            -- PostgreSQL least(NULL,x) returns x; keep unrecorded distinct.
            if (t.score_mode='direct' and (t.auto is not null or v_old is null)) or
              (t.score_mode='subitems' and v_score->>'manual_value' is null) then v_manual:=null; end if;
            v_value:=case when v_recorded or v_manual is not null then v_derived+coalesce(v_manual,0) else null end;
          elsif s.auto is not null then
            v_value:=null; -- Auto results remain read-only projections of target events.
          elsif v_mode_changed then
            v_value:=null;
          else v_value:=case when v_old is null then null else least(v_old,s.max) end;
          end if;
          if (v_old,(v_score->>'manual_value')::numeric,(v_score->>'derived_value')::numeric) is distinct from (v_value,v_manual,v_derived) then
            v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','scores','id',v_score->>'id','patch',jsonb_build_object('value',v_value,'manual_value',v_manual,'derived_value',v_derived)));
            v_affected:=v_affected+1;
            if jsonb_array_length(v_examples)<3 then v_examples:=v_examples||jsonb_build_array(jsonb_build_object('before',v_old,'after',v_value)); end if;
          end if;
        end loop;
        v_target_requires:=v_target_requires or v_mode_changed or v_affected>0 or v_removed>0;
        v_impact:=v_impact||jsonb_build_array(jsonb_build_object('name',s.name,'beforeMax',t.max,'max',s.max,'affected',v_affected,
          'examples',v_examples,'modeChanged',v_mode_changed,'removedSubitems',v_removed,'created',t.id is null));
      end loop;
      v_extras:='[]';
      for t in select * from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and not(id=any(v_used)) order by "order",id loop
        v_target_removable:=array_append(v_target_removable,t.id);
        select count(*) into v_affected from rakeezx.scores where owner_id=v_owner and item_id=t.id and deleted_at is null and value is not null;
        v_extras:=v_extras||jsonb_build_array(jsonb_build_object('id',t.id,'name',t.name,'affected',v_affected));
        if not(t.id=any(p_remove)) then continue; end if;
        v_target_requires:=true;
        v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','items','id',t.id,'patch',jsonb_build_object('deleted_at','__now__')));
        for v_score in select to_jsonb(sc) from rakeezx.scores sc where owner_id=v_owner and item_id=t.id and deleted_at is null loop
          v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','scores','id',v_score->>'id','patch',jsonb_build_object('deleted_at','__now__')));
        end loop;
        for d in select * from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null loop
          v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','score_subitems','id',d.id,'patch',jsonb_build_object('deleted_at','__now__')));
          for v_completion in select to_jsonb(c) from rakeezx.score_subitem_completions c where owner_id=v_owner and subitem_id=d.id and deleted_at is null loop
            v_target_ops:=v_target_ops||jsonb_build_array(jsonb_build_object('entity','score_subitem_completions','id',v_completion->>'id','patch',jsonb_build_object('deleted_at','__now__')));
          end loop;
        end loop;
      end loop;
      v_ops:=v_ops||v_target_ops; v_requires:=v_requires or v_target_requires;
      v_removable:=v_removable||v_target_removable;
      v_targets:=v_targets||jsonb_build_array(jsonb_build_object('teachingId',v_target_id,'impact',v_impact,'extras',v_extras,
        'beforeTotal',(select coalesce(sum(max),0) from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null),
        'afterTotal',(select coalesce(sum(max),0) from rakeezx.items where owner_id=v_owner and teaching_id=p_source and deleted_at is null)+
          (select coalesce(sum(max),0) from rakeezx.items where owner_id=v_owner and id=any(v_target_removable) and not(id=any(p_remove)))));
    exception when sqlstate 'P7301' then
      get stacked diagnostics v_error=message_text;
      v_excluded:=v_excluded||jsonb_build_array(jsonb_build_object('teachingId',v_target_id,'reason',v_error));
    end;
  end loop;
  if exists(select 1 from unnest(p_remove) x where not(x=any(v_removable))) then
    raise exception using errcode='22023',message='Removal must name an extra in an accepted target'; end if;
  return jsonb_build_object('protocol','N73_D119_V2','targets',v_targets,'excludedTargets',v_excluded,'operations',v_ops,
    'requiresConfirmation',v_requires,'changedCount',(select count(*) from jsonb_array_elements(v_ops) x where x->>'entity'='items'));
end; $function$
;

CREATE OR REPLACE FUNCTION rakeezx.sync_v2_field_map(p_entity text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case p_entity
when 'score_subitems' then '{"distribution_origin_id":"configuration","item_id":"identity","name":"name","value":"configuration","order":"order","distribution_version":"configuration","start_date":"configuration","due_date":"configuration","late_points":"configuration"}'::jsonb
when 'score_subitem_completions' then '{"student_id":"identity","subitem_id":"identity","checked":"state","completion_state":"state"}'::jsonb
when 'assignments' then '{"teaching_id":"identity","lesson_id":"identity","item_id":"identity","title":"content","assigned_date":"dates","due_date":"dates","max":"grading"}'::jsonb
when 'submissions' then '{"student_id":"identity","assignment_id":"identity","status":"content","score":"content","note":"content"}'::jsonb
else rakeezx.sync_v2_field_map_before_n71(p_entity) end;
$function$
;
COMMIT;
