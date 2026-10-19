/** AI: bounded provider rollback helper contract, mocked provider only. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import disable from '../drafts/n44-push/activation/disable-provider.mjs';
const calls=[];
const api={request:async r=>{calls.push(r);if(r.path.endsWith('/settings'))return {success:true,status:200,result:{bindings:[{name:'N44_ENABLED',type:'plain_text',text:'true'},{name:'N44_INGRESS_KEY',type:'secret_text'}]}};if(r.method==='GET')return {success:true,result:[{id:'OWNED',pattern:'rakeezx.com/api/n44/*',script:'n44-notifications-ingress'},{id:'UNRELATED',pattern:'rakeezx.com/other/*',script:'other'}]};return {success:true,status:200};}};
await disable(api);assert.equal(calls.filter(x=>x.method==='PATCH').length,2);assert.equal(calls.filter(x=>x.method==='DELETE').length,1);assert.ok(calls.find(x=>x.method==='DELETE').path.endsWith('/OWNED'));assert.ok(!calls.some(x=>x.path.endsWith('/secrets')));
for(const r of calls.filter(x=>x.method==='PATCH')){assert.ok(r.body.includes('"N44_ENABLED","text":"false"'));assert.ok(r.body.includes('"type":"inherit"'));}
let deleted=false;await assert.rejects(()=>disable({request:async r=>{if(r.method==='DELETE')deleted=true;return r.path.endsWith('/settings')?{success:true,result:{bindings:[]}}:{success:true,result:[{id:'FOREIGN',pattern:'rakeezx.com/api/n44/*',script:'other'}]};}}),/n44_foreign_route_collision/);assert.equal(deleted,false);
const report={aiAuthored:true,runId:'fdaa4ff1-9221-41b9-8661-8a57a9a6e986',status:'PASS',ownedSettingsOnly:true,secretValuesNotRead:true,exactOwnedRouteOnly:true,foreignCollisionRejected:true,liveRollbackPerformed:false};await writeFile('tests/n44-finish-disable.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
