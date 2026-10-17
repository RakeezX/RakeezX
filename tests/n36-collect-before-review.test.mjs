// AI: bounded source vs transport, immutable package identity and reused receiver proof.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {appendSourceRows,sourceClasses,selectedSourceClass,sourceCoverage} from '../extensions/rakeez-teacher-import-helper/source-roster.js';
import {validateCategory} from '../extensions/rakeez-teacher-import-helper/categories.js';
import {validateHandoff} from '../extensions/rakeez-teacher-import-helper/handoff-protocol.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',base='b2604781812dd092841a1b20feda2288296d7c0e',hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.7.manifest.json','utf8')),names=old.files.map(f=>f.file).sort();
 for(const name of names)if(/\.(js|css|html|json|md)$/.test(name))await fs.writeFile(dir+name,(await fs.readFile(dir+name,'utf8')).replace(/\r\n/g,'\n'));
 const files=await Promise.all(names.map(async file=>{const b=await fs.readFile(dir+file);return {file,sha256:hash(b),bytes:b.length};}));
 execFileSync('python',['-c',`import zipfile,pathlib,json; names=json.loads('${JSON.stringify(names)}'); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.8.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(zipfile.ZipInfo(n,(2026,10,17,0,0,0)),pathlib.Path('${dir}'+n).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)) for n in names]; z.close()`]);
 const file='rakeez-teacher-import-helper-0.5.8.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.8.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.8',applicationBaseSha:base,officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
