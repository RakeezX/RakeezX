-- N100: provider-bound, additive, target-only label/date preservation. Existing migrations immutable.
BEGIN;
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='rakeezx.apply_score_distribution_plan(text,text,text,text,boolean)'::regprocedure AND md5(prosrc)='986af8cf5fbbd0966cfc5aa34d15e49c' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'N100 provider source/ACL changed: rakeezx.apply_score_distribution_plan(text,text,text,text,boolean)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='rakeezx.n73_build_distribution(text,text[],text[])'::regprocedure AND md5(prosrc)='3b72cb1b9c16b2d34baf6709ab40c70c' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'N100 provider source/ACL changed: rakeezx.n73_build_distribution(text,text[],text[])'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='rakeezx.n73_distribution_state(text,text[])'::regprocedure AND md5(prosrc)='b6acbc0a1e59ae6ac54d0832723446dd' AND proacl::text='{postgres=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'N100 provider source/ACL changed: rakeezx.n73_distribution_state(text,text[])'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='rakeezx.plan_score_distribution(text,text,text[],text[])'::regprocedure AND md5(prosrc)='870a4a5c96bd73241d8c2b6eb02248cf' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'N100 provider source/ACL changed: rakeezx.plan_score_distribution(text,text,text[],text[])'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='rakeezx.score_distribution_capability()'::regprocedure AND md5(prosrc)='97cf6cdf2eb3518e78e7d1aae49ae185' AND proacl::text='{postgres=X/postgres,authenticated=X/postgres}' AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'N100 provider source/ACL changed: rakeezx.score_distribution_capability()'; END IF;
END; $guard$;
CREATE OR REPLACE FUNCTION rakeezx.n73_build_distribution(p_source text, p_targets text[], p_remove text[], p_mode text)
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
  v_ordinal int; v_preserved int; v_completions int; v_details jsonb;
begin
  if p_mode is null or p_mode not in ('definitions','preserve-target') or (p_mode='preserve-target' and cardinality(p_remove)>0) then
    raise exception using errcode='22023',message='Invalid distribution mode or preservation removal'; end if;
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
          select count(*) into v_count from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and (case when p_mode='preserve-target' then lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')) else btrim(name)=btrim(s.name) end);
          select * into t from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and (case when p_mode='preserve-target' then lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')) else btrim(name)=btrim(s.name) end) order by id limit 1;
        else
          select * into t from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and distribution_origin_id=s.id order by id limit 1;
        end if;
        if v_count>1 or t.id=any(v_used) then raise exception using errcode='P7301',message='البند «'||s.name||'» مكرر. عدّل أسماء البنود في الفصل المستهدف.'; end if;
        if p_mode='preserve-target' then
          if (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=p_source and deleted_at is null and lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')))<>1 or
             (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(s.name),'[[:space:]]+',' ','g')))>1 or
             (t.id is not null and (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(t.name),'[[:space:]]+',' ','g')))>1) then
            raise exception using errcode='P7301',message='اسم البند مكرر؛ لا يمكن حفظ سجلات الهدف بأمان.'; end if;
          if t.id is not null and ((t.score_mode,t.auto,t.max,t.per_point,t.penalty,t.distribution_mode) is distinct from
              (s.score_mode,s.auto,s.max,s.per_point,s.penalty,s.distribution_mode)) then
            raise exception using errcode='P7301',message='طريقة الرصد أو الحد الأعلى أو الأوزان مختلفة؛ سجلات الفصل الهدف ستبقى كما هي.'; end if;
          if t.id is not null and s.score_mode='subitems' and (
            (select count(*) from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null)<>
            (select count(*) from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null) or
            exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and item_id in(s.id,t.id) and deleted_at is null group by item_id,"order" having count(*)>1)) then
            raise exception using errcode='P7301',message='عدد العناصر أو ترتيبها مختلف أو مكرر؛ سجلات الفصل الهدف ستبقى كما هي.'; end if;
        end if;
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
        v_subs:='[]'; v_subused:='{}'; v_removed:=0; v_ordinal:=0; v_details:='[]';
        if s.score_mode='subitems' and not exists(select 1 from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null) then
          raise exception using errcode='P7301',message='راجع البنود الفرعية في الفصل المصدر.'; end if;
        for d in select * from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null and s.score_mode='subitems' order by "order",id loop
          v_ordinal:=v_ordinal+1;
          select count(*) into v_count from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and distribution_origin_id=d.id;
          if p_mode='preserve-target' and t.id is not null then
            if v_count>1 then raise exception using errcode='P7301',message='أصل هوية العنصر مكرر؛ سجلات الهدف ستبقى كما هي.'; end if;
            if v_count=1 then
              select * into e from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and distribution_origin_id=d.id;
            else
              select * into e from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null order by "order",id offset v_ordinal-1 limit 1;
              if e.distribution_origin_id is not null and e.distribution_origin_id<>d.id then
                raise exception using errcode='P7301',message='هوية العنصر ترتبط بمصدر مختلف؛ سجلات الهدف ستبقى كما هي.'; end if;
            end if;
            if e.id is null or (e."order",e.value,coalesce(e.late_points,e.value)) is distinct from
                (d."order",d.value,coalesce(d.late_points,d.value)) then
              raise exception using errcode='P7301',message='ترتيب العناصر أو نقاطها العادية والمتأخرة مختلف؛ سجلات الهدف ستبقى كما هي.'; end if;
          elsif v_count=0 then
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
          v_details:=v_details||jsonb_build_array(jsonb_build_object('targetId',v_sub_id,'name',d.name,
            'startDate',d.start_date,'dueDate',d.due_date,'points',d.value,'latePoints',coalesce(d.late_points,d.value),'preserved',e.id is not null));
          v_changed:=v_changed or e.id is null or (select jsonb_object_agg(k,to_jsonb(e)->k) from jsonb_object_keys(v_subpatch) k) is distinct from v_subpatch;
          v_subs:=v_subs||jsonb_build_array(jsonb_build_object('id',v_sub_id,'patch',v_subpatch,'create',e.id is null));
        end loop;
        select count(*) into v_removed from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null and not(id=any(v_subused));
        v_changed:=v_changed or v_removed>0;
        if p_mode='preserve-target' and v_removed>0 then
          raise exception using errcode='P7301',message='المطابقة لا تحفظ جميع عناصر الهدف؛ ستبقى سجلاته كما هي.'; end if;
        select count(*) into v_preserved from rakeezx.scores where owner_id=v_owner and item_id=t.id and deleted_at is null;
        select count(*) into v_completions from rakeezx.score_subitem_completions where owner_id=v_owner and subitem_id=any(v_subused) and deleted_at is null;
        if not v_changed then
          if p_mode='preserve-target' then
            v_impact:=v_impact||jsonb_build_array(jsonb_build_object('name',s.name,'beforeMax',t.max,'max',s.max,'affected',0,
              'examples','[]'::jsonb,'modeChanged',false,'removedSubitems',0,'created',false,'preservedScores',v_preserved,'preservedCompletions',v_completions,'subitems',v_details));
          end if;
          continue;
        end if;
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
        if p_mode='definitions' then
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
        end if;
        v_target_requires:=v_target_requires or (p_mode='preserve-target') or v_mode_changed or v_affected>0 or v_removed>0;
        v_impact:=v_impact||jsonb_build_array(jsonb_build_object('name',s.name,'beforeMax',t.max,'max',s.max,'affected',v_affected,
          'examples',v_examples,'modeChanged',v_mode_changed,'removedSubitems',v_removed,'created',t.id is null,'preservedScores',case when p_mode='preserve-target' then v_preserved else 0 end,
          'preservedCompletions',case when p_mode='preserve-target' then v_completions else 0 end,'subitems',v_details));
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
  return jsonb_build_object('mode',p_mode,'protocol','N73_D119_V2','targets',v_targets,'excludedTargets',v_excluded,'operations',v_ops,
    'requiresConfirmation',v_requires,'changedCount',(select count(*) from jsonb_array_elements(v_ops) x where x->>'entity'='items'));
