import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createHandler, fixtureEmail, fixtureMarker, sha256, PURPOSE, PROJECT_ID, BAN_DURATION } from '../supabase/functions/ops-n71-fixture/handler-core.mjs';
const RUN='fc77ae70-4cfa-4d2e-98ba-89232fe3c4f4';
async function harness(mode){
  const capability=randomBytes(32).toString('base64url'),password='N71!aA1'+randomBytes(32).toString('base64url');
  const now=Date.now();let clock=now,clients=0;const users=new Map(),writes=[];
  const manifest={version:1,purpose:PURPOSE,projectId:PROJECT_ID,runId:RUN,mode,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+5400000).toISOString(),
    capabilitySha256:await sha256(capability),fixtureContractSha256:'a'.repeat(64),implementationSha256:'b'.repeat(64),
    accounts:await Promise.all(['A','B'].map(async slot=>({slot,id:randomUUID(),email:fixtureEmail(RUN,slot),passwordSha256:await sha256(password)})))};
  const admin={async getUserById(id){return users.has(id)?{data:{user:users.get(id)}}:{error:{status:404,code:'user_not_found'}};},
    async createUser(input){writes.push(input);users.set(input.id,{...input,role:'authenticated',email_confirmed_at:manifest.issuedAt});return {data:{user:users.get(input.id)}};},
    async updateUserById(id,input){writes.push({id,...input});users.get(id).banned_until=new Date(now+876000*3600000).toISOString();return {data:{user:users.get(id)}};},
    async signOut(token,scope){writes.push({token,scope});return {};}};
  const handler=createHandler({manifest,clock:()=>clock,createClients:()=>{clients++;return {configured:true,admin,auth:{async getUser(){return {data:{user:users.get(manifest.accounts[0].id)}};}}};}});
  const call=(operation,extra={},proof=capability)=>handler(new Request('https://n71.example/',{method:'POST',headers:{'Content-Type':'application/json','x-n71-capability':proof},
    body:JSON.stringify({version:1,runId:RUN,operation,...extra})}));
  return {manifest,password,call,users,writes,get clients(){return clients;},expire(){clock=now+5400000;}};
}
test('N71 exact-pair provision is authenticated, expiring, idempotent and closed to arbitrary identities',async()=>{
  const h=await harness('provision');assert.equal((await h.call('ensure',{slot:'A',password:h.password},'wrong')).status,401);assert.equal(h.clients,0);
  assert.equal((await h.call('ensure',{slot:'C',password:h.password})).status,400);assert.equal(h.clients,0);
  assert.equal((await h.call('retire',{slot:'A'})).status,409);assert.equal(h.clients,0);
  assert.equal((await h.call('ensure',{slot:'A',password:h.password})).status,200);assert.equal(h.writes.length,1);
  assert.equal((await h.call('ensure',{slot:'A',password:h.password})).status,200);assert.equal(h.writes.length,1);
  const account=h.manifest.accounts[0];assert.equal(h.writes[0].id,account.id);assert.deepEqual(h.writes[0].app_metadata,{n71:fixtureMarker(h.manifest,'A')});
  h.expire();assert.equal((await h.call('ensure',{slot:'B',password:h.password})).status,410);assert.equal(h.writes.length,1);
});
test('N71 cleanup cannot provision or change the pair; official global sign-out and fixed read-back ban preserve retention',async()=>{
  const h=await harness('cleanup-only'),a=h.manifest.accounts[0];h.users.set(a.id,{...a,role:'authenticated',email_confirmed_at:h.manifest.issuedAt,app_metadata:{n71:fixtureMarker(h.manifest,'A')}});
  assert.equal((await h.call('ensure',{slot:'A',password:h.password})).status,409);assert.equal(h.clients,0);
  assert.equal((await h.call('revoke',{slot:'A',accessToken:'aaa.bbb.ccc'})).status,200);assert.deepEqual(h.writes[0],{token:'aaa.bbb.ccc',scope:'global'});
  const retired=await(await h.call('retire',{slot:'A'})).json();assert.equal(retired.state,'retained_banned');assert.equal(h.writes[1].ban_duration,BAN_DURATION);
  assert.equal(h.users.size,1);assert.equal((await h.call('retire',{slot:'A'})).status,200);assert.equal(h.writes.length,2);
  h.users.get(a.id).app_metadata={n71:{purpose:'other'}};assert.equal((await h.call('retire',{slot:'A'})).status,409);assert.equal(h.writes.length,2);
});
