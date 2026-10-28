import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
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
