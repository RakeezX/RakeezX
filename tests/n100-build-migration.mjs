// Generates one additive correction from the exact provider definitions read for N100.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const rows = JSON.parse(await readFile(new URL('./n100-provider-source.json', import.meta.url)));
const definition = name => rows.find(row => row.signature.startsWith('rakeezx.'+name+'(')).definition;
const replace = (text, from, to) => { assert.ok(text.includes(from), from); return text.replace(from, to); };
let builder = definition('n73_build_distribution');
builder = replace(builder, 'p_remove text[])', 'p_remove text[], p_mode text)');
builder = replace(builder, 'v_version bigint; v_error text; v_field text;', `v_version bigint; v_error text; v_field text;
  v_ordinal int; v_preserved int; v_completions int; v_details jsonb;`);
builder = replace(builder, 'begin\n  if v_owner', `begin
  if p_mode is null or p_mode not in ('definitions','preserve-target') or (p_mode='preserve-target' and cardinality(p_remove)>0) then
    raise exception using errcode='22023',message='Invalid distribution mode or preservation removal'; end if;
  if v_owner`);
const normalized = expression => `lower(regexp_replace(btrim(${expression}),'[[:space:]]+',' ','g'))`;
// Legacy matching and score projections remain unchanged under the default mode.
builder = builder.replaceAll('btrim(name)=btrim(s.name)', `(case when p_mode='preserve-target' then ${normalized('name')}=${normalized('s.name')} else btrim(name)=btrim(s.name) end)`);
builder = replace(builder, '        if t.id is not null then v_used', `        if p_mode='preserve-target' then
          if (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=p_source and deleted_at is null and ${normalized('name')}=${normalized('s.name')})<>1 or
             (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and ${normalized('name')}=${normalized('s.name')})>1 or
             (t.id is not null and (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null and ${normalized('name')}=${normalized('t.name')})>1) then
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
        if t.id is not null then v_used`);
builder = replace(builder, "v_subs:='[]'; v_subused:='{}'; v_removed:=0;", "v_subs:='[]'; v_subused:='{}'; v_removed:=0; v_ordinal:=0; v_details:='[]';");
builder = replace(builder, '          select count(*) into v_count from rakeezx.score_subitems', `          v_ordinal:=v_ordinal+1;
          select count(*) into v_count from rakeezx.score_subitems`);
builder = replace(builder, '          if v_count=0 then\n            select count(*)', `          if p_mode='preserve-target' and t.id is not null then
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
            select count(*)`);
builder = replace(builder, "          v_changed:=v_changed or e.id is null", `          v_details:=v_details||jsonb_build_array(jsonb_build_object('targetId',v_sub_id,'name',d.name,
            'startDate',d.start_date,'dueDate',d.due_date,'points',d.value,'latePoints',coalesce(d.late_points,d.value),'preserved',e.id is not null));
          v_changed:=v_changed or e.id is null`);
builder = replace(builder, "        if not v_changed then continue; end if;", `        if p_mode='preserve-target' and v_removed>0 then
          raise exception using errcode='P7301',message='المطابقة لا تحفظ جميع عناصر الهدف؛ ستبقى سجلاته كما هي.'; end if;
        select count(*) into v_preserved from rakeezx.scores where owner_id=v_owner and item_id=t.id and deleted_at is null;
        select count(*) into v_completions from rakeezx.score_subitem_completions where owner_id=v_owner and subitem_id=any(v_subused) and deleted_at is null;
        if not v_changed then
          if p_mode='preserve-target' then
            v_impact:=v_impact||jsonb_build_array(jsonb_build_object('name',s.name,'beforeMax',t.max,'max',s.max,'affected',0,
              'examples','[]'::jsonb,'modeChanged',false,'removedSubitems',0,'created',false,'preservedScores',v_preserved,'preservedCompletions',v_completions,'subitems',v_details));
          end if;
          continue;
        end if;`);
