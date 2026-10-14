// Additive correction generated only from the freshly observed N100 provider bodies.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const rows=JSON.parse(await readFile('tests/n100-automatic-provider-source.json','utf8'));
const definition=signature=>rows.find(row=>row.signature===signature).definition;
const replace=(text,from,to)=>{assert.ok(text.includes(from),from);return text.replace(from,to);};
let builder=definition('rakeezx.n73_build_distribution(text,text[],text[],text)');
builder=replace(builder,'v_ordinal int;',`v_preserve boolean; v_origin_count int; v_item_ops jsonb; v_item_impact jsonb; v_item_requires boolean;
  v_ordinal int;`);
builder=replace(builder,"not in ('definitions','preserve-target') or (p_mode='preserve-target'", "not in ('definitions','preserve-target','automatic-safe') or (p_mode in ('preserve-target','automatic-safe')");
// Legacy callers still execute precisely their original branches.
builder=builder.replaceAll("case when p_mode='preserve-target' then", "case when p_mode in ('preserve-target','automatic-safe') then");
builder=replace(builder,'        select count(*) into v_count from rakeezx.items',`        v_item_ops:=v_target_ops; v_item_impact:=v_impact; v_item_requires:=v_target_requires;
        begin
        select count(*) into v_count from rakeezx.items`);
builder=replace(builder,'        if v_count=0 then', '        v_origin_count:=v_count;\n        if v_count=0 then');
const normalized=expr=>`lower(regexp_replace(btrim(${expr}),'[[:space:]]+',' ','g'))`;
// Stable origin outranks labels; duplicate labels without an origin never create a second parent.
builder=replace(builder,"        if p_mode='preserve-target' then",`        if p_mode='automatic-safe' and v_origin_count=0 and
          (select count(*) from rakeezx.items where owner_id=v_owner and teaching_id=p_source and deleted_at is null and ${normalized('name')}=${normalized('s.name')})<>1 then
          raise exception using errcode='P7301',message='اسم البند مكرر؛ بقيت تعريفاته وسجلاته كما هي.'; end if;
        v_preserve:=p_mode='preserve-target' or (p_mode='automatic-safe' and t.id is not null and (
          t.auto is not null or
          ((t.score_mode,t.auto,t.max,t.per_point,t.penalty,t.distribution_mode) is not distinct from
            (s.score_mode,s.auto,s.max,s.per_point,s.penalty,s.distribution_mode) and
            (s.score_mode='direct' or (
              (select count(*) from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null)=
              (select count(*) from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null) and
              not exists(select 1 from
                (select "order",value,coalesce(late_points,value) late_points,row_number() over(order by "order",id) ordinal
                  from rakeezx.score_subitems where owner_id=v_owner and item_id=t.id and deleted_at is null) a
                full join
                (select "order",value,coalesce(late_points,value) late_points,row_number() over(order by "order",id) ordinal
                  from rakeezx.score_subitems where owner_id=v_owner and item_id=s.id and deleted_at is null) b using(ordinal)
                where (a."order",a.value,a.late_points) is distinct from (b."order",b.value,b.late_points))))) or
          exists(select 1 from rakeezx.scores where owner_id=v_owner and item_id=t.id and deleted_at is null and
            (value is not null or manual_value is not null or coalesce(derived_value,0)<>0)) or
          exists(select 1 from rakeezx.score_subitem_completions c join rakeezx.score_subitems child on child.owner_id=c.owner_id and child.id=c.subitem_id
            where c.owner_id=v_owner and child.item_id=t.id and c.deleted_at is null and child.deleted_at is null and (c.checked or c.completion_state is not null))));
        if v_preserve then`);
// Only the legacy preservation branch keeps its historical stricter label rule.
builder=replace(builder,'          if (select count(*) from rakeezx.items', "          if p_mode='preserve-target' and ((select count(*) from rakeezx.items");
builder=replace(builder,')>1) then\n            raise exception', ')>1)) then\n            raise exception');
builder=builder.replaceAll("if p_mode='preserve-target' and t.id",'if v_preserve and t.id')
  .replaceAll("if p_mode='preserve-target' and v_removed",'if v_preserve and v_removed')
  .replaceAll("if p_mode='preserve-target' then",'if v_preserve then')
  .replaceAll("if p_mode='definitions' then",'if not v_preserve then')
  .replaceAll("or (p_mode='preserve-target') or", "or p_mode='automatic-safe' or v_preserve or")
  .replaceAll("case when p_mode in ('preserve-target','automatic-safe') then v_preserved",'case when v_preserve then v_preserved')
  .replaceAll("case when p_mode in ('preserve-target','automatic-safe') then v_completions",'case when v_preserve then v_completions');
