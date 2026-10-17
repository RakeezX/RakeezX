// AI: source windows, transport limits and exact versioned package identity.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {appendSourceRows,sourceClasses,selectedSourceClass,reportsComplete} from '../extensions/rakeez-teacher-import-helper/source-roster.js';
import {validateHandoff,HANDOFF_TTL} from '../extensions/rakeez-teacher-import-helper/handoff-protocol.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.5.manifest.json','utf8'));
 const names=old.files.map(f=>f.file).sort();
 for(const name of names){const p=dir+name;if(/\.(js|css|html|json)$/.test(name))await fs.writeFile(p,(await fs.readFile(p,'utf8')).replace(/\r\n/g,'\n'));}
 const files=await Promise.all(names.map(async file=>{const b=await fs.readFile(dir+file);return {file,sha256:hash(b),bytes:b.length};}));
 // Fixed ZIP timestamps and source bytes; no package overwrites of previous versions.
 execFileSync('python',['-c',`import zipfile,pathlib,json; names=json.loads('${JSON.stringify(names)}'); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.6.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(zipfile.ZipInfo(n,(2026,10,17,0,0,0)),pathlib.Path('${dir}'+n).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)) for n in names]; z.close()`]);
 const file='rakeez-teacher-import-helper-0.5.6.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.6.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.6',applicationBaseSha:'e5aa4d4e5378e98a5d75a641ce341074cbfe0512',officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
test('0.5.6 package binds every shipped byte and preserves permissions and previous releases',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.6.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);
 assert.equal(hash(b),m.archive.sha256);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
 const manifest=JSON.parse(Buffer.from(zip['manifest.json']));assert.equal(manifest.version,'0.5.6');assert.equal(manifest.host_permissions,undefined);assert.match(manifest.content_security_policy.extension_pages,/connect-src 'none'/);
 for(const version of ['0.5.3','0.5.4','0.5.5'])for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-'+version+'.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show','e5aa4d4e5378e98a5d75a641ce341074cbfe0512:'+p]));}
});
test('350 cross-page class rows survive bounded windows; gaps and conflicting totals cannot complete',()=>{
 const rows=Array.from({length:350},(_,i)=>({name:'طالب اصطناعي '+String.fromCharCode(0x621+Math.floor(i/28))+String.fromCharCode(0x621+i%28),classroom:'فصل '+i%10}));
 const collected=[];for(let offset=0;offset<rows.length;offset+=300){const window=appendSourceRows([],rows.slice(offset,offset+300));for(const c of sourceClasses(window))collected.push(...selectedSourceClass(window,c.classroom));}
 assert.equal(collected.length,350);assert.equal(new Set(collected.map(r=>r.name)).size,350);
 const series={total:7,pages:new Set([1,2,3,4,5,6,7]),terminal:true,gap:false};assert.equal(reportsComplete(new Map([['s',series]])),true);
 for(const bad of [{...series,gap:true},{...series,pages:new Set([1,2,4,5,6,7])},{...series,terminal:false}])assert.equal(reportsComplete(new Map([['s',bad]])),false);
});

if(process.env.N36_BROWSER_PROOF==='1')test('browser evidence binds actual packaged extension and owner-guarded receiver source',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-background-report-fetch-browser.json','utf8'));
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.6.manifest.json','utf8'));
 assert.equal(e.status,'PASS');assert.equal(e.runId,'435d507d-d423-48ff-bd40-c5ab56358a91');assert.equal(e.archiveSha256,m.archive.sha256);
 for(const [name,sha] of Object.entries(e.sourceHashes))assert.equal(m.files.find(f=>f.file===name)?.sha256,sha,name);
 for(const [file,sha] of Object.entries(e.appHashes))assert.equal(hash(await fs.readFile(file)),sha,file);
 assert.ok(e.maxParallel>=2&&e.maxParallel<=3);assert.deepEqual(e.reportNavigations,[]);assert.deepEqual(e.externalRequests,[]);assert.deepEqual(e.errors,[]);assert.equal(e.release,'RELEASED browser');
 const full=e.scenarios.find(s=>s.scenario==='full350');assert.equal(full.transferred,350);assert.equal(full.added,350);assert.equal(full.batches,20);
 for(const name of e.requiredScenarios)assert.ok(e.scenarios.some(s=>s.scenario===name),name);
 assert.equal(e.extensionLayout.rtl,'rtl');assert.equal(e.extensionLayout.overflow,false);
});