builder = replace(builder, '        for v_score in select to_jsonb(sc)', "        if p_mode='definitions' then\n        for v_score in select to_jsonb(sc)");
builder = replace(builder, '        v_target_requires:=v_target_requires or', "        end if;\n        v_target_requires:=v_target_requires or (p_mode='preserve-target') or");
builder = replace(builder, "'removedSubitems',v_removed,'created',t.id is null)", "'removedSubitems',v_removed,'created',t.id is null,'preservedScores',case when p_mode='preserve-target' then v_preserved else 0 end,\n          'preservedCompletions',case when p_mode='preserve-target' then v_completions else 0 end,'subitems',v_details)");
builder = replace(builder, "'protocol','N73_D119_V2','targets'", "'mode',p_mode,'protocol','N73_D119_V2','targets'");
let plan = definition('plan_score_distribution');
plan = replace(plan, "p_remove text[] DEFAULT '{}'::text[])", 'p_remove text[], p_mode text)');
plan = replace(plan, "v_request:=jsonb_build_object('source',p_source,'targets',p_targets,'remove',p_remove);", `if p_mode is null or p_mode not in ('definitions','preserve-target') then
    raise exception using errcode='22023',message='Invalid distribution mode'; end if;
  v_request:=jsonb_build_object('source',p_source,'targets',p_targets,'remove',p_remove);
  if p_mode='preserve-target' then v_request:=v_request||jsonb_build_object('mode',p_mode); end if;`);
plan = replace(plan, 'n73_build_distribution(p_source,p_targets,p_remove)', 'n73_build_distribution(p_source,p_targets,p_remove,p_mode)');
plan = replace(plan, 'v_fingerprint:=md5(rakeezx.n73_distribution_state(p_source,p_targets)::text);', `v_fingerprint:=case when p_mode='preserve-target' then md5(jsonb_build_object('state',rakeezx.n73_distribution_state(p_source,p_targets),
    'request',v_request,'operations',v_plan->'operations')::text) else md5(rakeezx.n73_distribution_state(p_source,p_targets)::text) end;`);
let apply = definition('apply_score_distribution_plan');
apply = replace(apply, 'v_now timestamptz:=clock_timestamp();', 'v_now timestamptz:=clock_timestamp(); v_current jsonb;');
apply = replace(apply, '  if md5(rakeezx.n73_distribution_state(v_source,v_targets)::text)<>v_saved.fingerprint then', `  if v_saved.request->>'mode'='preserve-target' then
    v_current:=rakeezx.n73_build_distribution(v_source,v_targets,
      array(select jsonb_array_elements_text(v_saved.request->'remove')),'preserve-target');
    if md5(jsonb_build_object('state',rakeezx.n73_distribution_state(v_source,v_targets),
      'request',v_saved.request,'operations',v_current->'operations')::text)<>v_saved.fingerprint or
      v_current->'operations' is distinct from v_saved.plan->'operations' then
      raise exception using errcode='PT409',message='Distribution preservation mapping changed since review'; end if;
  elsif md5(rakeezx.n73_distribution_state(v_source,v_targets)::text)<>v_saved.fingerprint then`);
let capability = definition('score_distribution_capability').replace('"distributionApplyVersion":2', '"targetPreservationVersion":1,"distributionApplyVersion":2');
const wrapper = (name,args,call) => `CREATE OR REPLACE FUNCTION rakeezx.${name}(${args}) RETURNS jsonb
LANGUAGE sql ${name==='n73_build_distribution'?'STABLE ':''}SECURITY DEFINER SET search_path='' AS $function$
  SELECT rakeezx.${name}(${call},'definitions');
$function$;`;
// Compatible overloads of two existing routine names; no new routine names or tables.
const quote = value => "'"+value.replaceAll("'","''")+"'";
const guards = rows.map(row=>`IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=${quote(row.signature)}::regprocedure AND md5(prosrc)=${quote(row.body_md5)} AND proacl::text=${quote(row.acl)} AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'N100 provider source/ACL changed: ${row.signature}'; END IF;`).join('\n  ');
const sql = `-- N100: provider-bound, additive, target-only label/date preservation. Existing migrations immutable.
BEGIN;
DO $guard$ BEGIN
  ${guards}
END; $guard$;
${builder};
REVOKE ALL ON FUNCTION rakeezx.n73_build_distribution(text,text[],text[],text) FROM public,anon,authenticated;
${wrapper('n73_build_distribution','p_source text,p_targets text[],p_remove text[]','p_source,p_targets,p_remove')}
${plan};
REVOKE ALL ON FUNCTION rakeezx.plan_score_distribution(text,text,text[],text[],text) FROM public,anon;
GRANT EXECUTE ON FUNCTION rakeezx.plan_score_distribution(text,text,text[],text[],text) TO authenticated;
${wrapper('plan_score_distribution',"p_plan_id text,p_source text,p_targets text[],p_remove text[] DEFAULT '{}'::text[]",'p_plan_id,p_source,p_targets,p_remove')}
${apply};
${capability};
COMMIT;
`;
await writeFile('supabase/migrations/20261013101500_n100_preserve_target_marks.sql',sql);
