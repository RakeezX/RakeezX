/** AI: fabricated signed provider/ingress -> actual Web handlers -> restricted OWNED PG. */
import '../../../drafts/n44-push/node-globals.mjs';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {randomBytes,randomUUID,createECDH} from 'node:crypto';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {validatePoint} from '../../../drafts/n44-push/provider-policy.mjs';
import {createPrivatePushPorts} from '../../../drafts/n44-push/private-runtime.mjs';
import {createWebEntry} from '../../../drafts/n44-push/web-entry.mjs';
import {createCloudflareEntry} from '../../../drafts/n44-push/cloudflare-entry.mjs';
import {signedScheduleRequest,runScheduled} from '../../../drafts/n44-push/scheduler-entry.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',SA='11111111-1111-4111-8111-111111111111',SB='22222222-2222-4222-8222-222222222222';
export async function service({pool,admin,report}) {
 report.cases=[];const check=async(name,fn)=>{const r={name,status:'RUNNING'};report.cases.push(r);try{await fn();r.status='PASS';}catch(e){r.status='FAIL';throw e;}};
 let instant=Date.now();const now=()=>instant,stamp=now(),date=new Date(stamp+10800000).toISOString().slice(0,10),tomorrow=new Date(stamp+86400000).toISOString().slice(0,10),origin='https://synthetic.invalid',authUrl='https://auth.synthetic.invalid';
 await admin.query(`insert into rakeezx.years(owner_id,id,status,hijri_start,hijri_end) values($1,'n44-year','active',1448,1449);
 `,[A]);
 await admin.query(`insert into rakeezx.terms(owner_id,id,year_id,"index",status,start_date,end_date) values($1,'n44-term','n44-year',1,'active',$2::date-10,$2::date+30)`,[A,date]);
 await admin.query("insert into rakeezx.sections(owner_id,id,year_id,status) values($1,'n44-section','n44-year','active')",[A]);
 await admin.query("insert into rakeezx.subjects(owner_id,id) values($1,'n44-subject')",[A]);
 await admin.query("insert into rakeezx.teachings(owner_id,id,section_id,subject_id,term_id) values($1,'n44-teaching','n44-section','n44-subject','n44-term')",[A]);
 await admin.query("insert into rakeezx.items(owner_id,id,teaching_id,score_mode) values($1,'n44-item','n44-teaching','subitems')",[A]);
 await admin.query("insert into rakeezx.calendars(owner_id,id,year_id,source) values($1,'calendar','n44-year','custom')",[A]);
 await admin.query("insert into rakeezx.calendar_days(owner_id,id,calendar_id,date,kind) values($1,'day','calendar',$2,'study')",[A,date]);
 for(let n=0;n<8;n++)await admin.query("insert into rakeezx.score_subitems(owner_id,id,item_id,start_date,due_date) values($1,$2,'n44-item',$3,$3)",[A,n===0?'n44-due':'n44-sub'+n,date]);
 // The actual persisted session clock, not an invented scheduler payload.
 await admin.query("insert into rakeezx.sessions(owner_id,id,teaching_id,date,start_time,end_time,status) values($1,'n44-session','n44-teaching',$2,(clock_timestamp() at time zone 'UTC')::time,((clock_timestamp()+interval '10 minutes') at time zone 'UTC')::time,'scheduled')",[A,date]);
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
 const ece=createRequire(new URL('../../../drafts/n44-push/package.json',import.meta.url))('http_ece');
 const sent=[];let network=0,outcome=201,observeCommit=false;
 const privateCrypto=createPrivatePushPorts({enabled:true,providerOrigins:['https://fcm.googleapis.com'],activeKeyId:'s',fingerprintKeyId:'h',activeVapidKeyId:'v',
  sealingKeys:new Map([['s',randomBytes(32)]]),endpointHmacKeys:new Map([['h',randomBytes(32)]]),bindingHmacKeys:new Map([['h',randomBytes(32)]]),
  vapidKeys:new Map([['v',{publicKey:vapid.getPublicKey().toString('base64url'),privateKey:vapid.getPrivateKey().toString('base64url'),subject:'mailto:synthetic@example.invalid'}]])},
  {clock:now,resolve:async()=>[{address:'93.184.216.34',family:4}],httpsRequest(options,callback){
   const req=new EventEmitter();req.destroy=()=>{};req.end=bytes=>{assert.ok(Buffer.isBuffer(bytes)&&bytes.length>20);network++;
    const plaintext=ece.decrypt(bytes,{version:'aes128gcm',privateKey:device,authSecret:Buffer.alloc(16,7).toString('base64url')});
    try{sent.push(JSON.parse(plaintext.toString('utf8')));}finally{plaintext.fill(0);}
    void (async()=>{const rows=await admin.query("select state from n44_push_draft.deliveries where state='sending'");observeCommit=rows.rows.length>0;assert.ok(observeCommit);
      if(outcome==='timeout'){req.emit('error',Error('synthetic timeout after send'));return;}
      callback({statusCode:outcome,destroy(){}});})().catch(e=>req.emit('error',e));};return req;
  }});
 const ingressKey=randomBytes(32),schedulerKey=randomBytes(32),rateKey=randomBytes(32);
 const serviceSourceSha='ab'.repeat(20),sessionPolicy={v:2,approvalId:'cd'.repeat(32),approvalState:'active',serviceRevision:'n44-browser-service-v2',serviceSourceSha,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,observedAt:stamp,activatedAt:stamp,metadataSha256:'ab'.repeat(32)};
 report.syntheticSessionPolicy={...sessionPolicy,scope:'fabricated explicit unrestricted profile only; hosted policy NOT_RUN'};
 const options={sessionPolicy,serviceSourceSha,now,acquire:()=>pool.connect(),authUrl,origin,apiKey:'FABRICATED_PUBLIC_KEY',fetch:provider,providerOrigins:['https://fcm.googleapis.com'],crypto:privateCrypto,ingressKey,schedulerKey,rateKey,deliveryEnabled:true};
 const edge=createWebEntry(options);let lastWire;
 const gateway=createCloudflareEntry({now,fetch:async(url,init)=>{lastWire=new Request(url,init);return edge(lastWire.clone());}});
 const env={N44_ENABLED:'true',N44_PUBLIC_ORIGIN:origin,N44_EDGE_URL:authUrl+'/functions/v1/n44-notifications',N44_INGRESS_KEY:ingressKey.toString('hex')};

 const schedule=async(limit=25)=>{
  const r=await edge(await signedScheduleRequest(env.N44_EDGE_URL+'/schedule',schedulerKey,{operation:'due',cursor:null,limit},now));
  assert.equal(r.status,200);return r.json();
 };
 const call=async(path,body,bearer=ta)=>{
  const request=new Request(origin+'/api/n44'+path,{method:'POST',headers:{origin,authorization:'Bearer '+bearer,'content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.124'},body:JSON.stringify(body)});
  Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});const response=await gateway(request,env);return {code:response.status,body:await response.json()};
 };
 return {A,B,SA,SB,ta,tb,date,vapid,device,privateCrypto,edge,gateway,env,token,provider,options,sent,schedule,call,advance:ms=>{instant+=ms;},now};
}
