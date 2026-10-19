// AI: targeted native qualification of the one authorized signature correction.
import assert from 'node:assert/strict';
import { bootstrapPublicSchema } from './native-cases.mjs';
const A='11111111-1111-4111-8111-111111111111';
const signature='rakeezx.apply_sync_v2_section_lifecycle_command(text,text,text,text,date,bigint)';
const delegate='rakeezx.apply_sync_v2_section_lifecycle_command_before_student_0029(text,text,text,text,date,bigint)';
export async function qualify({a,b,sql,report,root}) {
  const q=(s,v=[])=>a.query(s,v);
  const check=async(name,fn)=>{const e={name,status:'FAIL'};report.checks.push(e);e.evidence=await fn();e.status='PASS';};
  await bootstrapPublicSchema({a,report,root});
  const catalog=async sig=>(await q(`select pg_get_functiondef(p.oid) definition,
    pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.prosecdef security_definer,p.proconfig config,
    md5(replace(p.prosrc,E'\r\n',E'\n')) body_md5_lf from pg_proc p where p.oid=$1::regprocedure`,[sig])).rows[0];
  const before=await catalog(signature),innerBefore=await catalog(delegate);
  report.wrapperBefore=before;report.delegateBefore=innerBefore;
  await check('exact_corrected_source_keeps_public_wrapper_owner_acl_and_entry_order',async()=>{
    assert.equal(report.schemaSha256,'f023d560fbbc1124afd322c4dfa61ea61f6d6422f1fd3d136db117f38e119306');
    assert.equal(before.body_md5_lf,'c97cc4db769bd3c590cf161172b136e6','Native bootstrap matches observed hosted public wrapper');
    const lock=before.definition.indexOf('perform rakeezx.lock_student_lifecycle(auth.uid());');
    const call=before.definition.indexOf('return rakeezx.apply_sync_v2_section_lifecycle_command_before_student_0029(');
    assert.ok(lock>0&&call>lock);
    await q(sql);
    report.wrapperAfter=await catalog(signature);report.delegateAfter=await catalog(delegate);
    assert.deepEqual(report.wrapperAfter,before);
    assert.equal(report.delegateAfter.owner,innerBefore.owner);assert.equal(report.delegateAfter.acl,innerBefore.acl);
    assert.ok(report.delegateAfter.definition.includes("other_slot.kind in ('activity','waiting')"));
    assert.ok(report.delegateAfter.definition.includes('other_slot.term_id=own_t.term_id'));
    return 'Actual catalog definition, owner, ACL, security mode and search path unchanged; early mutex precedes exact modified delegate.';
  });
  await q(`insert into auth.users(id) values('${A}'); select set_config('request.jwt.claim.sub','${A}',false);
    insert into rakeezx.years(id,label,hijri_start,hijri_end) values('n122-guard-y','synthetic',1500,1501);
    insert into rakeezx.terms(id,year_id,name,"index",status) values('n122-guard-t','n122-guard-y','synthetic',1,'active');
    insert into rakeezx.subjects(id,name,slug) values('n122-guard-sub','synthetic','n122-guard-sub');
    insert into rakeezx.sections(id,year_id,grade,label,name) values('n122-guard-sec','n122-guard-y',4,'A','synthetic');
    insert into rakeezx.teachings(id,section_id,subject_id,term_id) values('n122-guard-tch','n122-guard-sec','n122-guard-sub','n122-guard-t');
    insert into rakeezx.slots(id,teaching_id,weekday,period) values('n122-guard-academic','n122-guard-tch',1,1);
    set role authenticated;`);
  let seq=0;
  const tryMutex=async()=>{
    await b.query('begin');
    try{return (await b.query("select pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired",[A+':student-lifecycle-safety'])).rows[0].acquired;}
    finally{await b.query('rollback');}
  };
  const command=async(kind,expected)=>{
    await q('begin');
    try{
      const r=(await q('select rakeezx.apply_sync_v2_section_lifecycle_command($1,$2,$3,$4,$5,$6) r',
        ['n122-guard-'+(++seq),'n122-guard-device',kind,'n122-guard-sec',kind==='archive_class'?'2026-10-19':null,1000+seq])).rows[0].r;
      assert.equal(r.outcome,expected);
      assert.equal(await tryMutex(),false,'Second connection cannot acquire owner mutex after RPC returns inside transaction');
      await q('commit');
      assert.equal(await tryMutex(),true,'Owner mutex released only at transaction end');
      return r;
    }catch(e){await q('rollback');throw e;}
  };
  await check('public_academic_archive_reopen_retains_owner_mutex_until_transaction_end',async()=>{
    await command('archive_class','archived');await command('reopen_class','reopened');
    return 'Public RPC archived/reopened academic section; independent connection try-lock false before commit and true after each commit.';
  });
  await check('public_activity_waiting_conflicts_preserve_entry_mutex_and_retained_slot',async()=>{
    await command('archive_class','archived');
    for(const kind of ['activity','waiting']) {
      const id='n122-guard-'+kind;
      const created=(await q("select rakeezx.apply_sync_v2_mutation('slots',$1,$2,'n122-guard-device',0,$3::jsonb,'create',2000) r",
        [id,id+'-create',JSON.stringify({kind,teaching_id:null,term_id:'n122-guard-t',weekday:1,period:1})])).rows[0].r;
      assert.equal(created.outcome,'applied');
      await command('reopen_class','rejected_slot_conflict');
      const retained=(await q('select kind,term_id,teaching_id,deleted_at from rakeezx.slots where id=$1',[id])).rows[0];
      assert.deepEqual(retained,{kind,term_id:'n122-guard-t',teaching_id:null,deleted_at:null});
      assert.equal((await q("select status from rakeezx.sections where id='n122-guard-sec'")).rows[0].status,'archived');
      const removed=(await q("select rakeezx.apply_sync_v2_mutation('slots',$1,$2,'n122-guard-device',$3,'{}'::jsonb,'delete',3000) r",
        [id,id+'-delete',created.resultRevision])).rows[0].r;
      assert.equal(removed.outcome,'deleted');
    }
    await command('reopen_class','reopened');
    return 'Actual public wrapper rejected both independent kinds, retained their identity/term, kept section archived and held mutex until commit; academic reopening succeeded after explicit fixture tombstones.';
  });
  await check('n122_preserved_lifecycle_entry_guard_before_exact_hosted_apply',async()=>{
    assert.deepEqual(await catalog(signature),before);
    return 'Corrected exact SQL qualified with native public RPC and second-connection transaction lock proof; no UI/old feature suite replay.';
  });
}
