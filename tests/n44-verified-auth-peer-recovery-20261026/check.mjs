// AI-authored: real independent cloud clients; only shared synthetic storage and fake transport.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const values = new Map();
globalThis.localStorage = { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,String(v)),
 removeItem:k=>values.delete(k), key:i=>[...values.keys()][i]??null, get length(){return values.size;} };
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch; values.clear(); delete globalThis.window;});
const jwt=(n,sid='same-session')=>`e30.${Buffer.from(JSON.stringify({session_id:sid,nonce:n})).toString('base64url')}.synthetic`;
const value=(n,sid='same-session',id=OWNER)=>({access_token:jwt(n,sid),refresh_token:`fake-refresh-${n}`,expires_at:4102444800,user:{id,user_metadata:{untrusted:true}}});
const json=(v,status=200)=>Response.json(v,{status});
const gate=()=>{let resolve; const promise=new Promise(r=>resolve=r); return {promise,resolve};};
const flush=()=>new Promise(r=>setImmediate(r));
let serial=0;
async function pair(){
 const listeners=[]; globalThis.window={addEventListener:(name,fn)=>{if(name==='storage')listeners.push(fn);}};
 const a=await import(`../../src/lib/cloud.js?n44-peer-a-${++serial}`);
 delete globalThis.window;
 const b=await import(`../../src/lib/cloud.js?n44-peer-b-${serial}`);
 localStorage.setItem(a.AUTH_STORAGE_KEY,JSON.stringify(value(0))); await a.init(); await b.init();
 globalThis.fetch=async()=>json({id:OWNER}); await a.verifyCurrentAuthIdentity(OWNER);
 return {a,b,stored:()=>JSON.parse(localStorage.getItem(a.AUTH_STORAGE_KEY)),event:(extra={})=>listeners.forEach(fn=>fn({key:a.AUTH_STORAGE_KEY,...extra}))};
}
async function rotate(b,n=1,sid='same-session'){
 globalThis.fetch=async()=>json(value(n,sid)); await b.refreshSession();
}
function transport(a,candidate,{status=200,body={id:OWNER,serverVerified:true}}={}){
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url===`${a.SUPABASE_URL}/auth/v1/user`){
   assert.equal(options.method,'GET'); assert.equal(options.headers.Authorization,`Bearer ${candidate.access_token}`);
   assert.ok(options.signal); return json(body,status);
  }
  assert.ok(url.startsWith(`${a.SUPABASE_URL}/rest/v1/`));
  assert.equal(options.headers.Authorization,`Bearer ${candidate.access_token}`);
  assert.ok(calls.some(c=>c.url.endsWith('/auth/v1/user')),'no product request before candidate verification');
  return json({ok:true});
 }; return calls;
}

test('normal next and successive requests recover peer rotation without reload or stale POST',async()=>{
 const {a,b,stored}=await pair(); await rotate(b); const calls=transport(a,value(1));
 // Repeated actual operations expose the old module permanent-stop gap.
 const outcomes=[];
 for(let i=0;i<3;i++){try{outcomes.push(await a.request('/synthetic'));}catch(e){outcomes.push(e.code);}}
 assert.deepEqual(outcomes,[{ok:true},{ok:true},{ok:true}]);
 assert.equal(calls.filter(c=>c.url.endsWith('/auth/v1/user')).length,1);
 assert.equal(calls.filter(c=>c.options.method==='POST').length,0);
 assert.equal(a.user.serverVerified,true); assert.equal(a.user.user_metadata,undefined);
 assert.equal(stored().access_token,value(1).access_token);
});

for(const entry of ['request','refresh','identity']) test(`${entry} can reconcile before stale-memory preflight`,async()=>{
 const {a,b}=await pair(); await rotate(b); const calls=transport(a,value(1));
 if(entry==='request') await a.request('/synthetic');
 if(entry==='refresh') await a.refreshSession();
 if(entry==='identity') assert.equal((await a.verifyCurrentAuthIdentity(OWNER)).id,OWNER);
 assert.equal(a.session.access_token,value(1).access_token);
 assert.equal(calls.filter(c=>c.options.method==='POST').length,0);
});

test('storage event recovers automatically; concurrent events/normal requests share one verification',async()=>{
 const {a,b,event}=await pair(); await rotate(b);
 const entered=gate(),reply=gate(); let reads=0,data=0;
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/auth/v1/user')){reads++; assert.equal(options.headers.Authorization,`Bearer ${value(1).access_token}`);entered.resolve();return reply.promise;}
  data++;assert.equal(options.headers.Authorization,`Bearer ${value(1).access_token}`);return json({ok:true});
 };
 event();event();await entered.promise;
 const first=a.request('/one'),second=a.request('/two'); event();
 assert.equal(data,0);assert.equal(reads,1);
 reply.resolve(json({id:OWNER,serverVerified:true}));await Promise.all([first,second]);
 assert.equal(reads,1);assert.equal(data,2);assert.equal(a.user.serverVerified,true);
 event();await flush();assert.equal(reads,1);
});