end; $function$
;
REVOKE ALL ON FUNCTION rakeezx.n73_build_distribution(text,text[],text[],text) FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION rakeezx.n73_build_distribution(p_source text,p_targets text[],p_remove text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
  SELECT rakeezx.n73_build_distribution(p_source,p_targets,p_remove,'definitions');
$function$;
CREATE OR REPLACE FUNCTION rakeezx.plan_score_distribution(p_plan_id text, p_source text, p_targets text[], p_remove text[], p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_request jsonb; v_plan jsonb; v_fingerprint text; v_saved rakeezx.score_distribution_plans%rowtype;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_plan_id,'')='' or length(p_plan_id)>200 then raise exception using errcode='22023',message='Invalid plan identity'; end if;
  -- Short table locks prevent phantom inserts from racing plan validation. No
  -- unrelated owner rows are read, returned or mutated by the score operations.
  lock table rakeezx.items,rakeezx.score_subitems,rakeezx.score_subitem_completions,rakeezx.scores,
    rakeezx.teachings,rakeezx.sections,rakeezx.terms,rakeezx.years,rakeezx.subjects,rakeezx.students,
    rakeezx.enrollments,rakeezx.units,rakeezx.lessons,rakeezx.logs,rakeezx.attendance in share mode;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':n73-plan:'||p_plan_id,0));
  if p_mode is null or p_mode not in ('definitions','preserve-target') then
    raise exception using errcode='22023',message='Invalid distribution mode'; end if;
  v_request:=jsonb_build_object('source',p_source,'targets',p_targets,'remove',p_remove);
  if p_mode='preserve-target' then v_request:=v_request||jsonb_build_object('mode',p_mode); end if;
  select * into v_saved from rakeezx.score_distribution_plans where owner_id=v_owner and id=p_plan_id;
  if found then
    if v_saved.request is distinct from v_request then raise exception using errcode='22023',message='Plan ID reused'; end if;
    return v_saved.plan;
  end if;
  v_plan:=rakeezx.n73_build_distribution(p_source,p_targets,p_remove,p_mode);
  v_fingerprint:=case when p_mode='preserve-target' then md5(jsonb_build_object('state',rakeezx.n73_distribution_state(p_source,p_targets),
    'request',v_request,'operations',v_plan->'operations')::text) else md5(rakeezx.n73_distribution_state(p_source,p_targets)::text) end;
  v_plan:=(v_plan-'operations')||jsonb_build_object('planId',p_plan_id,'token',v_fingerprint,'expiresAt',clock_timestamp()+interval '15 minutes',
    'operations',v_plan->'operations');
  insert into rakeezx.score_distribution_plans(owner_id,id,request,fingerprint,plan) values(v_owner,p_plan_id,v_request,v_fingerprint,v_plan);
  return v_plan;
