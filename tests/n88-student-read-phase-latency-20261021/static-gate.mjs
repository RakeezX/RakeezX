/** AI: separate one-upload private carrier prerequisite, only after native gate. */
import assert from 'node:assert/strict';
import {LATENCY as c,latencyAuthority,digest} from './native-gate.mjs';
const must=(v,k)=>assert(v,'n88_latency_static_'+k);
export async function runLatencyStaticPhase(action,p){
 const stamp=latencyAuthority(p);must(['preflight','begin','complete'].includes(action),'action');await p.verifyCandidate(stamp.candidateSha);
 const pack=await p.readReceipt('package'),native=await p.readReceipt('native-complete');
 for(const k of ['taskId','runId','candidateSha','source'])must(native[k]===stamp[k],'native_binding_'+k);
 must(native.status==='PASS'&&native.sourceExact&&native.publicPinMatches,'native_gate');
 const state=await p.load(),history=state.carrierCorrections??[];must(state.directSource===c.source,'native_state');
 const attempt='latency-static-attempt.json',complete='latency-static-complete.json';
 const absent=async name=>{try{await p.readOwned(name);must(false,'consumed');}catch(e){if(e.code!=='ENOENT')throw e;}};
 const fresh=r=>must(Number.isFinite(Date.parse(r.observedAt))&&Math.abs(Date.now()-Date.parse(r.observedAt))<15*60*1000,'fresh');
 const cf=await p.readReceipt(action==='complete'?'cloudflare-static-after':'cloudflare-static-before');fresh(cf);
 must(cf.taskId===c.task&&cf.runId===c.run&&cf.candidateSha===stamp.candidateSha&&cf.officialServer==='rakeez_cloudflare','cf_binding');
 must(cf.version?.percentage===100,'percentage');
 const provider=await p.readProvider(action==='complete'?'static-after':'static-before',c.source);
 must(provider.sourceExact&&provider.pinDigest===digest(c.source)&&provider.verifyJwt===false,'native_provider');
 assert.deepEqual(provider,(await p.readReceipt('native-pin')).provider,'n88_latency_static_native_drift');
 if(action==='preflight'){
  await absent(attempt);await absent(complete);must(cf.sourceSha256===pack.priorCarrier,'carrier_preimage');must(!history.some(h=>h.taskId===c.task),'history');
  const r={...stamp,status:'PASS',observedAt:new Date().toISOString(),carrier:pack.carrier,student:pack.student,provider,cf,historyDigest:digest(JSON.stringify(history))};await p.writeReceipt('static-preflight',r);return r;
 }
 const pre=await p.readReceipt('static-preflight');fresh(pre);for(const k of ['taskId','runId','candidateSha'])must(pre[k]===stamp[k],'pre_binding');
 must(pre.historyDigest===digest(JSON.stringify(history)),'history_drift');
 if(action==='begin'){
  await absent(attempt);await absent(complete);assert.deepEqual(cf,pre.cf);assert.deepEqual(provider,pre.provider);
  const r={...stamp,status:'RESERVED',observedAt:new Date().toISOString(),carrier:pack.carrier,maxUploads:1,historyDigest:pre.historyDigest};await p.writeOwned(attempt,r);await p.writeReceipt('static-reservation',r);return r;
 }
 const reserved=await p.readOwned(attempt);for(const k of ['taskId','runId','candidateSha'])must(reserved[k]===stamp[k],'reservation_binding');must(reserved.maxUploads===1&&reserved.carrier===pack.carrier,'reservation');await absent(complete);
 must(cf.sourceSha256===pack.carrier&&cf.version.version_id!==pre.cf.version.version_id,'uploaded_source');
 for(const k of ['settings','routes','subdomain'])assert.deepEqual(cf[k],pre.cf[k],'n88_latency_static_config_'+k);
 const served=await p.readReceipt('served');fresh(served);must(served.taskId===c.task&&served.runId===c.run&&served.candidateSha===stamp.candidateSha,'served_binding');
 must(served.sha256===pack.student&&served.status===200&&served.noStore&&served.noReferrer&&served.nosniff,'served');
 must(digest(await p.readServed())===pack.student,'served_bytes');
 const entry={...stamp,carrier:pack.carrier,student:pack.student,version:cf.version.version_id,uploads:1};
 const r={...entry,status:'PASS',observedAt:new Date().toISOString(),sourceExact:true,servedAssetExact:true,nativePinUnchanged:true,historyAppended:true};
 await p.writeOwned(complete,r);state.carrierCorrections=[...history,entry];await p.save(state);await p.writeReceipt('static-complete',r);return r;
}
