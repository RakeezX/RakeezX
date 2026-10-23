/** AI-authored. Local-only bounded SQL experiment, NOT a deployable service change.
 * The unchanged private boundary must reject this new SQL. Never install a new
 * boundary, regenerate identities, or fall back to direct SQL in Product.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startNativePg,canonicalRoot} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {readCanonical} from '../../drafts/n88-student-portal/integrated-service.mjs';
import {CANONICAL_PROJECTION_REQUIREMENTS,projectStudentPortal,studentPortalPublicationBindings} from '../../drafts/n88-student-portal/student-projection.mjs';
import {assertVerifiedBoundary,privateQuery} from '../../drafts/n88-student-portal/activation/private-error-boundary.mjs';
import {createPostgresRepository} from '../../drafts/n88-student-portal/postgres-repository.mjs';

const taskId='continuous-n88-read-roundtrip-outcome-20261023',runId='8693cc32-ba12-47fe-a7d4-941f12950d87';
const baseSha='4ee4608c3a043f8ff27fd1c90d0ba652bc7e558b';
const dir='tests/n88-read-roundtrip-outcome-20261023/',file='drafts/n88-student-portal/integrated-service.mjs';
const repositoryOnly=process.argv.includes('--repository-only');
const source=(await readFile(file,'utf8')).replaceAll('\r\n','\n');
assert.equal(source,execFileSync('git',['show',baseSha+':'+file],{encoding:'utf8'}).replaceAll('\r\n','\n'),'production reader remains supported by its existing typed boundary');
const {columns,sqlNames,numeric}=vm.runInNewContext(source.slice(source.indexOf('const sqlNames='),source.indexOf('export async function readCanonical'))+';({columns,sqlNames,numeric})');
const tables=CANONICAL_PROJECTION_REQUIREMENTS.tables,limit=2*1024*1024;
const camel=s=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const lock=list=>list?'select n88_private.lock_canonical_sources($1::uuid,$2::integer)':'select n88_private.lock_projection_sources($1::uuid,$2::integer)';
// Only source-derived fixed allowlist identifiers; ownership/limits stay bound.
// Each branch is bounded BEFORE the global byte window. No JSON aggregate.
function batchSql(list=false){
 const selectedTables=list?['terms','teachings']:tables;
 const branches=selectedTables.map((table,index)=>{
  const selected=columns[table].replace(/\brevision\b/g,'revision::text as revision');
  return `select ${index} as table_index,x.id,row_to_json(x)::text as payload from (select ${selected} from rakeezx.${sqlNames[table]||table} where owner_id=$1::uuid order by id limit $2) x`;
 });
 return `select table_index,case when octet_length(payload)<=$3 and sum(octet_length(payload)) over (order by table_index,id rows unbounded preceding)<=$3 then payload else null end as payload from (${branches.join(' union all ')}) bounded order by table_index,id`;
}
async function experimentalRead(ports,ownerId,list=false){
 await ports.query(lock(list),[ownerId,2000]);
 const names=list?['terms','teachings']:tables,canonical=Object.fromEntries(names.map(t=>[t,[]]));let bytes=0;
 const result=await ports.query(batchSql(list),[ownerId,2001,limit]);
 for(const {table_index,payload} of result.rows){
  const rows=canonical[names[table_index]];
  if(!rows||rows.length>=2000||typeof payload!=='string'||(bytes+=Buffer.byteLength(payload))>limit)throw Error('n88_projection_bound');
  const row=Object.fromEntries(Object.entries(JSON.parse(payload)).map(([k,v])=>[camel(k),v]));
  row.deleted=row.deletedAt!==null;for(const k of numeric)if(row[k]!=null)row[k]=Number(row[k]);rows.push(row);
 }
 return canonical;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report=repositoryOnly?JSON.parse(await readFile(dir+'initial-harness-failure.json','utf8')):{taskId,runId,baseSha,sourceSha256:createHash('sha256').update(source).digest('hex'),status:'FAIL',scope:'Fabricated owned native PG17; direct SQL experiment before testing unchanged real service boundary. No hosted or UI performance claim.',measurements:[],guards:[],cleanup:{}};
if(repositoryOnly){assert.equal(report.sourceSha256,createHash('sha256').update(source).digest('hex'));assert(report.projectionEqual&&report.boundary.experimentalBatchRejected);delete report.failure;report.cleanup={};report.guards=report.guards.map(s=>s.replace('cross-table aggregate','cumulative row aggregate'));report.reusedMeasurement='initial-harness-failure.json; only missing explicit repository options corrected; no timing/canonical-bound-negative replay';}
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds',action==='acquire'?'30':'0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:45000}).trim();
let pg,c,leased=false,failure;
async function tx(read,{cost=0,list=false,ports=null}={}){
 await c.query('begin isolation level read committed');
 try{
  await c.query("set local TimeZone='UTC'");await c.query('select pg_advisory_xact_lock(1312307256,88)');
  let queries=0,payloadBytes=0,nulls=0;
  const query=async(sql,args)=>{queries++;if(cost)await sleep(cost);const r=await c.query(sql,args);for(const row of r.rows){if(row.payload===null)nulls++;if(typeof row.payload==='string')payloadBytes+=Buffer.byteLength(row.payload);}return r;};
  const start=performance.now(),canonical=await read(ports??{query},owner,list);
  return {canonical,queryCount:queries,wallMs:Math.round((performance.now()-start)*100)/100,injectedTransportMs:queries*cost,payloadBytes,nulls};
 }finally{await c.query('rollback');}
}
function projection(canonical){
 const input={teacherContextVersion:'n88-canonical-teacher-context-v1',canonical,ownerId:owner,studentId:'student',enrollmentId:'enrollment',classId:'class',termId:'term',now:'2026-10-23'};
 const b=studentPortalPublicationBindings(input);
 input.visibility={version:'n88-visibility-v1',...Object.fromEntries(['ownerId','studentId','enrollmentId','classId','termId'].map(k=>[k,input[k]])),scopeStamp:b.scopeStamp,fields:{name:true,class:true,grades:true,required:true,completed:true,scheduled:true},sources:b.sources.map((s,i)=>({...s,publicationId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')}))};
 return projectStudentPortal(input);
}
try{
 assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);leased=true;
 pg=await startNativePg(process.cwd());c=await pg.acquire();
 const q=pg.fixtureQuery;
 if(!repositoryOnly){
 // One meaningful comparison; same exclusive client, owner, fixture, lock,
 // isolation, 25ms fixed cost PER awaited application query (including lock).
 const baseline=await tx(readCanonical,{cost:25}),candidate=await tx(experimentalRead,{cost:25});
 assert.deepEqual(candidate.canonical,baseline.canonical);assert.deepEqual(projection(candidate.canonical),projection(baseline.canonical));
 assert.equal(baseline.queryCount,14);assert.equal(candidate.queryCount,2);assert(candidate.wallMs<baseline.wallMs);
 assert.equal(candidate.payloadBytes,baseline.payloadBytes);
 for(const [name,r] of [['baseline',baseline],['experimentalBatch',candidate]]){const {canonical,...metrics}=r;report.measurements.push({name,...metrics});}
 report.projectionEqual=true;report.payloadEqual=true;
 for(const list of [true,false])assert.deepEqual((await tx(experimentalRead,{list})).canonical,(await tx(readCanonical,{list})).canonical);
 report.guards.push('full and terms/teachings admission reads match including empty tables and deterministic table/id order');
 await q('insert into rakeezx.students(owner_id,id,revision,name,status) values($1,\'foreign-secret\',1,\'FOREIGN_SECRET\',\'active\')',[other]);
 for(const read of [readCanonical,experimentalRead])assert(!JSON.stringify((await tx(read)).canonical).includes('FOREIGN_SECRET'));
 await q("update rakeezx.students set revision=9007199254740993,name='FRESH_SYNTHETIC' where owner_id=$1 and id='student'",[owner]);
 for(const read of [readCanonical,experimentalRead]){const student=(await tx(read)).canonical.students.find(s=>s.id==='student');assert.equal(student.revision,'9007199254740993');assert.equal(student.name,'FRESH_SYNTHETIC');}
 report.guards.push('foreign owner excluded; next request observes current name/revision; bigint >2^53 remains exact text');
 // Exact 2000 allowed, 2001 rejected with the original source lock intact.
 await q("insert into rakeezx.students(owner_id,id,revision,name,status) select $1,'bound-'||lpad(n::text,4,'0'),1,'مصطنع','active' from generate_series(1,1998) n",[owner]);
 for(const read of [readCanonical,experimentalRead])assert.equal((await tx(read)).canonical.students.length,2000);
 await q("insert into rakeezx.students(owner_id,id,revision,name,status) values($1,'bound-over',1,'x','active')",[owner]);
 for(const read of [readCanonical,experimentalRead])await assert.rejects(()=>tx(read));
 await q("delete from rakeezx.students where owner_id=$1 and id like 'bound-%'",[owner]);
 report.guards.push('2000 accepted; 2001 fails closed at unchanged lock; valid child/parent fixture dependencies retained');
 // Cumulative row overflow: each payload <2MB but together >2MB.
 await q("update rakeezx.students set name=repeat('س',600000) where owner_id=$1",[owner]);
 for(const read of [readCanonical,experimentalRead])await assert.rejects(()=>tx(read),/n88_projection_bound/);
 await q("update rakeezx.students set name=repeat('س',1100000) where owner_id=$1 and id='student'",[owner]);
 for(const read of [readCanonical,experimentalRead])await assert.rejects(()=>tx(read),/n88_projection_bound/);
 await q("update rakeezx.students set name='مصطنع' where owner_id=$1",[owner]);
 report.guards.push('cumulative row aggregate and single UTF8 payload >2MB produce null-sentinel rejection; no unbounded JSON aggregate');
 for(const read of [readCanonical,experimentalRead])await assert.rejects(()=>read({query:async sql=>sql.includes('lock_')?{rows:[]}:{rows:[{table_index:0,payload:null}]}},owner),/n88_projection_bound/);
 }
 // Load ONLY the existing immutable boundary into this fabricated cluster.
 c.release();c=null;
 await q('set role postgres');await q(await readFile('supabase/migrations/20261018185300_n88_private_error_boundary_staged.sql','utf8'));await q('reset role');
 let reachedDriver=0;
 c=await pg.acquire();const verified={query:(...args)=>{reachedDriver++;return c.query(...args);}};
 await assertVerifiedBoundary(verified);
 await c.query('begin');await readCanonical({query:(sql,args)=>privateQuery(verified,sql,args)},owner);await c.query('rollback');
 const before=reachedDriver;
 await assert.rejects(()=>privateQuery(verified,batchSql(),[owner,2001,limit]),/n88_database_unavailable/);
 assert.equal(reachedDriver,before,'unsupported batch never reaches driver');
 report.boundary={baselineAccepted:true,experimentalBatchRejected:true,error:'n88_database_unavailable',batchDriverCalls:reachedDriver-before};
 c.release();c=null;
 // Actual repository must fail closed on unsupported operation and preserve
 // rollback/release; no raw SQL fallback or weakening of the guard.
 const commands=[];
 const deployment=JSON.parse(await readFile('drafts/n88-student-portal/deployment.inactive.json','utf8'));
 const repository=createPostgresRepository({limits:deployment.limits,timing:deployment.timing,acquire:async()=>{const inner=await pg.acquire();return {query:(sql,args)=>{commands.push(sql);return inner.query(sql,args);},release:e=>{commands.push(e?'release-broken':'release-clean');inner.release(e);}};}});
 await repository.transaction(async(_db,ports)=>{await readCanonical(ports,owner);return {ok:true};});
 assert(commands.includes('commit'));assert.equal(commands.at(-1),'release-clean');commands.length=0;
 await assert.rejects(()=>repository.transaction(async(_db,ports)=>{await ports.query(batchSql(),[owner,2001,limit]);return {ok:true};}),/n88_repository_unavailable/);
 assert(commands.includes('rollback'));assert(!commands.includes('commit'));assert.equal(commands.at(-1),'release-broken');
 report.guards.push('actual verified repository: existing reader COMMIT ACK succeeds; new batch rejected before SQL, rolls back, destroys lease and returns no success');
 report.localStatus='LOCAL_VALIDATED';report.activation='BLOCKED: new fixed typed operation/identity requires separately authorized original-service custodian integration; no hosted service allowance on this card';
 report.status='PASS';
}catch(e){failure=e;report.failure={name:e.name,message:e.message,code:e.code??null,stack:e.stack};}
finally{
 c?.release();if(pg){await pg.close();report.cleanup.ownedNativePgStoppedAndRemoved=true;}
 if(leased){report.cleanup.integrationLease=lease('release');}
 await writeFile(dir+'result.json',JSON.stringify(report,null,2)+'\n');
}
if(failure)throw failure;
console.log(JSON.stringify(report,null,2));
