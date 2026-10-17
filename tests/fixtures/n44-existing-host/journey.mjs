/** AI: fabricated signed provider/ingress -> actual Web handlers -> restricted OWNED PG. */
import '../../../drafts/n44-push/node-globals.mjs';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {randomBytes,randomUUID,createECDH} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {validatePoint} from '../../../drafts/n44-push/provider-policy.mjs';
import {createPrivatePushPorts} from '../../../drafts/n44-push/private-runtime.mjs';
import {createWebEntry} from '../../../drafts/n44-push/web-entry.mjs';
import {createCloudflareEntry} from '../../../drafts/n44-push/cloudflare-entry.mjs';
import {signedScheduleRequest,runScheduled} from '../../../drafts/n44-push/scheduler-entry.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',SA='11111111-1111-4111-8111-111111111111',SB='22222222-2222-4222-8222-222222222222';
export async function journey({pool,admin,report}) {
 report.cases=[];const check=async(name,fn)=>{const r={name,status:'RUNNING'};report.cases.push(r);try{await fn();r.status='PASS';}catch(e){r.status='FAIL';throw e;}};
 const now=Date.now,stamp=now(),date=new Date(stamp).toISOString().slice(0,10),tomorrow=new Date(stamp+86400000).toISOString().slice(0,10),origin='https://synthetic.invalid',authUrl='https://auth.synthetic.invalid';
 await admin.query(`insert into rakeezx.years(owner_id,id,status,hijri_start,hijri_end) values($1,'year','active',1448,1449);
 `,[A]);
 await admin.query(`insert into rakeezx.terms(owner_id,id,year_id,"index",status,start_date,end_date) values($1,'term','year',1,'active',$2::date-10,$2::date+30)`,[A,date]);
 await admin.query("insert into rakeezx.sections(owner_id,id,year_id,status) values($1,'class','year','active')",[A]);
 await admin.query("insert into rakeezx.subjects(owner_id,id) values($1,'subject')",[A]);
 await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,'teaching','class','subject','term')",[A]);
 await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,score_mode) values($1,'item','teaching','subitems')",[A]);
 await admin.query("insert into rakeezx.calendars(owner_id,id,year_id,source) values($1,'calendar','year','custom')",[A]);
 await admin.query("insert into rakeezx.calendar_days(owner_id,id,calendar_id,date,kind) values($1,'day','calendar',$2,'study')",[A,date]);
 for(let n=0;n<8;n++)await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,start_date,due_date) values($1,$2,'item',$3,$3)",[A,'sub'+n,date]);
 // The actual persisted session clock, not an invented scheduler payload.
 await admin.query("insert into rakeezx.sessions(owner_id,id,teaching_id,date,start_time,end_time,status) values($1,'lesson','teaching',$2,(clock_timestamp() at time zone 'UTC')::time,((clock_timestamp()+interval '10 minutes') at time zone 'UTC')::time,'scheduled')",[A,date]);
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'n44-synthetic',alg:'ES256',use:'sig'},valid=new Map();
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=async(owner,session,patch={})=>{const sec=Math.floor(now()/1000),input=enc({alg:'ES256',kid:jwk.kid,typ:'JWT'})+'.'+enc({iss:authUrl+'/auth/v1',aud:'authenticated',role:'authenticated',sub:owner,session_id:session,iat:sec-1,exp:sec+3600,...patch});
  const value=input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(input))).toString('base64url');valid.set(value,owner);return value;};
 const ta=await token(A,SA),tb=await token(B,SB);let hangAuth=false,denyProvider=false,providerReads=0;
 const provider=async(url,init)=>{providerReads++;assert.ok(url===authUrl+'/auth/v1/.well-known/jwks.json'||url===authUrl+'/auth/v1/user');
  if(hangAuth)return new Promise(()=>{});
  if(url.endsWith('jwks.json'))return Response.json({keys:[jwk]});
  const bearer=new Headers(init.headers).get('authorization')?.slice(7),owner=valid.get(bearer);
  return owner&&!denyProvider?Response.json({id:owner,is_anonymous:false}):Response.json({error:'unavailable'},{status:401});};
 const ecdh=()=>{const pair=createECDH('prime256v1');pair.generateKeys();return pair;},vapid=ecdh(),device=ecdh();
 let network=0,outcome=201,observeCommit=false;
 const privateCrypto=createPrivatePushPorts({enabled:true,providerOrigins:['https://fcm.googleapis.com'],activeKeyId:'s',fingerprintKeyId:'h',activeVapidKeyId:'v',
  sealingKeys:new Map([['s',randomBytes(32)]]),endpointHmacKeys:new Map([['h',randomBytes(32)]]),bindingHmacKeys:new Map([['h',randomBytes(32)]]),
  vapidKeys:new Map([['v',{publicKey:vapid.getPublicKey().toString('base64url'),privateKey:vapid.getPrivateKey().toString('base64url'),subject:'mailto:synthetic@example.invalid'}]])},
  {resolve:async()=>[{address:'93.184.216.34',family:4}],httpsRequest(options,callback){
   const req=new EventEmitter();req.destroy=()=>{};req.end=bytes=>{assert.ok(Buffer.isBuffer(bytes)&&bytes.length>20);network++;
    void (async()=>{const rows=await admin.query("select state from n44_push_draft.deliveries where state='sending'");observeCommit=rows.rows.length>0;assert.ok(observeCommit);
      if(outcome==='timeout'){req.emit('error',Error('synthetic timeout after send'));return;}
      callback({statusCode:outcome,destroy(){}});})().catch(e=>req.emit('error',e));};return req;
  }});
 const ingressKey=randomBytes(32),schedulerKey=randomBytes(32),rateKey=randomBytes(32);
 const options={acquire:()=>pool.connect(),authUrl,origin,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider,providerOrigins:['https://fcm.googleapis.com'],crypto:privateCrypto,ingressKey,schedulerKey,rateKey,deliveryEnabled:true};
 const edge=createWebEntry(options);let lastWire;
 const gateway=createCloudflareEntry({fetch:async(url,init)=>{lastWire=new Request(url,init);return edge(lastWire.clone());}});
 const env={N44_ENABLED:'true',N44_PUBLIC_ORIGIN:origin,N44_EDGE_URL:authUrl+'/functions/v1/n44-notifications',N44_INGRESS_KEY:ingressKey.toString('hex')};
 let ip=1;
 const call=async(path,body={},bearer=ta,patch={})=>{const request=new Request(origin+'/api/n44'+path,{method:'POST',headers:{origin,authorization:'Bearer '+bearer,'content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.'+(ip++%200+1),...patch},body:JSON.stringify(body)});
  Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});const response=await gateway(request,env);return {code:response.status,body:await response.json()};};
 const schedule=async(operation='due',cursor=null,limit=25)=>{const response=await edge(await signedScheduleRequest(env.N44_EDGE_URL+'/schedule',schedulerKey,{operation,cursor,limit}));const body=await response.json();assert.equal(response.status,200);return body;};
 const scope={workspaceId:'account-db',deviceId:'device'},prefs={lesson:true,due:true,lessonMinutes:15,dueDays:[3,2,1,0],timezone:'UTC',quiet:null};
 let context,rid=randomUUID(),sourceStamp;
 await check('portable vetted P256 validator rejects off-curve, compressed and noncanonical keys',async()=>{
  validatePoint(device.getPublicKey().toString('base64url'));
  for(const key of [Buffer.alloc(65).toString('base64url'),Buffer.from([4,...Array(64).fill(0)]).toString('base64url'),device.getPublicKey('base64','compressed'),device.getPublicKey().toString('base64url')+'='])assert.throws(()=>validatePoint(key));
 });
 const register=()=>call('/push/register',{...scope,registrationId:rid,sessionRevision:context.sessionRevision,consent:{revision:context.consentRevision,push:true},subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/N44_SYNTHETIC_'+rid,keys:{p256dh:device.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}});
 const update=async(sourceId,expectedStamp=null,kind='due')=>{const r=await call('/events/update',{...scope,kind,sourceId,expectedStamp});assert.equal(r.code,200);return r.body;};
 try {
 await check('signed Auth + fresh user + exact session -> teacher context/CAS/registration',async()=>{
  const r=await call('/context/update',{...scope,expectedRevision:null,pushConsent:true,preferences:prefs});assert.equal(r.code,200);context=r.body.context;assert.equal(context.sessionId,SA);assert.equal(context.sessionRevision,SA);
  assert.equal((await call('/context/read',scope)).body.context.consentRevision,context.consentRevision);
  assert.equal((await register()).body.status,'registered');
  const stale=await call('/context/update',{...scope,expectedRevision:null,pushConsent:true,preferences:prefs});assert.equal(stale.body.status,'stale');
 });
 await check('forged signature/issuer/audience/role/expiry/owner metadata and fresh provider denial',async()=>{
  const segments=ta.split('.');segments[1]=enc({sub:B,session_id:SB,exp:Math.floor(now()/1000)+3600});assert.notEqual((await call('/context/read',scope,segments.join('.'))).code,200);
  for(const patch of [{iss:'https://wrong.invalid/auth/v1'},{aud:'anon'},{role:'service_role'},{exp:Math.floor(now()/1000)-1},{user_metadata:{ownerId:B},sub:B,session_id:SA}])assert.notEqual((await call('/context/read',scope,await token(A,SA,patch))).code,200);
  assert.equal((await call('/context/read',scope,tb)).body.status,'absent');
  denyProvider=true;assert.notEqual((await call('/context/read',scope)).code,200);denyProvider=false;
 });
 await check('canonical current source registration, no caller payload authority; bounded due + concurrent dedupe',async()=>{
  sourceStamp=(await update('sub0')).sourceStamp;assert.match(sourceStamp,/^[a-f0-9]{64}$/);
  const foreign=await call('/events/update',{...scope,kind:'due',sourceId:'sub0',expectedStamp:null},tb);assert.notEqual(foreign.code,200);
  const self=await call('/events/update',{...scope,kind:'due',sourceId:'sub0',expectedStamp:sourceStamp,ownerId:B});assert.notEqual(self.code,200);
  const [a,b]=await Promise.all([schedule(),schedule()]);assert.equal(network,1);assert.ok(observeCommit);assert.ok([...a.outcomes,...b.outcomes].includes('sent'));
  assert.equal((await schedule()).count,0);
 });
 await check('actual lesson/date/calendar projection and context-specific timing',async()=>{
  assert.match((await update('lesson',null,'lesson')).sourceStamp,/^[a-f0-9]{64}$/);await schedule();assert.equal(network,2);
 });
 await check('source revision/delete/restore and parent deletion reject stale projection',async()=>{
  await update('sub1');await admin.query("update rakeezx.score_subitems set due_date=due_date+1 where id='sub1'");await schedule();assert.equal(network,2);
  await admin.query("delete from rakeezx.score_subitems where owner_id=$1 and id='sub1'",[A]);await schedule();assert.equal(network,2);
  await update('sub2');await admin.query("update rakeezx.items set deleted_at=clock_timestamp() where id='item'");await schedule();assert.equal(network,2);
  await admin.query("update rakeezx.items set deleted_at=null where id='item'");await schedule();assert.equal(network,2);
 });
 await check('actual private scheduler auth, ingress signature, replay, source limits and bounded pagination',async()=>{
  assert.equal((await edge(lastWire.clone())).status,429);
  const unsigned=await signedScheduleRequest(env.N44_EDGE_URL+'/schedule',ingressKey,{operation:'due',cursor:null,limit:25});assert.equal((await edge(unsigned)).status,401);
  const forged=lastWire.clone();forged.headers.set('x-n44-signature','0'.repeat(64));assert.equal((await edge(forged)).status,401);
  // Refresh distinct sources after parent revision; stale receipts never rearm.
  for(const n of [3,4,5])await update('sub'+n);
  let page=await schedule('due',null,1),pages=1;while(page.cursor&&pages<8){page=await schedule('due',page.cursor,1);pages++;}assert.ok(pages>=3&&pages<8);assert.equal(network,5);
 });
 await check('timeout after committed send becomes durable uncertain, never automatic retry',async()=>{
  await update('sub6');outcome='timeout';const result=await schedule();assert.ok(result.outcomes.includes('uncertain'));assert.equal(network,6);outcome=201;await schedule();assert.equal(network,6);
  const receipt=(await admin.query("select state,attempts from n44_push_draft.deliveries where event_id like 'due:sub6:%'")).rows[0];assert.equal(receipt.state,'uncertain');assert.equal(receipt.attempts,1);
 });
 await check('consent/session change revokes original binding; cleanup and retired auth reject',async()=>{
  const r=await call('/context/update',{...scope,expectedRevision:context.consentRevision,pushConsent:false,preferences:prefs});assert.equal(r.code,200);context=r.body.context;
  assert.equal((await register()).body.status,'rejected');await schedule('cleanup');
  assert.equal((await admin.query("select state from n44_push_draft.registrations where registration_id=$1",[rid])).rows[0].state,'revoked');
  // A different device has an unused send budget: the revoked-session guard,
  // rather than the old device's hourly cap, must prevent this attempt.
  const firstDevice=scope.deviceId;scope.deviceId='second-device';rid=randomUUID();
  const second=await call('/context/update',{...scope,expectedRevision:null,pushConsent:true,preferences:prefs});assert.equal(second.code,200);context=second.body.context;
  assert.equal((await register()).body.status,'registered');await update('sub7');
  await admin.query('delete from auth.sessions where id=$1',[SA]);assert.notEqual((await call('/context/read',scope)).code,200);
  const denied=await schedule();assert.ok(denied.outcomes.includes('suppressed'));assert.equal(network,6);
  const blocked=(await admin.query("select state,attempts from n44_push_draft.deliveries where device_id='second-device'")).rows[0];assert.equal(blocked.state,'suppressed');assert.equal(blocked.attempts,0);
  scope.deviceId=firstDevice;
 });
 await check('bounded Auth timeout and disabled scheduled driver; no implicit external work',async()=>{
  // A new fabricated session; the retired original is never resurrected.
  const freshSession=randomUUID();await admin.query('insert into auth.sessions values($1,$2,null)',[freshSession,A]);const freshToken=await token(A,freshSession);hangAuth=true;const start=Date.now();assert.notEqual((await call('/context/read',scope,freshToken)).code,200);assert.ok(Date.now()-start<4000);hangAuth=false;
  assert.deepEqual(await runScheduled({N44_ENABLED:'false'},{fetch:()=>assert.fail('disabled network')}),{status:'disabled'});
 });
 await check('private least-privilege role denies Auth/canonical writes and anonymous private reads',async()=>{
  const c=await pool.connect();try{for(const sql of ['select * from auth.users',"update rakeezx.items set score_mode='direct'",'select * from rakeezx.score_subitems'])await assert.rejects(c.query(sql),e=>e.code==='42501');}finally{c.release();}
  const c2=await admin.query("select has_table_privilege('authenticated','n44_push_draft.events','SELECT') as allowed,has_function_privilege('authenticated','n44_push_draft.read_source(uuid,text,text)','EXECUTE') as fn");assert.equal(c2.rows[0].allowed,false);assert.equal(c2.rows[0].fn,false);
 });
 await check('distributed peer limit and cardinality cap preserve private cleanup capacity',async()=>{
  for(let n=0;n<60;n++)assert.notEqual((await call('/context/read',scope,'invalid-token-with-no-signature',{'cf-connecting-ip':'192.0.2.250'})).code,429);
  assert.equal((await call('/context/read',scope,'invalid-token-with-no-signature',{'cf-connecting-ip':'192.0.2.250'})).code,429);
  // Saturation is fabricated directly in this owned fixture, never hosted.
  await admin.query("insert into n44_push_draft.ingress_nonces(nonce,scope,expires_at_ms) select gen_random_uuid(),'teacher',0 from generate_series(1,4096-(select count(*)::integer from n44_push_draft.ingress_nonces where scope='teacher'))");
  assert.equal((await call('/context/read',scope)).code,429);
  const before=(await admin.query("select count(*)::integer as n from n44_push_draft.ingress_nonces where scope='teacher'")).rows[0].n;
  await schedule('cleanup');const after=(await admin.query("select count(*)::integer as n from n44_push_draft.ingress_nonces where scope='teacher'")).rows[0].n;
  assert.ok(before-after>0&&before-after<=100);
 });
 report.checks.push({name:'n44_concrete_existing_host_verified_auth_context_and_runtime',status:'PASS',evidence:'Actual Cloudflare/WebRequest/AuthClient ES256/JWKS/fresh-user + private SQL/context/CAS/register/events/lesson chain; fabricated provider only.'});
 report.checks.push({name:'n44_durable_bounded_scheduler_owner_revocation_and_failure_guards',status:'PASS',evidence:'Restricted owned native PG: committed audited encrypted bytes, concurrent duplicate scheduling, stale/foreign/source-parent/revoked rejection, keyset pagination, timeout uncertainty/no replay, cleanup and least privilege.'});
 report.providerReads=providerReads;report.fabricatedPushAttempts=network;
 }finally{privateCrypto.close();}
}
