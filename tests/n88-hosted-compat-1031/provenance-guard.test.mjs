/** AI: fabricated state and pure public code only; no custody/connection access. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {qualifyOriginalRuntimeState} from '../../drafts/n88-student-portal/activation/denied-read-20261023/runtime-expectations.mjs';
import {priorSource} from '../../drafts/n88-student-portal/activation/denied-read-20261023/transition-guards.mjs';
import {originalRecoveryVersion} from '../../drafts/n88-student-portal/activation/denied-read-20261023/runtime-configuration.mjs';
import {consumeProfileCredential,classifyProfileError} from '../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/profile-original-custodian.mjs';
const valid=()=>({directVerified:true,directSource:priorSource,finalRelease:{publicEnabled:true},recoveryVersion:originalRecoveryVersion,recovery:'FAKE_RECOVERY',password:'FAKE_PASSWORD'});
const invalid=[undefined,null,"FAKE_NONOBJECT",7,false,...[{directVerified:false},{directVerified:undefined},{directSource:'wrong'},{finalRelease:undefined},{finalRelease:{publicEnabled:false}},{finalRelease:{publicEnabled:1}},{recoveryVersion:'wrong'},{recovery:''},{password:''},{loginDisarmed:true},{directAuthRefused:true}].map(p=>({...valid(),...p}))];
test('shared exact original provenance predicate accepts valid state without mutation and refuses each invalid predicate',()=>{
 const s=valid(),before=structuredClone(s);qualifyOriginalRuntimeState(s);assert.deepEqual(s,before);qualifyOriginalRuntimeState({...s,directVerified:1});
 for(const state of invalid)assert.throws(()=>qualifyOriginalRuntimeState(state),{message:'n88_runtime_expected_provenance'});
});
test('disarmed/refused state with nonempty password is rejected before mock connection and clears buffers/state',t=>{
 const parse=JSON.parse;let parsed;
 t.mock.method(JSON,'parse',text=>{parsed=parse(text);return parsed;});
 for(const state of invalid.filter(v=>v!==undefined)){
  const plain=Buffer.from(JSON.stringify(state));let connections=0;
  assert.throws(()=>{const password=consumeProfileCredential(plain);connections++;assert(password);});
  assert.equal(connections,0);assert(plain.every(v=>v===0));if(parsed&&typeof parsed==='object')assert(Object.values(parsed).every(v=>v===null));
 }
});
test('valid consumption clears parsed state and buffer; malformed JSON and invalid password type also clear',t=>{
 const parse=JSON.parse;let parsed;t.mock.method(JSON,'parse',text=>{parsed=parse(text);return parsed;});
 const good=Buffer.from(JSON.stringify(valid()));assert.equal(consumeProfileCredential(good),'FAKE_PASSWORD');assert(good.every(v=>v===0));assert(Object.values(parsed).every(v=>v===null));
 const malformed=Buffer.from('{bad');assert.throws(()=>consumeProfileCredential(malformed));assert(malformed.every(v=>v===0));
 const typed=Buffer.from(JSON.stringify({...valid(),password:1}));assert.throws(()=>consumeProfileCredential(typed),{message:'n88_profile_credential_shape'});assert(typed.every(v=>v===0));assert(Object.values(parsed).every(v=>v===null));
});
test('provenance refusal diagnostics expose only fixed safe code',()=>{
 const plain=Buffer.from(JSON.stringify({...valid(),loginDisarmed:true}));let error;try{consumeProfileCredential(plain);}catch(e){error=e;}
 const result=classifyProfileError(error);assert.deepEqual(result,{category:'guard',code:'n88_runtime_expected_provenance'});assert(!JSON.stringify(result).includes('FAKE_PASSWORD'));
 assert.deepEqual(classifyProfileError({code:'EPIPE',message:'FAKE_PASSWORD'}),{category:'network',code:'EPIPE'});
});
test('original caller retains exact predicate position and every remaining original verification byte',async()=>{
 const file='drafts/n88-student-portal/activation/denied-read-20261023/runtime-expectations.mjs';
 const old=execFileSync('git',['show','f9f361693f6f1a7fc058acafcf2518b43d4ed80c:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const now=(await readFile(file,'utf8')).replaceAll('\r\n','\n');
 const predicate=old.slice(old.indexOf(' if(!state?.directVerified'),old.indexOf(' if(publicConfigBytesDigest'));
 const originalBody=old.slice(old.indexOf('export function originalRuntimeExpectations'));
 const currentBody=now.slice(now.indexOf('export function originalRuntimeExpectations')).replace(' qualifyOriginalRuntimeState(state);\n',()=>predicate);
 assert.equal(currentBody,originalBody);
 const helper=(await readFile('drafts/n88-student-portal/activation/v2-hosted-compat-1031/profile-original-custodian.mjs','utf8')).replaceAll('\r\n','\n');
 assert(helper.includes("state=JSON.parse(plain.toString('utf8'));\n  qualifyOriginalRuntimeState(state);\n  const password=state.password;"));
 assert(helper.indexOf('password=consumeProfileCredential(plain);')<helper.indexOf('config=databaseConfig('));
});
