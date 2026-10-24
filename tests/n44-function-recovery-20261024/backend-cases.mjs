// AI: actual backend/Auth verifier/repository/source reader against owned native PostgreSQL.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBackend} from '../../drafts/n44-push/backend.mjs';
import {createPushGateway} from '../../src/lib/notification-push-gateway.js';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', S='11111111-1111-4111-8111-111111111111';
export async function qualify({a:admin,pool,report}){
 const pass=(name,evidence)=>report.checks.push({name,status:'PASS',evidence});
 await admin.query(await readFile('tests/fixtures/n44-activation/canonical.sql','utf8'));
 const metadata=JSON.parse(await readFile('drafts/n44-push/activation/metadata-contract.json','utf8'));
 for(const x of metadata.columns.filter(x=>x.schema==='rakeezx'&&x.nullable==='NO')){assert.match(x.table,/^[a-z_]+$/);assert.match(x.column,/^[a-z_]+$/);await admin.query(`alter table rakeezx.${x.table} alter column "${x.column}" set not null`);}
 for(const t of new Set(metadata.columns.filter(x=>x.schema==='rakeezx').map(x=>x.table)))await admin.query(`alter table rakeezx.${t} force row level security; alter table rakeezx.${t} owner to postgres`);
 await admin.query('grant references(id) on auth.users to postgres');
 await admin.query('set role postgres');await admin.query(await readFile('supabase/migrations/20261018044448_n44_exact_activation_staged.sql','utf8'));await admin.query('reset role');
 await admin.query("insert into rakeezx.years(owner_id,id,status,hijri_start,hijri_end) values($1,'y','active',1448,1449)",[A]);
 await admin.query("insert into rakeezx.subjects(owner_id,id) values($1,'subject')",[A]);
 await admin.query("insert into rakeezx.sections(owner_id,id,year_id,status) values($1,'section','y','active')",[A]);
 await admin.query("insert into rakeezx.terms(owner_id,id,year_id,\"index\",status,start_date,end_date) values($1,'term','y',1,'active','2026-10-01','2026-12-01')",[A]);
 await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,'teaching','section','subject','term')",[A]);
 await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,score_mode) values($1,'item','teaching','subitems')",[A]);
 await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,start_date,due_date) values($1,'sub','item','2026-10-01','2026-10-01')",[A]);
 const p=pool();let unknownCommit=false,abortBeforeCommit=null;const trace=[];
 const acquire=async()=>{const c=await p.connect();let authTransaction=false;return {async query(sql,v){trace.push(sql);if(sql.includes('lock_current_session'))authTransaction=true;const result=await c.query(sql,v);if(sql==='commit'&&authTransaction&&unknownCommit){unknownCommit=false;throw Error('synthetic lost outer COMMIT ACK');}if(sql==='release savepoint n44_owner'&&abortBeforeCommit)abortBeforeCommit.abort();return result;},release(){c.release();}};};
 const now=Date.now(),source='a'.repeat(40),authUrl='https://auth.synthetic.invalid';
 const profile={v:2,approvalState:'active',approvalId:'a'.repeat(64),serviceRevision:'n44-browser-service-v2',serviceSourceSha:source,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:'b'.repeat(64),observedAt:now-1000,activatedAt:now-500};
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic',alg:'ES256',use:'sig'};
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const unsigned=encode({alg:'ES256',kid:'synthetic',typ:'JWT'})+'.'+encode({iss:authUrl+'/auth/v1',aud:'authenticated',role:'authenticated',sub:A,session_id:S,iat:Math.floor(now/1000)-1,exp:Math.floor(now/1000)+3600});
 const authorization='Bearer '+unsigned+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(unsigned))).toString('base64url');
 const backend=createBackend({acquire,authUrl,apiKey:'FABRICATED_PUBLIC',fetch:async url=>{assert.ok([authUrl+'/auth/v1/.well-known/jwks.json',authUrl+'/auth/v1/user'].includes(url));return url.endsWith('jwks.json')?Response.json({keys:[jwk]}):Response.json({id:A,is_anonymous:false});},providerOrigins:[],crypto:{sender:{send(){assert.fail('no send');}}},rateKey:Buffer.alloc(32,1),sessionPolicy:profile,serviceSourceSha:source,deliveryEnabled:false});
 const preferences={lesson:true,due:true,lessonMinutes:15,dueDays:[0],timezone:'Asia/Riyadh',quiet:null},scope={workspaceId:'workspace',deviceId:'device'};
 const call=(path,b,signal)=>backend.teacher('/'+path,authorization,b,signal);
 const ctx=await call('context/update',{...scope,preferences,pushConsent:true,expectedRevision:null});assert.equal(ctx.status,'updated');
 const project=stamp=>call('events/update',{...scope,kind:'due',sourceId:'sub',expectedStamp:stamp});
 const first=await project(null);assert.equal(first.status,'updated');assert.equal((await admin.query('select * from n44_push_draft.events')).rowCount,0);
 await admin.query("update rakeezx.score_subitems set due_date=current_date,revision=revision+1 where owner_id=$1 and id='sub'",[A]);
 const next=await project(first.sourceStamp);
 if(process.argv.includes('--baseline')){
  assert.match(first.sourceStamp,/^[a-f0-9]{64}$/);assert.deepEqual(next,{status:'stale'});pass('reproduced zero-event CAS dead end','Actual canonical expired due -> zero inserts/non-null stamp -> canonical revision edit -> stale without stamp; outer COMMIT observed.');return;
 }
 assert.equal(first.sourceStamp,null);assert.equal(next.status,'updated');assert.match(next.sourceStamp,/^[a-f0-9]{64}$/);assert.equal((await admin.query('select * from n44_push_draft.events')).rowCount,1);pass('expired zero-event canonical edit recovers','Actual PG canonical revision + current-date due; zero rows ACK null; next projection creates exactly one event.');
 await project(next.sourceStamp);assert.equal((await admin.query('select * from n44_push_draft.events')).rowCount,1);
 // Old deployed clients/stale retained stamps recover once through null CAS.
 await admin.query('delete from n44_push_draft.events');let requests=0;
 const gateway=createPushGateway({authorization,context:{ownerId:A,...scope},preferences:()=>preferences,storage:{getItem:()=>null},fetch:async(url,init)=>{requests++;return Response.json(await call('events/update',JSON.parse(init.body)));}});
 const recovered=await gateway.project('due','sub',next.sourceStamp);assert.match(recovered,/^[a-f0-9]{64}$/);assert.equal(requests,2);assert.equal((await admin.query('select * from n44_push_draft.events')).rowCount,1);pass('retained old stamp null CAS recovery bounded/idempotent','Actual gateway/backend/PG; one stale + one retry, exactly one event, no send.');
 await admin.query("update rakeezx.score_subitems set due_date=null,revision=revision+1 where owner_id=$1 and id='sub'",[A]);const empty=await project(recovered);assert.equal(empty.sourceStamp,null);assert.equal((await admin.query('select * from n44_push_draft.events')).rowCount,0);
 await admin.query("update rakeezx.score_subitems set due_date=current_date,revision=revision+1 where owner_id=$1 and id='sub'",[A]);assert.equal((await project(null)).status,'updated');pass('current canonical removal and re-eligibility','Actual child revisions delete old events; null CAS correctly admits newly eligible canonical source.');
 // No result ACK after an actual COMMIT whose response was lost.
 const prior=(await admin.query('select source_stamp from n44_push_draft.events')).rows[0].source_stamp;
 await admin.query("update rakeezx.score_subitems set revision=revision+1 where owner_id=$1 and id='sub'",[A]);
 unknownCommit=true;await assert.rejects(project(prior));assert.ok(trace.includes('commit'));
 const committed=(await admin.query('select source_stamp from n44_push_draft.events')).rows;assert.equal(committed.length,1);assert.notEqual(committed[0].source_stamp,prior);
 pass('UNKNOWN COMMIT never becomes projection ACK','Driver executes outer authenticated projection COMMIT then throws; changed canonical stamp persisted once, teacher rejects, no fabricated ACK.');
 const before=(await admin.query('select * from n44_push_draft.events')).rows;
 const foreign=await call('events/update',{...scope,deviceId:'foreign',kind:'due',sourceId:'sub',expectedStamp:null}).then(()=>false,()=>true);assert.equal(foreign,true);assert.deepEqual((await admin.query('select * from n44_push_draft.events')).rows,before);
 const controller=new AbortController();controller.abort();await assert.rejects(call('events/update',{...scope,kind:'due',sourceId:'sub',expectedStamp:null},controller.signal));
 await admin.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[S]);assert.equal((await project(null)).status,'rejected');await admin.query('update auth.sessions set not_after=null where id=$1',[S]);pass('foreign device, cancellation and expired session fences','Actual backend/helper/PG owner/session locks refuse without changing event rows.');
 assert.equal((await backend.schedule({operation:'due'})).status,'disabled');pass('general delivery remains OFF','No sender invocation or scheduler activation in any scenario.');
}
