/** AI: exact inactive closure/defaults, no provider operation or hosted acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {privateAssets} from '../../drafts/n88-student-portal/activation/v2-student-scope-1031/private-assets.inactive.mjs';
import {createHostedCompatGateway} from '../../drafts/n88-student-portal/activation/v2-student-scope-1031/gateway.prepared.mjs';
const dir='drafts/n88-student-portal/activation/v2-student-scope-1031/',sha=b=>createHash('sha256').update(b).digest('hex'),source=async p=>(await readFile(p,'utf8')).replaceAll('\r\n','\n');
test('prepared current service/gateway/student/CSS identities and finite allowlist match current sources',async()=>{
 const m=JSON.parse(await source(dir+'assets-manifest.json')),delivery=JSON.parse(await source(dir+'delivery-manifest.json')),sql=JSON.parse(await source(dir+'manifest.json'));
 assert.equal(m.sourceBase,'5b77024e36f254a6568a0224abb9ea25d78698af');assert.equal(m.enabled,false);assert.equal(m.installed,false);assert.equal(m.flags.PUBLICATION_V2_READINESS,false);assert.equal(m.flags.N88_PUBLICATION_V2_ENABLED,false);assert.equal(m.flags.V1Readiness,true);
 for(const [f,h] of Object.entries(m.inputs))assert.equal(sha(await source(f)),h,f);
 for(const [name,h] of Object.entries(m.outputs))assert.equal(sha(await readFile(dir+name+'.prepared.mjs')),h,name);
 assert.deepEqual(Object.keys(privateAssets).sort(),Object.keys(m.assets).sort());assert.deepEqual(delivery.assetAllowlist,Object.keys(privateAssets).sort());
 for(const [p,a] of Object.entries(privateAssets))assert.equal(sha(Buffer.from(a.base64,'base64')),m.assets[p].sha256,p);
 for(const css of ['app.css','student-portal-login.css','student-portal.css'])assert.equal(Buffer.from(privateAssets['/n88-private/styles/'+css].base64,'base64').toString(),await source('src/styles/'+css));
 for(const [f,h] of Object.entries(sql.files))assert.equal(sha(await source(dir+f)),h,f);
 assert.equal(sha(await source(dir+'install.inactive.sql')),sql.installerSha256);assert.equal(sha(await source(dir+'disable.inactive.sql')),sql.disableSha256);assert.equal(sha(await source(dir+'readback.sql')),sql.readbackSha256);
 assert.equal(delivery.sqlBundleSha256,sql.bundleSha256);assert.deepEqual(delivery.outputs,m.outputs);const {deliverySha256,...signed}=delivery;assert.equal(sha(JSON.stringify(signed)),deliverySha256);
 const student=await source(dir+'student.prepared.mjs'),service=await source(dir+'service.prepared.mjs');
 assert(student.includes('n88-student-scope-v2'));assert(student.includes('data-student-teaching'));assert.match(student,/PUBLICATION_V2_READINESS = Object.freeze\(\{ enabled: false/);
 assert(service.includes('safe_student_scope_labels_1031'));assert(service.includes('selectionState'));assert(!service.includes('studentTeachingId'));
});
test('actual prepared gateway serves only exact owned static assets and keeps all activation default OFF',async()=>{
 let upstream=0;const gateway=createHostedCompatGateway({fetch:async()=>{upstream++;throw Error('no external fixture');}}),origin='https://synthetic.invalid';
 const req=p=>{const r=new Request(origin+p);Object.defineProperty(r,'cf',{value:{tlsVersion:'TLSv1.3'}});return r;};
 const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_PUBLICATION_V2_ENABLED:'false'};
 for(const [p,a] of Object.entries(privateAssets)){const r=await gateway(req(p),env);assert.equal(r.status,200,p);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(Buffer.from(a.base64,'base64')));assert.match(r.headers.get('cache-control'),/no-store/);}
 assert.equal((await gateway(req('/api/n88/student/publication-v2/read'),env)).status,503);assert.equal(upstream,0);
 assert.equal((await gateway(req('/n88-private/assets/student.mjs?enabled=true'),env)).status,404);
 assert.equal((await gateway(req('/student'),{})).status,404);assert.equal(upstream,0);
});