test('accumulation retains all class identities while each transfer remains at most 300',()=>{
 const rows=Array.from({length:1000},(_,i)=>({name:'طالب '+String.fromCharCode(0x621+Math.floor(i/28))+String.fromCharCode(0x621+i%28),classroom:'خامس'+(i%30+1)}));
 let all=[];for(let n=0;n<1000;n+=50)all=appendSourceRows(all,rows.slice(n,n+50));assert.deepEqual(all,rows);assert.equal(sourceClasses(all).length,30);
 assert.throws(()=>appendSourceRows(all,[rows[0]]),/DUPLICATE/);
 const one=rows.slice(0,350).map(r=>({...r,classroom:'خامس1'}));assert.equal(selectedSourceClass(one,'خامس1').length,300);assert.equal(selectedSourceClass(one,'خامس1',300).length,50);
 assert.throws(()=>validateCategory('students',one),/LIMIT/);
 assert.throws(()=>validateHandoff({schema:'rakeez-extension-names',version:1,source:'madrasati',scope:'reviewed-run',createdAt:Date.now(),expiresAt:Date.now()+120000,rows:one}),/LIMIT/);
});
test('only proved contiguous terminal can be complete; resource bytes and optional tasks stay truthful',()=>{
 const series=new Map([['s',{total:6,pages:new Set([1,2,3,4,5,6]),terminal:true,gap:false}]]);
 assert.equal(sourceCoverage({series}).complete,true);assert.equal(sourceCoverage({series,warnings:[{category:'students',optional:true,code:'ROSTER_LINKS_UNAVAILABLE'}]}).complete,true);
 assert.equal(sourceCoverage({series,warnings:[{category:'students',code:'SOURCE_MEMORY_BUDGET'}]}).coverage,'partial');assert.equal(sourceCoverage({series,pendingReportPages:1}).hasNextReport,true);
 series.get('s').pages.delete(2);assert.equal(sourceCoverage({series}).complete,false);
 assert.equal(sourceCoverage({series:new Map()}).coverage,'unknown');
});
test('0.5.8 ZIP binds exact source and preserves permissions, accepted comparator and older packages',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.8.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);assert.equal(hash(b),m.archive.sha256);assert.equal(b.length,m.archive.bytes);assert.equal(m.applicationBaseSha,base);
 assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());for(const f of m.files){assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));assert.equal(hash(zip[f.file]),f.sha256);assert.equal(zip[f.file].length,f.bytes);}
 const manifest=JSON.parse(Buffer.from(zip['manifest.json']));assert.equal(manifest.version,'0.5.8');const oldManifest=JSON.parse(execFileSync('git',['show',base+':'+dir+'manifest.json']));delete manifest.version;delete oldManifest.version;assert.deepEqual(manifest,oldManifest);
 for(const f of ['class-order.js','categories.js','handoff-worker.js','handoff-protocol.js','selection.js','route-diagnostics.js'])assert.deepEqual(await fs.readFile(dir+f),execFileSync('git',['show',base+':'+dir+f]),f);
 for(const v of ['0.5.3','0.5.4','0.5.5','0.5.6','0.5.7'])for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-'+v+'.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show',base+':'+p]));}
 assert.ok((await fs.readFile('src/views/class-import-center.js','utf8')).includes('helper-0.5.8.zip'));
});
test('prior encrypted/one-time and failed/unknown/repeated receiver proof is reused only for unchanged protected inputs',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-background-report-fetch-browser.json','utf8'));assert.equal(e.status,'PASS');
 for(const f of ['handoff-worker.js','handoff-protocol.js','categories.js'])assert.equal(hash(await fs.readFile(dir+f)),e.sourceHashes[f]);
 for(const f of ['src/lib/n36-extension-handoff.js','src/lib/n36-extension-protocol.js'])assert.equal(hash(await fs.readFile(f)),e.appHashes[f]);
 const view='src/views/teacher-setup-import.js',oldView=execFileSync('git',['show','1e265c9ac4552f9503ad2871c39c1ad19cd5d244:'+view]).toString();assert.equal(hash(oldView),e.appHashes[view]);
 const currentView=await fs.readFile(view,'utf8'),academic=JSON.parse(await fs.readFile('tests/n36-academic-class-order-browser.json','utf8'));assert.equal(hash(currentView),academic.sourceHashes[view]);
 // The 0.5.7 change is only imports and class-option ordering; receipt/write bodies remain byte-identical.
 const normalized=currentView.replace("import { compareAcademicClasses } from '../lib/class-order.js';\n",'').replace("import { isDemo } from '../lib/demo.js';\n",'').replace('.sort((a,b) => Number(isDemo(a))-Number(isDemo(b)) || compareAcademicClasses(a,b))','').replace('.sort(compareAcademicClasses)','');assert.equal(normalized,oldView);
 for(const name of ['retry','lostReceipt'])assert.ok(e.scenarios.some(s=>s.scenario===name));
 const receiptLoop=s=>s.slice(s.indexOf('setInterval(async()=>{')).replace(/\r\n/g,'\n');
 const current=(await fs.readFile(dir+'categories-popup.js','utf8')).replace(/\r\n/g,'\n'),prior=execFileSync('git',['show',base+':'+dir+'categories-popup.js']).toString();assert.equal(receiptLoop(current),receiptLoop(prior));
 const before=prior.slice(prior.indexOf("$('handoff-transfer').addEventListener"),prior.indexOf("$('handoff-cancel').addEventListener"));assert.ok(current.includes(before));
});
if(process.env.N36_BROWSER_PROOF==='1')test('focused actual DOM/controller/reader evidence binds current source with owned cleanup',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-collect-before-review-browser.json','utf8'));assert.equal(e.status,'PASS');assert.equal(e.runId,'77757f26-80d2-4392-9609-0dd419355bbc');assert.deepEqual(e.errors,[]);
 for(const [f,sha] of Object.entries(e.sourceHashes))assert.equal(hash(await fs.readFile(f)),sha,f);
 for(const name of ['collect-350','collect-1000','collect-resume','collect-request-resume','collect-network','collect-oversized','collect-memory','collect-unknown','collect-gap','collect-terminal300','collect-optional','owned-explicit-selected-class-receipt','inflightcancel-scrub','cancel-scrub','expiry-scrub','context-scrub','unsafe-scrub'])assert.ok(e.checks.some(c=>c.name===name&&c.status==='PASS'),name);
 for(const n of e.sourceNormalization??[]){const b=await fs.readFile(n.file,'utf8');assert.equal(hash(b.replace(/\n/g,'\r\n')),n.testedSha256);assert.equal(hash(b),n.finalSha256);}
 assert.equal(e.archiveSha256,JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.8.manifest.json','utf8')).archive.sha256);
 assert.match(e.cleanup,/closed/);
});
