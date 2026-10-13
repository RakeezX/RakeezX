// Deterministic source construction from the observed, named live contracts.
// Never executed on the service. Applied historical migrations remain immutable.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const preflight = JSON.parse(await readFile(new URL('./live-preflight.json', import.meta.url), 'utf8'));
const source = (name) => preflight.functions.find((row) => row.signature.startsWith(`rakeezx.${name}(`)).source.trimEnd() + ';\n';
const replace = (body, before, after) => {
  assert.ok(body.includes(before), `Source binding missing: ${before}`);
  return body.replace(before, after);
};
let sql = `-- N94: additive nullable fields; no backfill, data rewrite or bulk projection.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table rakeezx.score_subitems
  add column start_date date,
  add column due_date date,
  add column late_points numeric,
  add constraint n94_subitem_dates check (start_date is null or due_date is null or due_date >= start_date),
  add constraint n94_late_points check (late_points is null or
    (late_points >= 0 and late_points <= value and late_points = round(late_points,2)));
alter table rakeezx.score_subitem_completions
  add column completion_state text,
  add constraint n94_completion_state check (completion_state is null or
    (checked and completion_state in ('regular','late')));
`;
let map = source('sync_v2_field_map');
map = replace(map, 'select case p_entity', `select case p_entity
when 'score_subitems' then '{"item_id":"identity","name":"name","value":"configuration","order":"order","distribution_version":"configuration","start_date":"configuration","due_date":"configuration","late_points":"configuration"}'::jsonb
when 'score_subitem_completions' then '{"student_id":"identity","subitem_id":"identity","checked":"state","completion_state":"state"}'::jsonb`);
sql += '\n' + map;
let guard = source('guard_subitem_definition_write');
guard = replace(guard, '  return new;', `  if tg_table_name='score_subitems' and tg_op='UPDATE' and
      new.created_at is distinct from old.created_at then
    raise exception using errcode='42501',message='Subitem creation history is immutable';
  end if;
  return new;`);
sql += '\n' + guard;
const points = `case when c.completion_state='late' then coalesce(d.late_points,d.value) else d.value end`;
sql += '\n' + replace(source('recompute_subitem_score'), 'sum(d.value)', `sum(${points})`);
sql += '\n' + replace(source('assert_score_provenance_consistent'), 'sum(d.value)', `sum(${points})`);

// Old endpoint and receipt envelopes stay callable/replay-identical; a deliberate
// legacy boolean action explicitly chooses regular or clears the selected state.
let legacy = source('apply_score_subitem_command');
legacy = replace(legacy, 'subitem_id,checked,device_id)', 'subitem_id,checked,completion_state,device_id)');
legacy = replace(legacy, 'p_subitem_id,p_checked,p_device_id)', "p_subitem_id,p_checked,case when p_checked then 'regular' else null end,p_device_id)");
legacy = replace(legacy, 'set checked=excluded.checked,device_id=excluded.device_id', 'set checked=excluded.checked,completion_state=excluded.completion_state,device_id=excluded.device_id');
sql += '\n' + legacy;

let selected = source('apply_score_subitem_command');
selected = replace(selected, 'rakeezx.apply_score_subitem_command(', 'rakeezx.apply_score_subitem_command_n94(');
selected = replace(selected, 'p_checked boolean DEFAULT NULL::boolean', 'p_completion_state text DEFAULT NULL::text');
selected = replace(selected, "p_command not in ('set_completion','set_manual')", "p_command is null or p_command not in ('set_completion','set_manual')");
selected = replace(selected, 'p_checked is null', "(p_completion_state is not null and p_completion_state not in ('regular','late'))");
selected = replace(selected, 'p_checked is not null', 'p_completion_state is not null');
selected = replace(selected, "'checked',p_checked", "'completionState',p_completion_state");
selected = replace(selected, 'subitem_id,checked,device_id)', 'subitem_id,checked,completion_state,device_id)');
selected = replace(selected, 'p_subitem_id,p_checked,p_device_id)', 'p_subitem_id,p_completion_state is not null,p_completion_state,p_device_id)');
selected = replace(selected, 'set checked=excluded.checked,device_id=excluded.device_id', 'set checked=excluded.checked,completion_state=excluded.completion_state,device_id=excluded.device_id');
assert.ok(!selected.includes('p_checked'));
sql += '\n' + selected + `
revoke all on function rakeezx.apply_score_subitem_command_n94(text,text,text,text,text,text,text,numeric) from public,anon;
grant execute on function rakeezx.apply_score_subitem_command_n94(text,text,text,text,text,text,text,numeric) to authenticated;
`;

