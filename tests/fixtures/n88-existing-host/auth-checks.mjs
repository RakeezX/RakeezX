import assert from 'node:assert/strict';
import {createTeacherVerifier} from '../../../drafts/n88-student-portal/auth-verifier.mjs';
import {A,B,SESSION,authUrl,providerFixture} from './provider.mjs';
export async function authChecks({admin,report}) {
  const provider=providerFixture(),options={authUrl,apiKey:'FABRICATED_PUBLIC_API_KEY',fetch:provider.fetch};
  const verifier=createTeacherVerifier(options),ports={query:(...args)=>admin.query(...args)};
  const check=token=>verifier('Bearer '+token,undefined,ports);
  const good=provider.token();
  assert.deepEqual(await check(good),{ownerId:A,sessionId:SESSION,current:true});
  assert.equal(provider.calls.filter(p=>p.endsWith('/user')).length,1);
  const bad=good.slice(0,-5)+'xxxxx';assert.equal(await check(bad),null);
  for(const overrides of [{iss:'https://foreign.invalid/auth/v1'},{aud:'service_role'},{role:'service_role'},{exp:1},{iat:Math.floor(Date.now()/1000)+10},
    {nbf:Math.floor(Date.now()/1000)+10},{session_id:undefined},{session_id:'22222222-2222-4222-8222-222222222222'},
    {sub:B},{is_anonymous:true}])assert.equal(await check(provider.token(overrides)),null);
  provider.foreign=true;assert.equal(await check(good),null);provider.foreign=false;
  provider.banned=true;assert.equal(await check(good),null);provider.banned=false;
  provider.denied=true;assert.equal(await check(good),null);provider.denied=false;
  await admin.query("update auth.sessions set not_after=now()-interval '1 second'");assert.equal(await check(good),null);
  await admin.query('update auth.sessions set not_after=null');
  await admin.query('delete from auth.sessions');assert.equal(await check(good),null);
  await admin.query('insert into auth.sessions(id,user_id) values($1,$2)',[SESSION,A]);
  const before=provider.calls.length;assert.ok(await check(provider.token({},'HS256')));
  assert.equal(provider.calls.slice(before).filter(p=>p.endsWith('/user')).length,2); // verified provider + fresh user
  assert.equal(await verifier('Bearer '+good,undefined,{query:async()=>({rows:[{user_id:B,session_id:SESSION}]})}),null);
  let time=Date.now();const guards=[];
  const bounded=createTeacherVerifier({...options,now:()=>time});
  assert.ok(await bounded('Bearer '+provider.token({exp:Math.floor(time/1000)+60}),undefined,{...ports,beforeCommit:f=>guards.push(f)}));
  time+=120000;await assert.rejects(()=>guards[0]());
  provider.delay=true;
  const start=Date.now();assert.equal(await createTeacherVerifier({...options,authDeadlineMs:40})('Bearer '+good,undefined,ports),null);
  assert.ok(Date.now()-start<1000);provider.delay=false;
  report.authEvidence='Official AuthClient ES256 signature/JWKS + HS256 server verification, exact issuer/audience/expiry/nbf/role/user/session; fresh getUser; wrong signature/foreign/banned/missing/expired/revoked sessions deny; 40ms full provider deadline; no real Auth call.';
  return provider; // One issuer/keyset for this fixture; preserve official SDK JWKS caching.
}
