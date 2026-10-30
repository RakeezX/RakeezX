// AI: real ingress/Auth/backend, bounded synthetic database ports, no live writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createWebEntry} from '../drafts/n44-push/web-entry.mjs';
import {createCloudflareEntry} from '../drafts/n44-push/cloudflare-entry.mjs';
import {compareCurrentProjection} from '../drafts/n44-push/canonical-source.mjs';
import {createPushGateway} from '../src/lib/notification-push-gateway.js';
const now=Date.now(),owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session=randomUUID(),rid=randomUUID(),origin='https://synthetic.invalid',authUrl='https://auth.synthetic.invalid',source='a'.repeat(40);
const profile={v:2,approvalState:'active',approvalId:'a'.repeat(64),serviceRevision:'n44-browser-service-v2',serviceSourceSha:source,policyChangeRule:'disable-retire-before-auth-policy-change',timeboxSeconds:null,inactivityTimeoutSeconds:null,singleSessionPerUser:false,metadataSha256:'b'.repeat(64),observedAt:now-1000,activatedAt:now-500};
const preferences={lesson:true,due:true,lessonMinutes:15,dueDays:[0,1],timezone:'Asia/Riyadh',quiet:null};
const ctx={workspace_id:'w',device_id:'d',active:true,session_id:session,session_revision:session+':'+profile.approvalId,session_expires_at_ms:String(now+3600000),consent_revision:'consent',push_consent:true,preferences:JSON.stringify(preferences)};
const reg={registration_id:rid,workspace_id:'w',device_id:'d',session_id:session,session_revision:ctx.session_revision,consent_revision:'consent',state:'active',expires_at_ms:String(now+1800000),sealed:'SYNTHETIC',fingerprint:'c'.repeat(64),binding_fingerprint:'d'.repeat(64)};
const canonical={year:{revision:'1',id:'year',status:'active'},terms:[{revision:'1',id:'term',startDate:'2026-01-01',endDate:'2027-01-01'}],calendars:[],days:[],teaching:{revision:'1',id:'teaching',termId:'term'},section:{revision:'1',id:'section',status:'active',yearId:'year'},subject:{revision:'1',id:'subject'},source:{revision:'1',id:'s',itemId:'item',itemRevision:'1',scoreMode:'subitems',dueDate:'2026-11-01'}};
const queries=[];let rows=[],sessionValid=true,sourceValue=canonical;
const acquire=async()=>({async query(sql,values){queries.push(sql);
 if(sql.includes('lock_current_session'))return {rows:sessionValid?[{user_id:owner,session_id:session,not_after_ms:null}]:[]};
 if(sql.startsWith('insert into n44_push_draft.ingress_'))return {rows:[{nonce:values?.[0],count:1}]};
 if(sql.includes('select high_water_ms'))return {rows:[{high_water_ms:'0'}]};
 if(sql.includes('clock_timestamp()'))return {rows:[{now_ms:String(now)}]};
 if(sql.startsWith('select workspace_id,device_id,active'))return {rows:[structuredClone(ctx)]};
 if(sql.startsWith('select registration_id,workspace_id'))return {rows:[structuredClone(reg)]};
 if(sql.startsWith('select fingerprint,registration_id'))return {rows:[{fingerprint:reg.fingerprint,registration_id:rid}]};
 if(sql.includes('read_source('))return {rows:[{source:sourceValue}]};
 if(sql.includes('extract(epoch from (($1::date'))return {rows:[{ms:String(Date.parse(values[0]+'T'+values[1]+':00+03:00'))}]};
 if(sql==='select * from n44_push_draft.events where owner_id=$1 order by workspace_id,device_id,event_id limit 101')return {rows:structuredClone(rows)};
 return {rows:[]};},release(){}});
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic',alg:'ES256',use:'sig'},encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const unsigned=encode({alg:'ES256',kid:'synthetic',typ:'JWT'})+'.'+encode({iss:authUrl+'/auth/v1',aud:'authenticated',role:'authenticated',sub:owner,session_id:session,iat:Math.floor(now/1000)-1,exp:Math.floor(now/1000)+3600});
const token=unsigned+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(unsigned))).toString('base64url');
const options={now:()=>now,authUrl,origin,apiKey:'SYNTHETIC',fetch:async url=>url.endsWith('jwks.json')?Response.json({keys:[jwk]}):Response.json({id:owner,is_anonymous:false}),providerOrigins:[],crypto:{sender:{send(){throw Error('no sends');}}},rateKey:new Uint8Array(32).fill(2),sessionPolicy:profile,serviceSourceSha:source,ingressKey:new Uint8Array(32).fill(1),schedulerKey:new Uint8Array(32).fill(3),acquire,deliveryEnabled:false};
const edge=createWebEntry(options);
const ingress=createCloudflareEntry({now:()=>now,fetch:async(url,init)=>edge(new Request(url,init))});
const scope={workspaceId:'w',deviceId:'d',sourceKind:'due',sourceId:'s',registrationId:rid,consentRevision:'consent',nonce:randomUUID()};
async function call(patch={}){const req=new Request(origin+'/api/n44/events/read',{method:'POST',headers:{origin,'content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.1',authorization:'Bearer '+token},body:JSON.stringify({...scope,...patch,nonce:randomUUID()})});Object.defineProperty(req,'cf',{value:{tlsVersion:'TLSv1.3'}});return ingress(req,{N44_ENABLED:'true',N44_PUBLIC_ORIGIN:origin,N44_EDGE_URL:authUrl+'/functions/v1/n44-notifications',N44_INGRESS_KEY:'01'.repeat(32)});}
const stored=(events,stamp)=>events.map(e=>({owner_id:owner,workspace_id:'w',device_id:'d',event_id:e.id,source_kind:'due',source_id:'s',source_stamp:stamp,due_at_ms:String(e.dueAt),expires_at_ms:String(e.expiresAt),payload:{id:e.id,kind:e.kind,expiresAt:e.expiresAt,actionPath:e.actionPath}}));
test('authenticated complete current projection including future events, private source/session/owner locks',async()=>{
 let r=await call();assert.equal(r.status,200);let v=await r.json();assert.equal(v.status,'absent');assert.equal(v.events.length,2);
 rows=stored(v.events,v.sourceStamp);r=await call();v=await r.json();assert.equal(v.status,'verified');assert(v.events.some(e=>e.dueAt>now));
 for(const mutate of [a=>a.pop(),a=>a[0].payload.kind='lesson',a=>a[0].payload.actionPath='/teaching/wrong/items',a=>a[0].due_at_ms='1',a=>a[0].source_stamp='f'.repeat(64),a=>a.push({...a[0],event_id:'extra'})]){rows=stored(v.events,v.sourceStamp);mutate(rows);assert.equal((await(await call()).json()).status,'changed');}
 rows=stored(v.events,v.sourceStamp);sourceValue={...canonical,source:{revision:'1',...canonical.source,dueDate:'2026-11-02'}};assert.equal((await(await call()).json()).status,'changed');sourceValue=null;rows=[];assert.equal((await(await call()).json()).status,'absent');sourceValue=canonical;
 for(const patch of [{registrationId:randomUUID()},{deviceId:'foreign'},{consentRevision:'wrong'},{ownerId:owner},{actionPath:'/evil'},{sourceStamp:'a'.repeat(64)}])assert.notEqual((await(await call(patch)).json()).status,'verified');
 for(const change of [{state:'revoked'},{expires_at_ms:String(now-1)},{session_id:randomUUID()}]){const saved={...reg};Object.assign(reg,change);assert.notEqual((await(await call()).json()).status,'verified');Object.assign(reg,saved);}
 sessionValid=false;assert.notEqual((await(await call()).json()).status,'verified');sessionValid=true;
 assert(queries.includes('select * from n44_push_draft.events where owner_id=$1 order by workspace_id,device_id,event_id limit 101'));
 assert(!queries.some(q=>/^(insert into|delete from|update) n44_push_draft\.(events|registrations|contexts|deliveries)/.test(q)));
});
test('gateway exact nonce, binding, shape, finite bytes/time and revoked context discard',async()=>{
 const events=[{id:'due:s:2026-11-01:2026-11-01',kind:'due',dueAt:now+1000,expiresAt:now+100000,actionPath:'/teaching/teaching/items'}];let mode='ok',valid=true,calls=[];
 const g=createPushGateway({context:{ownerId:owner,workspaceId:'w',deviceId:'d'},authorization:'Bearer synthetic',storage:{getItem:()=>null},valid:()=>valid,fetch:async(url,init)=>{const b=JSON.parse(init.body);calls.push(url);if(url.endsWith('context/read'))return Response.json({protocol:'n44-browser-v2',status:'current',context:{...b,active:true,sessionExpiresAt:now+3600000,pushConsent:true,consentRevision:'consent',sessionRevision:ctx.session_revision},registration:{registrationId:rid,expiresAt:now+1800000}});
 let r={...b,status:'verified',sourceStamp:'a'.repeat(64),sourceRevisionDigest:'b'.repeat(64),events,registrationExpiresAt:now+1800000,sessionRevision:ctx.session_revision,observedAt:Date.now()};
 if(mode==='nonce')r.nonce=randomUUID();if(mode==='extra')r.endpoint='secret';if(mode==='stale')r.observedAt=now-60000;if(mode==='duplicate')r.events=[...events,...events];if(mode==='context')valid=false;if(mode==='oversized')return new Response(' '.repeat(65537),{headers:{'content-type':'application/json'}});return Response.json(r);}});
 await g.read();assert.equal((await g.readProjection('due','s')).status,'verified');
 for(mode of ['nonce','extra','stale','duplicate','oversized','context'])await assert.rejects(g.readProjection('due','s'));
 assert(!calls.some(u=>u.endsWith('events/update')));
});

