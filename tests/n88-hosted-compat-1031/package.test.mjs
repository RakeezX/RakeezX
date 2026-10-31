/** AI: affected inactive packet/asset/negative contracts; no remote or browser. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {verifyCombined,bindCombined} from '../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/bind.mjs';
import {createHostedPublicationV2Runtime} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/host.mjs';
import {authorizeRuntimeConnection} from '../../drafts/n88-student-portal/activation/v2-runtime-writer-1031/capability.mjs';
import {createHostedCompatGateway} from '../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/gateway.inactive.mjs';
import {privateAssets} from '../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/private-assets.inactive.mjs';
const dir=new URL('../../drafts/n88-student-portal/activation/v2-hosted-compat-1031/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const read=async f=>(await readFile(new URL(f,dir),'utf8')).replaceAll('\r\n','\n');
test('exact final combined installer reuses native-qualified SQL except bound source digest',async()=>{
 const m=await verifyCombined(),r=JSON.parse(await readFile(new URL('results.json',import.meta.url),'utf8')),sql=await read('install.inactive.sql');
 assert.equal(r.status,'PASS');assert.equal(sha(sql.replaceAll(m.bundleSha256,r.packetQualification.bundleSha256)),r.packetQualification.installerSha256);assert(r.cleanup.pidAbsent&&r.cleanup.portFree&&r.cleanup.ownedDataRemoved);assert.equal(r.leaseRelease,'RELEASED integration');
 assert.equal(m.newFixedWrappers,14);assert.equal(m.newTables,0);assert.equal(m.newCredentials,0);assert.equal(m.enabled,false);assert.equal(m.hostedExecuted,false);
 for(const operation of ['install','disable']){const b=await bindCombined({operation});assert(b.inactive&&!b.execute);assert(b.sql.includes("expected_authority jsonb := 'null'::jsonb;"));}
 await assert.rejects(bindCombined({operation:'privacy'}),/operation_required/);await assert.rejects(bindCombined({authorityPath:'./arbitrary.json'}),/original_authority_path_required/);
});
test('default OFF never acquires; unsafe hosted deadline and missing exact boundary deny',async()=>{
 let acquired=0;const acquire=()=>{acquired++;throw Error('unexpected');};const h=await createHostedPublicationV2Runtime({acquire});assert.notEqual((await h.handle({})).status,200);assert.equal(acquired,0);
 await assert.rejects(createHostedPublicationV2Runtime({enabled:true,acquire,assertTransport:()=>{},canonical:{},transactionMs:10000}),/host_unavailable/);assert.equal(acquired,0);
 let n=0;await assert.rejects(authorizeRuntimeConnection({query:async()=>({rows:++n===1?[{login:'n88_backend',role:'n88_backend',database_name:'postgres',system_identifier:'1',superuser:false,bypass:false,create_role:false,create_db:false,owner_set:false,guard_set:false}]:[]})},{expectedSystemIdentifier:'1',assertTransport:async()=>{}}),/safe_boundary_required/);assert.equal(n,2);
});
test('current source service/student/asset closure exact; readiness and activation stay OFF',async()=>{
 const m=JSON.parse(await read('assets-manifest.json'));assert.equal(m.enabled,false);assert.equal(m.installed,false);assert.deepEqual(m.flags,{N88_PUBLICATION_V2_ENABLED:false,PUBLICATION_V2_READINESS:false});
 for(const [f,h]of Object.entries(m.inputs))assert.equal(sha((await readFile(new URL(f,new URL('../../',import.meta.url)),'utf8')).replaceAll('\r\n','\n')),h,f);
 for(const [name,file]of Object.entries({student:'student.prepared.mjs',service:'service.prepared.mjs',gateway:'gateway.prepared.mjs'}))assert.equal(sha(await read(file)),m.outputs[name]);
 for(const [f,a]of Object.entries(privateAssets))assert.equal(sha(Buffer.from(a.base64,'base64')),m.assets[f].sha256);
 assert(privateAssets['/n88-private/styles/student-portal.css']);assert((await read('student.prepared.mjs')).includes('student-portal.css'));
 const source=await readFile(new URL('src/lib/student-portal-publication-client.js',new URL('../../',import.meta.url)),'utf8');assert(source.includes('enabled: false'));
});
test('actual prepared gateway serves exact private CSS only through original TLS/origin guards',async()=>{
 let calls=0;const handler=createHostedCompatGateway({fetch:async()=>{calls++;throw Error('no live request');}}),origin='https://synthetic.invalid';
 const request=(url,cf=true,headers={})=>{const r=new Request(url,{headers});if(cf)Object.defineProperty(r,'cf',{value:{tlsVersion:'TLSv1.3'}});return r;};const env={N88_ENABLED:'true',N88_PUBLICATION_V2_ENABLED:'false',N88_PUBLIC_ORIGIN:origin};
 for(const path of ['/n88-private/assets/student.mjs','/n88-private/styles/student-portal.css']){const r=await handler(request(origin+path),env);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(Buffer.from(privateAssets[path].base64,'base64')));assert(r.headers.get('content-security-policy').includes("connect-src 'self'"));}
 for(const [r,e]of [[request(origin+'/student'),{...env,N88_ENABLED:'false'}],[request(origin+'/student',false),env],[request(origin+'/student',true,{'cf-worker':'foreign'}),env],[request('https://foreign.invalid/student'),env]])assert.notEqual((await handler(r,e)).status,200);
 assert.equal(calls,0);
});