end; $function$
;
REVOKE ALL ON FUNCTION rakeezx.plan_score_distribution(text,text,text[],text[],text) FROM public,anon;
GRANT EXECUTE ON FUNCTION rakeezx.plan_score_distribution(text,text,text[],text[],text) TO authenticated;
CREATE OR REPLACE FUNCTION rakeezx.plan_score_distribution(p_plan_id text,p_source text,p_targets text[],p_remove text[] DEFAULT '{}'::text[]) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $function$
  SELECT rakeezx.plan_score_distribution(p_plan_id,p_source,p_targets,p_remove,'definitions');
$function$;
CREATE OR REPLACE FUNCTION rakeezx.apply_score_distribution_plan(p_mutation_id text, p_device_id text, p_plan_id text, p_token text, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=auth.uid(); v_saved rakeezx.score_distribution_plans%rowtype; v_receipt rakeezx.score_domain_receipts%rowtype;
  v_envelope jsonb; v_op jsonb; v_patch jsonb; v_entity text; v_id text; v_key text; v_sets text; v_columns text; v_values text;
  v_source text; v_targets text[]; v_accepted text[]; v_result jsonb; v_rows jsonb; v_ids text[]; v_affected bigint; v_now timestamptz:=clock_timestamp(); v_current jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(p_mutation_id,'')='' or length(p_mutation_id)>200 or coalesce(p_device_id,'')='' or length(p_device_id)>200 or
    p_token is null or p_confirmed is null then raise exception using errcode='22023',message='Invalid distribution envelope'; end if;
  v_envelope:=jsonb_build_object('protocol','N73_D119_V2','deviceId',p_device_id,'planId',p_plan_id,'token',p_token,'confirmed',p_confirmed);
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':score-domain-receipt:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.score_domain_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Distribution mutation ID reused'; end if;
    return v_receipt.result;
  end if;
  lock table rakeezx.items,rakeezx.score_subitems,rakeezx.score_subitem_completions,rakeezx.scores,
    rakeezx.teachings,rakeezx.sections,rakeezx.terms,rakeezx.years,rakeezx.subjects,rakeezx.students,
    rakeezx.enrollments,rakeezx.units,rakeezx.lessons,rakeezx.logs,rakeezx.attendance in share row exclusive mode;
  select * into v_saved from rakeezx.score_distribution_plans where owner_id=v_owner and id=p_plan_id;
  if not found then raise exception using errcode='42501',message='Distribution plan unavailable'; end if;
  if v_saved.fingerprint<>p_token or v_saved.created_at+interval '15 minutes'<clock_timestamp() then
    raise exception using errcode='PT409',message='Distribution plan expired or changed'; end if;
  if (v_saved.plan->>'requiresConfirmation')::boolean and not p_confirmed then
    raise exception using errcode='22023',message='Deliberate impact confirmation required'; end if;
  if jsonb_array_length(v_saved.plan->'targets')=0 then raise exception using errcode='22023',message='Resolve ambiguous targets before applying'; end if;
  v_source:=v_saved.request->>'source';
  select array_agg(x) into v_targets from jsonb_array_elements_text(v_saved.request->'targets') x;
  if v_saved.request->>'mode'='preserve-target' then
    v_current:=rakeezx.n73_build_distribution(v_source,v_targets,
      array(select jsonb_array_elements_text(v_saved.request->'remove')),'preserve-target');
    if md5(jsonb_build_object('state',rakeezx.n73_distribution_state(v_source,v_targets),
      'request',v_saved.request,'operations',v_current->'operations')::text)<>v_saved.fingerprint or
      v_current->'operations' is distinct from v_saved.plan->'operations' then
      raise exception using errcode='PT409',message='Distribution preservation mapping changed since review'; end if;
  elsif md5(rakeezx.n73_distribution_state(v_source,v_targets)::text)<>v_saved.fingerprint then
    raise exception using errcode='PT409',message='Distribution changed since review'; end if;
  perform set_config('rakeezx.score_domain_write','on',true);
  for v_op in select value from jsonb_array_elements(v_saved.plan->'operations') loop
    v_entity:=v_op->>'entity'; v_id:=v_op->>'id'; v_patch:=v_op->'patch';
    if v_patch->>'deleted_at'='__now__' then v_patch:=v_patch||jsonb_build_object('deleted_at',v_now); end if;
    v_patch:=v_patch||jsonb_build_object('device_id',p_device_id);
    if coalesce((v_op->>'create')::boolean,false) then
      v_patch:=v_patch||jsonb_build_object('owner_id',v_owner,'id',v_id);
      select string_agg(format('%I',k),',' order by k),string_agg(format('p.%I',k),',' order by k)
        into v_columns,v_values from jsonb_object_keys(v_patch) k;
      execute format('insert into rakeezx.%I(%s) select %s from jsonb_populate_record(null::rakeezx.%I,$1) p',v_entity,v_columns,v_values,v_entity) using v_patch;
    else
      select string_agg(format('%I=p.%I',k,k),',' order by k) into v_sets from jsonb_object_keys(v_patch) k;
      execute format('update rakeezx.%I t set %s from jsonb_populate_record(null::rakeezx.%I,$1) p where t.owner_id=$2 and t.id=$3 and t.deleted_at is null',v_entity,v_sets,v_entity)
        using v_patch,v_owner,v_id;
      get diagnostics v_affected=row_count;
      if v_affected<>1 then raise exception using errcode='PT409',message='Distribution operation unavailable'; end if;
    end if;
  end loop;
  v_result:=jsonb_build_object('mutationId',p_mutation_id,'planId',p_plan_id,'protocol','N73_D119_V2',
    'changedCount',v_saved.plan->'changedCount','excludedTargets',v_saved.plan->'excludedTargets');
  select array_agg(x->>'teachingId') into v_accepted from jsonb_array_elements(v_saved.plan->'targets') x;
  -- Full accepted-target canonical scope includes compatible unchanged scores
  -- and completions as well as tombstones. It never contains source grades.
  v_result:=v_result||jsonb_build_object(
    'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from rakeezx.items i where owner_id=v_owner and teaching_id=any(v_accepted)),
    'score_subitems',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from rakeezx.score_subitems d join rakeezx.items i
      on i.owner_id=d.owner_id and i.id=d.item_id where d.owner_id=v_owner and i.teaching_id=any(v_accepted)),
    'score_subitem_completions',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from rakeezx.score_subitem_completions c
      join rakeezx.score_subitems d on d.owner_id=c.owner_id and d.id=c.subitem_id join rakeezx.items i on i.owner_id=d.owner_id and i.id=d.item_id
      where c.owner_id=v_owner and i.teaching_id=any(v_accepted)),
    'scores',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from rakeezx.scores s join rakeezx.items i
      on i.owner_id=s.owner_id and i.id=s.item_id where s.owner_id=v_owner and i.teaching_id=any(v_accepted))
  );
  insert into rakeezx.score_domain_receipts(owner_id,mutation_id,request_envelope,result) values(v_owner,p_mutation_id,v_envelope,v_result);
  return v_result;
end; $function$
;
CREATE OR REPLACE FUNCTION rakeezx.score_distribution_capability()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select '{"targetPreservationVersion":1,"distributionApplyVersion":2,"protocol":"N73_D119_V2"}'::jsonb;
$function$
;
COMMIT;