test('recovery body timeout cancels the bounded stream and remains unresolved', {timeout:20000},async()=>{
 let cancelled=false;
 const g=createPushGateway({context:{ownerId:owner,workspaceId:'w',deviceId:'d'},authorization:'Bearer synthetic',storage:{getItem:()=>null},fetch:async url=>url.endsWith('context/read')?Response.json({protocol:'n44-browser-v2',status:'current',context:{workspaceId:'w',deviceId:'d',active:true,sessionExpiresAt:Date.now()+3600000,pushConsent:true,consentRevision:'consent',sessionRevision:'session'},registration:{registrationId:rid,expiresAt:now+1800000}}):new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}})});
 await g.read();await assert.rejects(g.readProjection('due','s'));assert(cancelled);
});

test('exact Native181 composition executes the qualified read through real signed ingress',async()=>{
 const names=[],values=[];let native=await readFile('drafts/n44-push/activation/current-projection-recovery-20261031/bundle/qualified/edge.mjs','utf8');
 const imports=[...native.matchAll(/^import (.+?) from "([^"]+)";$/gm)];
 for(const match of imports){const [line,spec,target]=match;const m=target.startsWith('node:')||target==='@supabase/auth-js'?await import(target):{};
  if(spec.startsWith('{'))for(const part of spec.slice(1,-1).split(',')){const [original,alias]=part.trim().split(/\s+as\s+/);names.push(alias??original);values.push(m[original]);}
  else {names.push(spec);values.push(m.default??m);}native=native.replace(line,'');
 }
 const factory=new Function(...names,'Deno','addEventListener',native+'\nreturn createWebEntry;')(...values,{serve(){}},()=>{});
 const compiledEdge=factory(options),relay=createCloudflareEntry({now:()=>now,fetch:async(url,init)=>compiledEdge(new Request(url,init))});
 const request=async()=>{const req=new Request(origin+'/api/n44/events/read',{method:'POST',headers:{origin,'content-type':'application/json','x-n44-csrf':'1','sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.1',authorization:'Bearer '+token},body:JSON.stringify({...scope,nonce:randomUUID()})});Object.defineProperty(req,'cf',{value:{tlsVersion:'TLSv1.3'}});return relay(req,{N44_ENABLED:'true',N44_PUBLIC_ORIGIN:origin,N44_EDGE_URL:authUrl+'/functions/v1/n44-notifications',N44_INGRESS_KEY:'01'.repeat(32)});};
 rows=[];let v=await(await request()).json();assert.equal(v.status,'absent');assert(v.sourceRevisionDigest);rows=stored(v.events,v.sourceStamp);v=await(await request()).json();assert.equal(v.status,'verified');assert.equal(v.events.length,2);
});