builder=replace(builder,"'created',false,'preservedScores'","'created',false,'unchanged',true,'preservedScores'");
builder=replace(builder,"      end loop;\n      v_extras:='[]';",`        exception when sqlstate 'P7301' then
          if p_mode<>'automatic-safe' then raise; end if;
          get stacked diagnostics v_error=message_text;
          -- PL/pgSQL exception rollback does not restore local JSON accumulators.
          v_target_ops:=v_item_ops; v_impact:=v_item_impact; v_target_requires:=v_item_requires;
          v_impact:=v_impact||jsonb_build_array(jsonb_build_object('name',s.name,'retained',true,'reason',v_error,
            'created',false,'affected',0,'examples','[]'::jsonb,'subitems','[]'::jsonb));
        end;
      end loop;
      v_extras:='[]';`);
// Compute actual reviewed total from the final operations, including retained definitions.
builder=replace(builder,"'afterTotal',(select coalesce(sum(max),0)","'afterTotal',case when p_mode='automatic-safe' then\n          (select coalesce(sum(max),0) from rakeezx.items where owner_id=v_owner and teaching_id=v_target_id and deleted_at is null)+\n          (select coalesce(sum((x->'patch'->>'max')::numeric-coalesce(i.max,0)),0) from jsonb_array_elements(v_target_ops) x\n            left join rakeezx.items i on i.owner_id=v_owner and i.id=x->>'id' where x->>'entity'='items')\n          else (select coalesce(sum(max),0)");
builder=replace(builder,'not(id=any(p_remove)))));','not(id=any(p_remove))) end));');
let plan=definition('rakeezx.plan_score_distribution(text,text,text[],text[],text)');
plan=plan.replaceAll("not in ('definitions','preserve-target')","not in ('definitions','preserve-target','automatic-safe')")
  .replaceAll("p_mode='preserve-target'","p_mode in ('preserve-target','automatic-safe')");
let apply=definition('rakeezx.apply_score_distribution_plan(text,text,text,text,boolean)');
apply=apply.replaceAll("v_saved.request->>'mode'='preserve-target'","v_saved.request->>'mode' in ('preserve-target','automatic-safe')")
  .replaceAll(")),'preserve-target');",")),v_saved.request->>'mode');");
// Fresh state check first: gains of recorded data reject the reviewed plan before reclassification.
apply=replace(apply,"  if v_saved.request->>'mode' in",`  if v_saved.request->>'mode'='automatic-safe' and
    md5(jsonb_build_object('state',rakeezx.n73_distribution_state(v_source,v_targets),
      'request',v_saved.request,'operations',v_saved.plan->'operations')::text)<>v_saved.fingerprint then
    raise exception using errcode='PT409',message='Distribution changed since review'; end if;
  if v_saved.request->>'mode' in`);
let capability=definition('rakeezx.score_distribution_capability()').replace('"targetPreservationVersion":1','"automaticSafeCopyVersion":1,"targetPreservationVersion":1');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const guards=rows.map(row=>`IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=${quote(row.signature)}::regprocedure AND md5(prosrc)=${quote(row.body_md5)} AND proacl::text=${quote(row.acl)} AND prosecdef AND proconfig=ARRAY['search_path=""']) THEN RAISE EXCEPTION 'N100 provider source/ACL changed: ${row.signature}'; END IF;`).join('\n');
await writeFile('supabase/migrations/20261014090000_n100_automatic_safe_copy.sql',`-- AI-assisted N100 automatic safe copy. Immutable prior migrations and ACLs retained.
BEGIN;
DO $guard$ BEGIN
${guards}
END; $guard$;
${builder};
${plan};
${apply};
${capability};
COMMIT;
`);