test('spoofed payload/metadata-only/unrelated events cause no I/O or authority',async()=>{
 const {a,event}=await pair();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('no I/O');};
 event({newValue:JSON.stringify(value(9,'foreign-session',OTHER))});
 localStorage.setItem(a.AUTH_STORAGE_KEY,JSON.stringify({...value(0),user:{id:OWNER,user_metadata:{role:'admin'}}}));
 event();event({key:'unrelated'});event({key:null,newValue:JSON.stringify(value(9))});
 await flush();assert.equal(calls,0);assert.equal(a.session.access_token,value(0).access_token);
 assert.equal(a.user.user_metadata?.role,undefined);
});

for(const change of ['logout','owner','memory','new-login','candidate']){
 for(const phase of ['headers','body']) test(`${change} during candidate ${phase} cannot commit or resurrect`,async()=>{
  const {a,b,stored}=await pair();await rotate(b);const entered=gate(),reply=gate();
  globalThis.fetch=async()=>{
   if(phase==='headers'){entered.resolve();return reply.promise;}
   return {ok:true,json:async()=>{entered.resolve();return reply.promise;}};
  };
  const rejected=assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});await entered.promise;
  if(change==='logout') {globalThis.fetch=async()=>json({});await a.signOut();}
  if(change==='owner') localStorage.setItem(a.AUTH_STORAGE_KEY,JSON.stringify(value(2,'other-session',OTHER)));
  if(change==='memory') a.setMockAuth(value(2).user,value(2));
  if(change==='new-login'){globalThis.fetch=async()=>json(value(1));await a.signIn('fake@example.invalid','fake');}
  if(change==='candidate') await rotate(b,2);
  const winner=stored();
  reply.resolve(phase==='headers'?json({id:OWNER}):{id:OWNER});await rejected;
  assert.deepEqual(stored(),winner);
  if(change==='logout') assert.equal(a.session,null);
  else if(change==='new-login') assert.deepEqual(a.session,winner);
  else assert.notEqual(a.session?.access_token,value(1).access_token);
 });
}

for(const status of [401,403]){
 test(`terminal candidate ${status} clears only the unchanged current winner`,async()=>{
  const {a,b,stored}=await pair();await rotate(b);const calls=transport(a,value(1),{status,body:{message:'denied'}});
  await assert.rejects(a.request('/synthetic'),{status});assert.equal(a.session,null);assert.equal(stored(),null);
  assert.equal(calls.length,1);assert.equal(a.authStatus().state,'auth_required');
 });
 test(`late candidate ${status} body cannot clear a newer winner`,async()=>{
  const {a,b,stored}=await pair();await rotate(b);const entered=gate(),body=gate();
  const response=json({},status);response.clone=()=>({json:async()=>{entered.resolve();return body.promise;}});
  globalThis.fetch=async()=>response;
  const rejected=assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});await entered.promise;
  await rotate(b,2);body.resolve({message:'denied'});await rejected;assert.deepEqual(stored(),value(2));
 });
}

for(const status of [429,500,503,'network']) test(`candidate ${status} preserves winner, no old refresh fallback, later retry recovers`,async()=>{
 const {a,b,stored}=await pair();await rotate(b);let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.ok(url.endsWith('/auth/v1/user'));
  if(status==='network')throw TypeError('synthetic offline');return json({message:'temporary'},status);};
 await assert.rejects(a.request('/synthetic'),status==='network'?{code:'AUTH_NETWORK'}:{status});
 assert.equal(calls,1);assert.deepEqual(stored(),value(1));assert.equal(a.session.access_token,value(0).access_token);
 transport(a,value(1));await a.request('/synthetic');assert.equal(a.session.access_token,value(1).access_token);
});

for(const body of [{id:OTHER},null,{user:{id:OWNER}},{id:OWNER.toUpperCase()+'wrong'}]) test(`wrong/malformed verified owner ${JSON.stringify(body)} cannot authorize`,async()=>{
 const {a,b,stored}=await pair();await rotate(b);const calls=transport(a,value(1),{body});
 await assert.rejects(a.request('/synthetic'),{code:'AUTH_OWNER_MISMATCH'});
 assert.equal(calls.length,1);assert.deepEqual(stored(),value(1));assert.equal(a.user.id,OWNER);
 assert.equal(a.session.access_token,value(0).access_token);
});

