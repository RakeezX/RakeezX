import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function unifiedNativeChecks({q,owner,other}) {
 const checks=[],record=(name,evidence)=>{checks.push({name,status:'PASS',evidence});console.log('PASS '+name);};
 const apply=(id,b)=>q('select rakeezx.apply_unified_student_grade_import($1,$2,$3) result',[id,'native-unified',b]).then(r=>r.rows[0].result);
 const revision=async(table,id)=>(await q(`select revision from rakeezx.${table} where id=$1`,[id])).rows[0].revision;
 const batch=async()=>({teachingId:'t',sectionId:'section',termId:'term',teachingRevision:await revision('teachings','t'),newItems:[],enrollmentConfirmed:true,overwriteConfirmed:false,
  newStudents:[{id:'new-u',enrollmentId:'en-u',name:'طالب جديد تجريبي'}],cells:[{studentId:'new-u',itemId:'i',itemRevision:await revision('items','i'),max:20,scoreId:null,scoreRevision:0,old:null,value:5}]});
 const state=()=>q(`select jsonb_build_object('items',(select jsonb_agg(to_jsonb(i) order by id) from rakeezx.items i),'students',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.students s),'enrollments',(select jsonb_agg(to_jsonb(e) order by id) from rakeezx.enrollments e),'scores',(select jsonb_agg(to_jsonb(s) order by id) from rakeezx.scores s),'receipts',(select jsonb_agg(to_jsonb(r) order by mutation_id) from rakeezx.score_domain_receipts r)) result`).then(r=>r.rows[0].result);
 const original=await state(),b=await batch();
 for (const [name,edit] of [['upper-unreviewed',b=>b.cells[0].value=21],['numeric-name',b=>b.newStudents[0].name='123'],['formula-name',b=>b.newStudents[0].name='=SUM(1)'],['negative',b=>b.cells[0].value=-1],['invalid',b=>b.cells[0].value='text'],['max',b=>b.cells[0].max=19],['revision',b=>b.cells[0].itemRevision=0],['enroll-consent',b=>b.enrollmentConfirmed=false],['duplicate-name',b=>b.newStudents.push({id:'new2',enrollmentId:'en2',name:'طالب جديد تجريبي'})],['existing-name',b=>b.newStudents[0].name='أحمد سالم'],['existing-id',b=>b.newStudents[0].id='a'],['outside-section',b=>b.sectionId='wrong']]) {
  const x=structuredClone(b);edit(x);await assert.rejects(()=>apply('bad-'+name,x));assert.deepEqual(await state(),original,name);
 }
 record('unified_validation_atomicity','Unreviewed upper mark, negative/text, stale max/revision, enrollment consent, duplicate/existing name or identity and wrong section reject before any durable student/enrollment/grade/receipt.');
 await q(`create function rakeezx.n90_unified_failure() returns trigger language plpgsql as $$begin if new.student_id='new-u' then raise exception 'synthetic unified late failure';end if;return new;end$$; create trigger n90_unified_failure before insert on rakeezx.scores for each row execute function rakeezx.n90_unified_failure();`);
 await assert.rejects(()=>apply('late-failure',b),/synthetic unified late failure/);assert.deepEqual(await state(),original);
 await q('drop trigger n90_unified_failure on rakeezx.scores;drop function rakeezx.n90_unified_failure()');
 record('unified_late_score_rollback','Injected real PostgreSQL score trigger failure after student and enrollment inserts rolls back every row and receipt.');
 await q(`select set_config('request.jwt.claim.sub','${other}',false);set role authenticated;`);await assert.rejects(()=>apply('owner-negative',b));assert.equal((await q('select * from rakeezx.students')).rowCount,0);
 await q(`reset role;select set_config('request.jwt.claim.sub','${owner}',false);`);assert.deepEqual(await state(),original);
 const receipt=await apply('unified-ok',b);assert.equal(receipt.protocol,'N90_UNIFIED_V1');assert.equal(receipt.students[0].id,'new-u');assert.equal(receipt.enrollments[0].student_id,'new-u');assert.equal(receipt.scores[0].value,5);
 assert.deepEqual(await apply('unified-ok',b),receipt);await q("update rakeezx.scores set value=6 where student_id='new-u'");assert.deepEqual(await apply('unified-ok',b),receipt);assert.equal(Number((await q("select value from rakeezx.scores where student_id='new-u'")).rows[0].value),6);
 const changed=structuredClone(b);changed.newStudents[0].name='Changed';await assert.rejects(()=>apply('unified-ok',changed),e=>e.code==='22023');
 record('unified_owner_exact_retry','Authenticated foreign owner cannot read or apply; same envelope/ID returns exact saved canonical student/enrollment/score receipt and never overwrites later score; changed-envelope reuse rejected.');
 await q("insert into rakeezx.students(id,name,deleted_at) values('deleted-u','طالب محذوف',now())");const deleted=await state();const again=await batch();again.newStudents[0].id='deleted-u';again.newStudents[0].name='اسم آخر';await assert.rejects(()=>apply('reuse-deleted-id',again));assert.deepEqual(await state(),deleted);
 const blank=await batch();blank.newStudents=[{id:'new-blank',enrollmentId:'en-blank',name:'طالب بلا درجة'}];blank.cells=[];const r=await apply('blank',blank);assert.equal(r.scores.length,0);assert.equal(r.students.length,1);assert.deepEqual(await apply('blank',blank),r);
 record('unified_blank_and_deleted_identity','All blank cells can enroll explicitly without inventing zeros; exact retry preserved. Deleted student ID is refused and never resurrected.');
 const combo=await batch();combo.newStudents=[{id:'combo-u',enrollmentId:'combo-e',name:'طالب بند جديد'}];combo.newItems=[{id:'combo-i',name:'بند يدوي جديد',max:5}];combo.overwriteConfirmed=true;combo.cells=['a','combo-u'].map(studentId=>({studentId,itemId:'combo-i',itemRevision:0,max:5,scoreId:null,scoreRevision:0,old:null,value:5}));
 const beforeCombo=await state();await q(`create function rakeezx.n90_combo_failure() returns trigger language plpgsql as $$begin if new.student_id='combo-u' then raise exception 'synthetic combined late failure';end if;return new;end$$;create trigger n90_combo_failure before insert on rakeezx.scores for each row execute function rakeezx.n90_combo_failure();`);
 await assert.rejects(()=>apply('combo-failure',combo),/synthetic combined late failure/);assert.deepEqual(await state(),beforeCombo);await q('drop trigger n90_combo_failure on rakeezx.scores;drop function rakeezx.n90_combo_failure()');
 const comboReceipt=await apply('combo-ok',combo);assert.equal(comboReceipt.students[0].id,'combo-u');assert.equal(comboReceipt.items[0].id,'combo-i');assert.equal(comboReceipt.scores.length,2);assert.deepEqual(await apply('combo-ok',combo),comboReceipt);
 record('unified_student_item_grade_all_or_nothing','Combined student/enrollment + explicitly named manual item + two score cells. Injected second-cell failure rolls back even the first score and new item/identity/receipt; success and exact retry retain stable IDs.');
 const functions=(await q("select p.proname,p.prosecdef,p.proconfig,p.proacl::text acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname in ('unified_student_grade_import_capability','apply_unified_student_grade_import')")).rows;
 await writeFile('test-results/n90-unified-native/unified-functions.json',JSON.stringify(functions,null,2));
 assert.equal(functions.length,2);for(const f of functions){assert.equal(f.prosecdef,true);assert.ok(f.proconfig.includes('search_path=""'));assert.ok(f.acl.includes('authenticated=X')&&!f.acl.includes('anon=')&&!f.acl.includes(',='));}
 const cap=(await q('select rakeezx.unified_student_grade_import_capability() result')).rows[0].result;assert.equal(cap.unifiedProtocol,'N90_UNIFIED_V1');assert.equal(cap.unifiedVersion,1);
 const sql=await readFile('supabase/migrations/20261014100000_n90_unified_student_grade_import.sql','utf8');record('unified_native_source_ACL','Exact additive SQL SHA256 '+createHash('sha256').update(sql).digest('hex')+'; new authenticated-only SECURITY DEFINER/empty search_path functions, existing locks/receipts/grade guards preserved. This is local readback, not remote service application.');
 return checks;
}
