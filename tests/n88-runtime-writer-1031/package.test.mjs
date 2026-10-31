/** AI: affected admission/package negatives; no hosted connection or SQL execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyPackage,bindPackage} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/package.mjs';
import {authorizeRuntimeConnection,publicationRuntimeAllowed} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/capability.mjs';
import {createHostedPublicationV2Runtime} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/host.mjs';
import {createRuntimeWriterGateway} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/gateway.inactive.mjs';
const origin='https://synthetic.invalid';
test('default OFF acquires no client and rejects forged hosted capability',async()=>{
 let acquired=false;const host=await createHostedPublicationV2Runtime({origin,acquire:()=>{acquired=true;throw Error('unexpected');}});assert.notEqual((await host.handle({})).status,200);assert.equal(acquired,false);
 assert.equal(publicationRuntimeAllowed('hosted',Object.freeze({})),false);assert.equal(publicationRuntimeAllowed('production',{}),false);
});
test('actual session admission refuses privileged/mismatched physical target and private logging drift',async()=>{
 const identity={login:'n88_backend',role:'n88_backend',database_name:'postgres',system_identifier:'123',superuser:false,bypass:false,create_role:false,create_db:false,owner_set:false,guard_set:false};
 const logging={verbosity:'terse',parameters:'0',statements:'none',duration:'-1',sample:'-1',sampling:'0',audit:null,explain:null};
 for(const patch of [{login:'postgres'},{role:'postgres'},{system_identifier:'124'},{superuser:true},{bypass:true},{guard_set:true},{owner_set:true},{create_role:true},{create_db:true}]){
  await assert.rejects(authorizeRuntimeConnection({query:async()=>({rows:[{...identity,...patch}]})},{expectedSystemIdentifier:'123',assertTransport:async()=>{}}),/n88_restricted_runtime_required/);
 }
 let calls=0;await assert.rejects(authorizeRuntimeConnection({query:async()=>({rows:[++calls===1?identity:{...logging,verbosity:'default'}]})},{expectedSystemIdentifier:'123',assertTransport:async()=>{}}),/n88_private_runtime_logging_required/);
 await assert.rejects(authorizeRuntimeConnection({query:()=>assert.fail('transport must precede SQL')},{expectedSystemIdentifier:'123',assertTransport:async()=>{throw Error('transport_denied');}}),/transport_denied/);
});
test('immutable packet binds all source components and full installer stays unbound',async()=>{
 const {manifest:m,sql}=await verifyPackage();assert.equal(m.serviceEnabled,false);assert.equal(m.hostedExecuted,false);assert.equal(m.storageReinstall,false);assert.equal(m.delta.newCredentials,0);assert.equal(m.delta.newPermanentMemberships,0);assert.equal(m.delta.rawTableGrants,0);
 assert.equal(m.delta.newRuntimeFixedExecute,14);assert.equal(m.delta.newWriterHelpers,3);assert.equal(m.delta.newTables,0);
 assert(sql.includes("expected_authority jsonb := 'null'::jsonb;"));assert.equal((await bindPackage()).inactive,true);
 assert.equal((await bindPackage({operation:'disable'})).inactive,true);assert.equal((await bindPackage({operation:'privacy'})).inactive,true);await assert.rejects(bindPackage({operation:'arbitrary'}),/n88_exact_package_operation_required/);
 await assert.rejects(bindPackage({authorityPath:'./fabricated-authority.json',authoritySha256:'0'.repeat(64)}),/n88_original_authority_path_required/);
 for(const name of ['runtime-role.sql','writer-helpers.sql','writer-replacement.sql']){const source=(await readFile(new URL('../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/'+name,import.meta.url),'utf8')).replaceAll('\r\n','\n');assert(sql.includes(source));}
 const observed=JSON.parse(await readFile(new URL('../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/observed-writer.json',import.meta.url),'utf8'));
 assert.equal(observed.rows.length,2);for(const r of observed.rows)assert.equal(createHash('sha256').update(r.definition).digest('hex'),r.sha256);
 const native=JSON.parse(await readFile(new URL('../n88-writer-compatibility-1031/packet-results.json',import.meta.url),'utf8'));assert.equal(native.status,'PASS');
 assert.equal(createHash('sha256').update(sql.replaceAll(m.bundleSha256,native.packetQualification.bundleSha256)).digest('hex'),native.packetQualification.sourceInstallerSha256,'corrected qualified packet; historical altered-writer proof is not compatibility evidence');
});
test('new gateway refuses disabled/query/foreign/subrequest without reaching service',async()=>{
 let sends=0;const gateway=createRuntimeWriterGateway({fetch:async()=>{sends++;throw Error('unexpected');}});
 const env={N88_ENABLED:'true',N88_PUBLICATION_V2_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:'https://auth.synthetic.invalid/functions/v1/n88-student-portal',N88_INGRESS_KEY:'1'.repeat(64)};
 const make=(url,headers={})=>{const r=new Request(url,{headers:{'cf-connecting-ip':'192.0.2.31',...headers}});Object.defineProperty(r,'cf',{value:{tlsVersion:'TLSv1.3'}});return r;};
 for(const [r,e]of [[make(origin+'/api/n88/student/publication-v2/read'),{...env,N88_PUBLICATION_V2_ENABLED:'false'}],[make(origin+'/api/n88/student/publication-v2/read?x=1'),env],[make('https://foreign.invalid/api/n88/student/publication-v2/read'),env],[make(origin+'/api/n88/student/publication-v2/read',{'cf-worker':'foreign'}),env],[make(origin+'/api/n88/arbitrary-sql'),env]])assert.notEqual((await gateway(r,e)).status,200);
 assert.equal(sends,0);
});