test('invalid JSON never authorizes and can be retried',async()=>{
 const {a,b,stored}=await pair();await rotate(b);let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('broken JSON');};
 await assert.rejects(a.request('/synthetic'),SyntaxError);assert.equal(calls,1);assert.deepEqual(stored(),value(1));
 transport(a,value(1));await a.request('/synthetic');
});

test('bounded candidate singleflight aborts once; ignored late JSON cannot commit',async()=>{
 const {a,b,stored}=await pair();await rotate(b);const entered=gate(),body=gate();
 const nativeTimeout=globalThis.setTimeout;let expire,signal,calls=0;
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===12000)expire=fn;return nativeTimeout(fn,ms,...args);};
 try{
  globalThis.fetch=async(_url,options)=>{calls++;signal=options.signal;return {ok:true,json:async()=>{entered.resolve();return body.promise;}};};
  const first=assert.rejects(a.request('/one'),{code:'AUTH_TIMEOUT'}),second=assert.rejects(a.request('/two'),{code:'AUTH_TIMEOUT'});
  await entered.promise;expire();await Promise.all([first,second]);assert.equal(calls,1);assert.equal(signal.aborted,true);
  body.resolve({id:OWNER});await flush();assert.deepEqual(stored(),value(1));assert.equal(a.session.access_token,value(0).access_token);
  transport(a,value(1));await a.request('/synthetic');
 }finally{globalThis.setTimeout=nativeTimeout;}
});

for(const status of [200,401,403]) test(`old pending data ${status} is discarded even after successful event recovery`,async()=>{
 const {a,b,event}=await pair(),entered=gate(),reply=gate();
 globalThis.fetch=async()=>{entered.resolve();return reply.promise;};
 const old=assert.rejects(a.request('/old'),{code:'AUTH_CONTEXT_CHANGED'});await entered.promise;
 await rotate(b);transport(a,value(1));event();await flush();assert.equal(a.session.access_token,value(1).access_token);
 reply.resolve(json(status===200?{ok:true}:{message:'old denied'},status));await old;
 assert.equal(a.session.access_token,value(1).access_token);
});

for(const change of ['logout','owner']) test(`pre-existing peer ${change} forbids recovery and preserves winning storage`,async()=>{
 const {a,b,event,stored}=await pair();
 if(change==='logout'){globalThis.fetch=async()=>json({});await b.signOut();}
 else {globalThis.fetch=async()=>json(value(1,'different',OTHER));await b.signIn('fake@example.invalid','fake');}
 const winner=stored();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('no network');};
 await assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});event();await flush();
 assert.equal(a.session,null);assert.deepEqual(stored(),winner);assert.equal(calls,0);
});