let config = source('apply_score_configuration_command');
config = replace(config, 'v_count integer;', 'v_start date; v_due date; v_late numeric; v_old rakeezx.score_subitems%rowtype;\n  v_count integer;');
config = replace(config, '      insert into rakeezx.score_subitems', `      select * into v_old from rakeezx.score_subitems where owner_id=v_owner and id=v_id;
      v_start:=case when v_definition ? 'startDate' then nullif(v_definition->>'startDate','')::date else v_old.start_date end;
      v_due:=case when v_definition ? 'dueDate' then nullif(v_definition->>'dueDate','')::date else v_old.due_date end;
      v_late:=case when v_definition ? 'latePoints' then nullif(v_definition->>'latePoints','')::numeric else v_old.late_points end;
      insert into rakeezx.score_subitems`);
config = replace(config, '"order",distribution_version,device_id)', '"order",distribution_version,start_date,due_date,late_points,device_id)');
config = replace(config, 'v_order,p_expected_version+1,p_device_id)', 'v_order,p_expected_version+1,v_start,v_due,v_late,p_device_id)');
config = replace(config, '"order"=excluded."order",distribution_version=excluded.distribution_version,device_id=excluded.device_id;',
  '"order"=excluded."order",distribution_version=excluded.distribution_version,\n          start_date=excluded.start_date,due_date=excluded.due_date,late_points=excluded.late_points,device_id=excluded.device_id;');
sql += '\n' + config;
let copy = source('apply_score_distribution_copy_command');
copy = replace(copy, '"order",distribution_version,device_id)', '"order",distribution_version,start_date,due_date,late_points,device_id)');
copy = replace(copy, 'v_definition."order",1,p_device_id)', 'v_definition."order",1,v_definition.start_date,v_definition.due_date,v_definition.late_points,p_device_id)');
sql += '\n' + copy;

// created_at is explicitly allowed only for restore creation, not generic Sync.
let stage = source('stage_sync_v2_restore_score_v2');
stage = replace(stage, '    if v_allowed is null', `    if v_entity='score_subitems' and v_action in ('create','create_deleted') then
      v_allowed:=v_allowed||'{"created_at":1}'::jsonb;
      if v_patch ? 'created_at' and ((v_patch->>'created_at') is null or
          not pg_catalog.isfinite((v_patch->>'created_at')::timestamptz) or
          (v_patch->>'created_at')::timestamptz <= '1970-01-01'::timestamptz) then
        raise exception using errcode='22023',message='Invalid subitem creation history';
      end if;
    end if;
    if v_allowed is null`);
sql += '\n' + stage;
sql += '\n' + replace(source('score_foundation_capability'), "'copyDomainVersion',1", "'copyDomainVersion',1,'n94SubitemVersion',1");
sql += "\nnotify pgrst, 'reload schema';\n";
const dir = new URL('../../supabase/migrations/', import.meta.url);
const names = (await readdir(dir)).filter((name) => name.endsWith('_n94_subitem_dates_late_scoring.sql'));
assert.equal(names.length, 1, 'Create exactly one migration with the supported Supabase CLI');
await writeFile(new URL(names[0], dir), sql);
console.log(names[0]);
