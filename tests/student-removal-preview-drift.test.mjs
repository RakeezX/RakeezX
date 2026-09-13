import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lifecycleServer } from './helpers/student-lifecycle-server.mjs';

const read=name=>readFile(new URL(`../supabase/${name}`,import.meta.url),'utf8');
const baselineHash='5160b50798e8c92c30d66d5db7dab31c8e636c5549e90f7bd4a57719f1054e32';
const metadata=pg=>pg.query(`select encode(sha256(convert_to(replace(prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex') sha,
  to_regprocedure('rakeezx.preview_student_removal(text,text,bigint)') preview,
  to_regprocedure('rakeezx.student_removal_source_blocker(uuid,text,text,bigint)') helper
  from pg_proc where oid='rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure`);

test('approved 0029 baseline passes precheck but correctly fails postcheck before installation',async()=>{
  const pg=await lifecycleServer({migration30:false});
  try {
    assert.equal((await metadata(pg)).rows[0].sha,baselineHash,'same normalized body as live Production');
    await pg.exec(await read('precheck-0030-student-removal-preview.sql'));
    await assert.rejects(pg.exec(await read('verify-0030-student-removal-preview.sql')),error=>{
      assert.match(error.message,/DEFINITION_OR_PRIVILEGE_DRIFT: rakeezx.apply_student_lifecycle_command/);
      const detail=JSON.parse(error.detail);
      assert.equal(detail.actual_source_sha256,baselineHash);
      assert.equal(detail.authenticated_execute,true);assert.equal(detail.anon_execute,false);
      return true;
    });
    await pg.exec('rollback');
    assert.deepEqual((await metadata(pg)).rows[0],{sha:baselineHash,preview:null,helper:null});
  }finally{await pg.close();}
});

test('manual LF and CRLF SQL preserve exactly the approved compiled contract',async()=>{
  for(const eol of ['\n','\r\n']) {
    const pg=await lifecycleServer({migration30:false});
    try {
      const normalize=sql=>sql.replaceAll('\r\n','\n').replaceAll('\n',eol);
      await pg.exec(normalize(await read('precheck-0030-student-removal-preview.sql')));
      await pg.exec(normalize(await read('migrations/0030_student_removal_preview.sql')));
      await pg.exec(normalize(await read('verify-0030-student-removal-preview.sql')));
    }finally{await pg.close();}
  }
});

test('full source and privilege drift fail early in precheck and installation before any new function',async()=>{
  const pg=await lifecycleServer({migration30:false});
  try {
    const pre=await read('precheck-0030-student-removal-preview.sql'),sql=await read('migrations/0030_student_removal_preview.sql');
    await pg.exec('grant execute on function rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint) to anon');
    for(const script of [pre,sql]) {
      await assert.rejects(pg.exec(script),/DEFINITION_OR_PRIVILEGE_DRIFT/);await pg.exec('rollback');
      assert.equal((await metadata(pg)).rows[0].preview,null);assert.equal((await metadata(pg)).rows[0].helper,null);
    }
    await pg.exec('revoke execute on function rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint) from anon');
    const original=(await pg.query(`select pg_get_functiondef('rakeezx.apply_student_lifecycle_command(text,text,text,jsonb,bigint)'::regprocedure) def`)).rows[0].def;
    const altered=original.replace("p_command not in ('delete_pristine','end_enrollment')","p_command not in ('delete_pristine','end_enrollment','unsafe_extra')");
    assert.notEqual(altered,original,'fault fixture must really change the command guard');
    await pg.exec(altered);
    for(const script of [pre,sql]) {
      await assert.rejects(pg.exec(script),/DEFINITION_OR_PRIVILEGE_DRIFT/);await pg.exec('rollback');
      assert.equal((await metadata(pg)).rows[0].helper,null);
    }
  }finally{await pg.close();}
});

test('no-op definition replacement is detected before commit and rolls back all installation',async()=>{
  const pg=await lifecycleServer({migration30:false});
  try {
    const sql=(await read('migrations/0030_student_removal_preview.sql')).replace('execute replace(v_definition,v_body,v_rewritten);','execute v_definition;');
    await assert.rejects(pg.exec(sql),/COMPILED_TRANSFORM_MISMATCH/);await pg.exec('rollback');
    assert.deepEqual((await metadata(pg)).rows[0],{sha:baselineHash,preview:null,helper:null});
  }finally{await pg.close();}
});

test('late compiled privilege mismatch rolls back helper, preview and lifecycle refactor together',async()=>{
  const pg=await lifecycleServer({migration30:false});
  try {
    const sql=(await read('migrations/0030_student_removal_preview.sql')).replace('-- Verify compiled bodies, attributes and effective privileges BEFORE COMMIT.',
      'grant execute on function rakeezx.preview_student_removal(text,text,bigint) to anon;\n-- Verify compiled bodies, attributes and effective privileges BEFORE COMMIT.');
    await assert.rejects(pg.exec(sql),/DEFINITION_OR_PRIVILEGE_DRIFT: rakeezx.preview_student_removal/);await pg.exec('rollback');
    assert.deepEqual((await metadata(pg)).rows[0],{sha:baselineHash,preview:null,helper:null});
  }finally{await pg.close();}
});
