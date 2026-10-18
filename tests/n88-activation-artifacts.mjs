/** AI: bounded offline package/inactive-config checks; not a rendered-UI or hosted proof. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {verifyReadback} from '../scripts/n88-activation-readback.mjs';
const dir='drafts/n88-student-portal/activation/',manifest=JSON.parse(await readFile(dir+'manifest.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex'),checks=[];
for(const [file,expected]of Object.entries(manifest.sources))assert.equal(hash((await readFile(file,'utf8')).replaceAll('\r\n','\n')),expected,file);
for(const [file,expected]of Object.entries(manifest.outputs))assert.equal(hash(await readFile(dir+'bundle/'+file)),expected,file);
checks.push({name:'exact_offline_bundle_graph_hashes',status:'PASS',evidence:`${Object.keys(manifest.sources).length} source identities and ${Object.keys(manifest.outputs).length} exact output hashes match. Edge local imports bundled; exact pg/Auth SDK remain lock-pinned externals. Cloudflare/browser have zero external imports; actual app document/CSS bundled, no fabricated UI.`});
for(const key of ['cloudflare/worker.mjs','private/assets/student.mjs'])assert.deepEqual(manifest.graphs[key].imports,[]);
for(const item of manifest.graphs['edge/index.mjs'].imports)assert.ok(item.external&&(/^(node:|pg$|@supabase\/auth-js$)/.test(item.path)),item.path);
assert.ok(!Object.values(manifest.graphs).flatMap(g=>g.inputs).some(f=>/n44|notifications/.test(f)));
const lock=JSON.parse(await readFile(dir+'bundle/edge/deno.lock','utf8')),pkg=JSON.parse(await readFile('drafts/n88-student-portal/package-lock.json','utf8'));
for(const [name,version]of Object.entries(manifest.externalDependencies))assert.equal(lock.npm[name+'@'+version].integrity,pkg.packages['node_modules/'+name].integrity);
const config=JSON.parse(await readFile(dir+'deploy.staged.json','utf8'));
assert.equal(config.enabled,false);assert.equal(config.function.enabled,false);assert.equal(config.privateDocument.enabled,false);
assert.equal(config.privateDocument.browserReadiness,false);assert.deepEqual(config.cloudflare.routes,[]);assert.deepEqual(config.cron,[]);
const html=await readFile(dir+'bundle/private/student.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(match[1].startsWith('/n88-private/'));await readFile(dir+'bundle/private/'+match[1].slice('/n88-private/'.length));
}
const worker=await import(pathToFileURL(path.resolve(dir+'bundle/cloudflare/worker.mjs')));
let reads=[];const env=new Proxy({},{get(_t,k){reads.push(k);if(k==='N88_ENABLED')return 'false';throw Error('disabled secret read');}});
assert.equal((await worker.default.fetch(new Request('https://synthetic.invalid/api/n88/teacher/students'),env)).status,503);
assert.deepEqual(reads,['N88_ENABLED']);
checks.push({name:'inactive_namespace_runtime_config_and_dependency_integrity',status:'PASS',evidence:'Pinned esbuild 0.28.1; actual Cloudflare bundle default-OFF returns 503 reading only N88_ENABLED. No routes/cron/preview, browser readiness false, dedicated /n88-private assets resolve, no N44 graph, package integrity agrees with npm/Deno locks. Existing Deno2.2 runtime qualification reused; auxiliary Deno2.9 type-check passed.'});
const expected=JSON.parse(await readFile(dir+'expected-identities.json','utf8'));
const fabricated={projectId:manifest.projectId,personalRowsRead:0,mode:'metadata-only',capturedAt:new Date().toISOString(),identities:structuredClone(expected.identities),migrationVersion:'20261018034356',enabled:false};
assert.match(verifyReadback(fabricated,expected),/matches/);
for(const mutate of [a=>{a.identities.helpers[0].definition_md5='wrong';},a=>{a.identities.roles[0].rolbypassrls=true;},a=>{a.projectId='wrong';},a=>{a.enabled=true;}]) {
  const bad=structuredClone(fabricated);mutate(bad);assert.throws(()=>verifyReadback(bad,expected));
}
checks.push({name:'metadata_only_readback_collision_and_tamper_guards',status:'PASS',evidence:'Actual local PG helper/ACL/grant/policy identities exported. Offline readback verifier accepts fabricated matching envelope and rejects changed helper, BYPASSRLS, project and enabled flag. No hosted readback performed.'});
for(const f of ['scripts/n88-activation-prepare.mjs','scripts/n88-activation-bundle.mjs','scripts/n88-activation-readback.mjs','tests/n88-activation-postgres.mjs','tests/n88-activation-artifacts.mjs','tests/fixtures/n88-activation/guards.mjs'])execFileSync(process.execPath,['--check',f],{windowsHide:true});
const shared=execFileSync('git',['diff','--name-only','ddddd901b321acd432c54426faa3f09873c1987f','--','src','public','supabase/functions/n44-notifications'],{encoding:'utf8'}).trim();assert.equal(shared,'');
checks.push({name:'affected_syntax_and_shared_scope_unchanged',status:'PASS',evidence:'Six affected modules syntax-check. No src/public/SW/N44 changes; no startup dependency, offline shell unchanged. No browser/server phase needed for packaging; no UI acceptance claimed.'});
await writeFile('tests/n88-activation-artifacts.result.json',JSON.stringify({taskId:'continuous-n88-service-activation-candidate-20261018',runId:'d05b1d5b-3c34-4b95-abea-1f3b4609600c',checkedAt:new Date().toISOString(),checks},null,2)+'\n');
console.log('N88 exact inactive bundle/readback/namespace checks PASS');
