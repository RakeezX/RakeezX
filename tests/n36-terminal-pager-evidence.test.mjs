// AI: affected terminal coverage, exact package identity and selective proof reuse only.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {sourceCoverage} from '../extensions/rakeez-teacher-import-helper/source-roster.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',base='7ff299e243883c2ab9768f41f3a838c5775ce64b',hash=b=>createHash('sha256').update(b).digest('hex'),prior=f=>execFileSync('git',['show',base+':'+f]);
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.8.manifest.json','utf8')),names=old.files.map(f=>f.file).sort();
 const files=await Promise.all(names.map(async file=>{const b=await fs.readFile(dir+file);return {file,sha256:hash(b),bytes:b.length};}));
 execFileSync('python',['-c',`import zipfile,pathlib,json; names=json.loads('${JSON.stringify(names)}'); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.9.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(zipfile.ZipInfo(n,(2026,10,17,0,0,0)),pathlib.Path('${dir}'+n).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)) for n in names]; z.close()`]);
 const file='rakeez-teacher-import-helper-0.5.9.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.9.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.9',applicationBaseSha:base,officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
test('unknown, gap, stale/repeated failure and contradictory reports cannot turn optional discovery into completion',()=>{
 const series=new Map([['s',{total:7,pages:new Set([1,2,3,4,5,6,7]),terminal:true,gap:false}]]),optional={category:'students',optional:true,code:'ROSTER_LINKS_UNAVAILABLE'};
 assert.equal(sourceCoverage({series,warnings:[optional]}).complete,true);
 series.get('s').terminal=false;series.get('s').total=null;assert.equal(sourceCoverage({series,warnings:[optional]}).coverage,'partial');
 series.get('s').terminal=true;series.get('s').total=7;series.get('s').pages.delete(2);assert.equal(sourceCoverage({series,warnings:[optional]}).complete,false);
 series.get('s').pages.add(2);for(const code of ['PAGINATION_REPEAT_OR_CHANGED','PAGINATION_MISMATCH','REPORT_RESPONSE_REJECTED'])assert.equal(sourceCoverage({series,warnings:[optional,{category:'students',code}]}).complete,false);
 series.get('s').gap=true;assert.equal(sourceCoverage({series,warnings:[optional]}).complete,false);
});
test('0.5.9 exact ZIP/source/per-file binding, unchanged permissions and previous archives',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.9.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);
 assert.equal(m.applicationBaseSha,base);assert.equal(hash(b),m.archive.sha256);assert.equal(b.length,m.archive.bytes);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));assert.equal(hash(zip[f.file]),f.sha256);assert.equal(zip[f.file].length,f.bytes);}
 const manifest=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(prior(dir+'manifest.json'));assert.equal(manifest.version,'0.5.9');delete manifest.version;delete old.version;assert.deepEqual(manifest,old);
 for(const v of ['0.5.3','0.5.4','0.5.5','0.5.6','0.5.7','0.5.8'])for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-'+v+'.'+ext;assert.deepEqual(await fs.readFile(p),prior(p));}
 assert.match(await fs.readFile('src/views/class-import-center.js','utf8'),/helper-0\.5\.9\.zip/);
});
test('reuse unchanged 0.5.8 350/1000, transfer, sorting, expiry and owner receipt evidence with hash/diff guards',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-collect-before-review-browser.json','utf8'));assert.equal(e.status,'PASS');
 for(const name of ['collect-350','collect-1000','collect-resume','expiry-scrub','owned-explicit-selected-class-receipt'])assert.ok(e.checks.some(c=>c.name===name&&c.status==='PASS'));
 for(const [f,sha] of Object.entries(e.sourceHashes)){
  const historical=prior(f);assert.ok([hash(historical),hash(historical.toString().replaceAll('\n','\r\n'))].includes(sha),'historical LF/CRLF tested source '+f);
  if(!['run-controller.js','source-adapter.js'].some(n=>f===dir+n)&&f!=='src/views/class-import-center.js')assert.equal((await fs.readFile(f,'utf8')).replaceAll('\r\n','\n'),historical.toString(),'unchanged protected input '+f);
 }
 let controller=await fs.readFile(dir+'run-controller.js','utf8');controller=controller.split('\n').filter(l=>!l.includes('if(d.pager)')&&!l.includes('if(d.run&&diagnosticLines.length>=8)')&&!l.includes('if(page.diagnostic&&')).join('\n');assert.equal(controller,prior(dir+'run-controller.js').toString());
 const reader=await fs.readFile(dir+'source-adapter.js','utf8'),oldReader=prior(dir+'source-adapter.js').toString();assert.equal(reader.slice(0,reader.indexOf(' const {table,text:tsv')),oldReader.slice(0,oldReader.indexOf(' const {table,text:tsv')),'transport/guard/schema/row selection unchanged');
 for(const f of ['handoff-worker.js','handoff-protocol.js','categories.js','class-order.js','route-diagnostics.js','categories-popup.js'])assert.deepEqual(await fs.readFile(dir+f),prior(dir+f));
 const transport=JSON.parse(await fs.readFile('tests/n36-background-report-fetch-browser.json','utf8'));assert.equal(transport.status,'PASS');for(const f of ['handoff-worker.js','handoff-protocol.js','categories.js'])assert.equal(hash(await fs.readFile(dir+f)),transport.sourceHashes[f]);for(const f of ['src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js'])assert.equal(hash(await fs.readFile(f)),transport.appHashes[f]);
});
test('actual exported reader and application DOM/controller evidence binds current changed source',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-terminal-pager-evidence-browser.json','utf8'));assert.equal(e.status,'PASS');assert.deepEqual(e.errors,[]);assert.equal(e.runId,'0c942757-630e-4aa9-b7e8-46b112d8f7fe');
 for(const [f,sha] of Object.entries(e.sourceHashes))assert.equal(hash(await fs.readFile(dir+f)),sha);
 for(const name of ['actual-reader-before-after-observed-baseline-and-negative-privacy','controller-303-partial','controller-303-terminal'])assert.ok(e.checks.some(c=>c.name===name&&c.status==='PASS'));
 assert.match(e.cleanup,/closed/);
});
