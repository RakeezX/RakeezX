import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const require=createRequire('C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n44-one-approved-closed-page-push-20261019/drafts/n44-push/package.json');
const packages=new Set(['pg','web-push','ipaddr.js','@supabase/auth-js','@noble/curves/nist.js']);
const resolved=new Map([...packages].map(p=>[p,pathToFileURL(require.resolve(p)).href]));
registerHooks({resolve(specifier,context,next){return packages.has(specifier)?{url:resolved.get(specifier),shortCircuit:true}:next(specifier,context);}});

const hash=b=>createHash('sha256').update(b).digest('hex');
const dir='artifacts/build/n44-core-packet-1028/';
const manifest=JSON.parse(fs.readFileSync('drafts/n44-push/activation/core-v1-packet/manifest.public.json'));
test('n44_exact_finite_service_import_graph_and_compiled_hashes',()=>{
 assert.equal(hash(fs.readFileSync(dir+'edge.mjs')),manifest.hashes.edge);
 assert.equal(hash(fs.readFileSync(dir+'native-source.zip')),manifest.hashes.archive);
 assert.equal(hash(fs.readFileSync(dir+'import_map.json')),manifest.hashes.importMap);
 const edge=fs.readFileSync(dir+'edge.mjs','utf8');
 for(const marker of ['finite-due','N44_FINITE_SCHEDULER_JSON','finiteGuards','Deno.serve','privateQuery','beforePermit'])assert.ok(edge.includes(marker),marker);
});
test('n44_saved_native178_guards_preserved_without_remote_read',()=>{
 const comparison=JSON.parse(fs.readFileSync(dir+'comparison.json'));
 assert.deepEqual(comparison.missing,[],'Saved Native178 source graph is absent from current checkout; do not install this archive');
 assert.deepEqual(comparison.changed.sort(),['drafts/n44-push/backend.mjs','drafts/n44-push/existing-host.mjs']);
 assert.equal(manifest.counts.inputs,56);
 const preserved=execFileSync('git',['show','d4e695d3f823a9ba57c13aad2baeb9763da04aab:drafts/n44-push/private-runtime.mjs']);
 assert.equal(fs.readFileSync('drafts/n44-push/private-runtime.mjs','utf8').replace(/\r\n/g,'\n'),preserved.toString().replace(/\r\n/g,'\n'));

});
test('n44_scheduler_packet_off_caps_cleanup_and_no_secret_material',()=>{
 const config=fs.readFileSync('drafts/n44-push/activation/scheduler.staged.toml','utf8');
 assert.match(config,/crons = \[\]/);assert.match(config,/N44_ENABLED = "false"/);assert.match(config,/N44_SCHEDULER_ENABLED = "false"/);
 const host=fs.readFileSync('drafts/n44-push/existing-host.mjs','utf8');assert.ok(host.includes("N44_FINITE_SCHEDULER_JSON')??'null'"));
 assert.equal(JSON.parse(fs.readFileSync('drafts/n44-push/runtime-config.example.json')).finiteScheduler,null);
 const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);else assert.ok(Number.isInteger(v)||typeof v==='string'&&/^[a-f0-9]{64}$/.test(v));};visit(manifest);
 execFileSync('git',['check-ignore',dir+'native-source.zip']);
 const comparison=JSON.parse(fs.readFileSync(dir+'comparison.json'));
 assert.equal(Object.keys(comparison.inputs).length,manifest.counts.inputs);
 for(const p of Object.keys(comparison.inputs)){execFileSync('git',['ls-files','--error-unmatch','--',p]);assert.equal(hash(fs.readFileSync(p)),comparison.inputs[p]);}
});

test('compiled actual finite backend runs one bounded delivery after Native178 merge',async()=>{
 const compiledURL=pathToFileURL(path.resolve(dir+'compiled.mjs')).href;
 assert.equal(hash(fs.readFileSync(dir+'compiled.mjs')),manifest.hashes.qualification);
 // Reuse ONLY the existing synthetic SQL fixture; do not replay its eight-test campaign.
 let source=fs.readFileSync('tests/n44-core-auto-1028/timing-and-isolation.test.mjs','utf8').split("test('automatic lesson")[0];
 source=source.replace("from '../../drafts/n44-push/backend.mjs'",'from '+JSON.stringify(compiledURL));
 source=source.replaceAll(/from '(\.\.?[/][^']+)'/g,(_m,p)=>'from '+JSON.stringify(pathToFileURL(path.resolve('tests/n44-core-auto-1028',p)).href));
 source+='\nexport {setup};';
 const {setup}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const f=await setup();f.now=f.event.dueAt;f.outcome='uncertain';
 assert.equal((await f.tick()).outcomes[0],'uncertain');assert.equal(f.sends,1);
 f.now+=60000;f.backend=f.make();await f.tick();assert.equal(f.sends,1);
 f.now=f.descriptor.hardEnd;assert.equal((await f.tick()).status,'disabled');
 const c=await import(compiledURL);let envReads=[];
 const host=c.createExistingHost(n=>{envReads.push(n);return undefined;});
 assert.equal((await host.handle(new Request('https://synthetic.example'))).status,503);await host.close();assert.deepEqual(envReads,['N44_ENABLED']);
});