test('actual account store/ownership entry: same-session recovery preserves lease and pending envelope; different session retires both',async()=>{
 await import('fake-indexeddb/auto');
 const a=await import('../../src/lib/cloud.js');
 const db=await import('../../src/lib/db.js');
 const store=await import('../../src/store.js');
 const {runtimeOfflineLease}=await import('../../src/lib/offline-lease.js');
 const {runtimeSyncOwnershipGuard}=await import('../../src/lib/sync-ownership.js');
 const {activateSyntheticAccountWorkspace}=await import('../helpers/synthetic-workspace.mjs');
 globalThis.document={documentElement:{setAttribute(){},removeAttribute(){},classList:{add(){},remove(){}}},querySelector:()=>null};
 globalThis.matchMedia=()=>({matches:false});
 localStorage.setItem(a.AUTH_STORAGE_KEY,JSON.stringify(value(0)));await a.init();
 globalThis.fetch=async()=>json({id:OWNER});await a.verifyCurrentAuthIdentity(OWNER);
 try{
  await activateSyntheticAccountWorkspace({ownerId:OWNER});await db.clearAll();await store.init();
  store.getOfflineLeaseStatus();await runtimeOfflineLease().renew(id=>a.verifyCurrentAuthIdentity(id));
  await db.clearStore('outbox');
  await store.save({subjects:[{id:'peer-recovery-subject',name:'Synthetic unsent form',deleted:false}]});
  const queued=(await db.getAll('outbox')).find(r=>r.recordId==='peer-recovery-subject');
  assert.ok(queued);const assertOld=a.captureOwnedMutationContext(queued);assertOld();
  const b=await import(`../../src/lib/cloud.js?n44-peer-store-${++serial}`);await b.init();await rotate(b);
  const calls=transport(a,value(1));
  await a.applySyncV2Mutation(queued);assertOld();
  assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/auth/v1/user'));
  assert.ok(calls[1].url.endsWith('/rest/v1/rpc/apply_sync_v2_mutation'));
  assert.equal(JSON.parse(calls[1].options.body).p_mutation_id,queued.mutationId);
  assert.deepEqual(await db.get('outbox',queued.id),queued);
  assert.equal((await db.get('subjects',queued.recordId)).name,'Synthetic unsent form');
  assert.equal(runtimeOfflineLease().observe().editable,true);
  assert.equal(runtimeSyncOwnershipGuard.cloudAccess({operation:'dispatch',authenticatedUserId:OWNER,command:{...queued,ownerId:OTHER}}).allowed,false);
  // A same-owner different Auth session may be verified but must retire the old
  // mutation context and offline receipt, then use the ordinary renewal entry.
  await rotate(b,2,'different-session');
  const newer=transport(a,value(2,'different-session'));
  await assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});
  assert.equal(newer.length,1);assert.equal(a.user.serverVerified,true);
  assert.throws(assertOld,{code:'OWNED_MUTATION_CONTEXT_CHANGED'});
  assert.equal(runtimeOfflineLease().observe().editable,false);
  await assert.rejects(a.applySyncV2Mutation(queued),{code:'OFFLINE_LEASE_LIMITED'});
  assert.equal(newer.length,1);
  await runtimeOfflineLease().renew(id=>a.verifyCurrentAuthIdentity(id));
  assert.equal(runtimeOfflineLease().observe().editable,true);
  assert.throws(assertOld,{code:'OWNED_MUTATION_CONTEXT_CHANGED'});
  assert.deepEqual(await db.get('outbox',queued.id),queued);
 }finally{store.deactivateWorkspace('synthetic-complete');store.closeChannel();db.closeDB();delete globalThis.document;delete globalThis.matchMedia;}
});

test('cached unverified old JWT never preserves old-session capability continuity',async()=>{
 const {a,b}=await pair();
 // init is deliberately only a cache read, not an Auth verification.
 await a.init(); await rotate(b); const calls=transport(a,value(1));
 await assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});
 assert.equal(calls.length,1);assert.equal(a.user.serverVerified,true);
});

for(const status of [200,403]) test(`old refresh ${status} stays inert after successful verified peer handoff`,async()=>{
 const {a,b,event,stored}=await pair(),entered=gate(),reply=gate();
 globalThis.fetch=async()=>{entered.resolve();return reply.promise;};
 const old=assert.rejects(a.refreshSession(),{code:'AUTH_CONTEXT_CHANGED'});await entered.promise;
 await rotate(b);transport(a,value(1));event();await flush();
 assert.equal(a.session.access_token,value(1).access_token);
 reply.resolve(json(status===200?value('stale-response'):{message:'old refresh denied'},status));await old;
 assert.equal(a.session.access_token,value(1).access_token);assert.equal(stored().access_token,value(1).access_token);
});

test('failed automatic verification does not retry unchanged credential/metadata/spoofed events',async()=>{
 const {a,b,event,stored}=await pair();await rotate(b);let calls=0;
 globalThis.fetch=async()=>{calls++;return json({message:'temporary'},503);};
 event();await flush();assert.equal(calls,1);
 localStorage.setItem(a.AUTH_STORAGE_KEY,JSON.stringify({...stored(),user:{id:OWNER,user_metadata:{role:'admin'}}}));
 event();event({newValue:JSON.stringify(value(9))});event({key:null});await flush();assert.equal(calls,1);
 // A later normal operation is an explicit useful retry; no timer or event loop.
 const recovered=transport(a,value(1));await a.request('/synthetic');assert.equal(recovered.length,2);
});

for(const change of ['peer-logout','peer-owner']) test(`${change} event during verification retires memory without touching the winner`,async()=>{
 const {a,b,event,stored}=await pair();await rotate(b);const entered=gate(),reply=gate();
 globalThis.fetch=async()=>{entered.resolve();return reply.promise;};
 const pending=assert.rejects(a.request('/synthetic'),{code:'AUTH_CONTEXT_CHANGED'});await entered.promise;
 globalThis.fetch=async()=>json(value(2,'other',OTHER));
 if(change==='peer-logout')await b.signOut();else await b.signIn('fake@example.invalid','fake');
 const winner=stored();event();await flush();assert.equal(a.session,null);
 reply.resolve(json({id:OWNER}));await pending;assert.deepEqual(stored(),winner);assert.equal(a.session,null);
});
