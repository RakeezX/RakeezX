// AI: exact current migration installation and authenticated request bounds.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {withOfficialServices,freePort,hash} from './n58-empty-recovery-services.mjs';
const runId='79f2600c-16c3-4f27-9092-8c1aedd2f9cc',receipt={runId,checks:[],calls:[],hostedCalls:0};
try{await withOfficialServices({runId,appOrigin:'http://127.0.0.1:'+await freePort()},async svc=>{
 receipt.schema=await svc.inspectAtomic();receipt.migrations=svc.migrations;
 const sql=await fs.readFile('supabase/migrations/20261014203000_n58_atomic_empty_foundation_repair.sql','utf8');receipt.sqlSha256=hash(sql.replaceAll('\r\n','\n'));
 assert.equal(receipt.migrations['20261014203000_n58_atomic_empty_foundation_repair.sql'],receipt.sqlSha256);
 const r=await fetch(svc.authUrl+'/signup',{method:'POST',headers:{apikey:svc.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:'n58-limits-'+randomUUID()+'@example.invalid',password:'Local!Aa1'+randomBytes(24).toString('hex')})});
 const a=await r.json();assert.equal(r.status,200);
 const rpc=async(name,body,anonymous=false)=>{const response=await fetch(svc.restUrl+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+(anonymous?svc.anonKey:a.access_token),'Content-Type':'application/json','Accept-Profile':'rakeezx','Content-Profile':'rakeezx'},body:JSON.stringify(body)});const result=await response.json();receipt.calls.push({name,body,anonymous,status:response.status,result});return {status:response.status,body:result};};
 const request={ownerId:a.user.id,version:'N58_EMPTY_V1',presetId:'sa-western-1448-1449',rootMutationId:randomUUID(),originalDigest:'a'.repeat(64)};
 for(const invalid of [{...request,ownerId:randomUUID()},{...request,version:'OTHER'},{...request,presetId:'custom'},{...request,originalDigest:''},{...request,rootMutationId:'x'},{...request,extra:'x'},{...request,extra:'x'.repeat(40000)}])assert.notEqual((await rpc('review_n58_empty_foundation',{p_request:invalid})).status,200);
 assert.notEqual((await rpc('review_n58_empty_foundation',{p_request:request},true)).status,200);
 assert.notEqual((await rpc('n58_repair_snapshot',{p_owner:a.user.id,p_preset:request.presetId})).status,200);
 const plan=await rpc('review_n58_empty_foundation',{p_request:request});assert.equal(plan.status,200);
 for(const invalid of [{...plan.body,snapshotDigest:'b'.repeat(64)},{...plan.body,snapshot:{years:[],terms:[{}]}},{...plan.body,extra:'x'.repeat(40000)}])assert.notEqual((await rpc('apply_n58_empty_foundation',{p_repair_id:randomUUID(),p_plan:invalid})).status,200);
 assert.notEqual((await rpc('apply_n58_empty_foundation',{p_repair_id:'x'.repeat(1000),p_plan:plan.body})).status,200);
 assert.notEqual((await rpc('apply_n58_empty_foundation',{p_repair_id:randomUUID(),p_plan:plan.body},true)).status,200);
 for(const table of ['years','terms']){const read=await fetch(svc.restUrl+'/'+table+'?owner_id=eq.'+a.user.id,{headers:{Authorization:'Bearer '+a.access_token,'Accept-Profile':'rakeezx'}});assert.equal((await read.json()).length,0);}
 receipt.checks.push({name:'exact_sql_installs_and_request_size_id_preimage_acl_limits',status:'PASS'});
});receipt.completed=true;}catch(error){receipt.problem={message:error.message,stack:error.stack};process.exitCode=1;}
finally{await fs.writeFile('tests/n58-empty-recovery-limits.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({completed:receipt.completed,checks:receipt.checks,problem:receipt.problem,sqlSha256:receipt.sqlSha256}));
