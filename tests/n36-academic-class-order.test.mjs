// AI: bounded academic-order, coverage and exact package checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compareAcademicClasses as compare} from '../src/lib/class-order.js';
import {sourceClasses,selectedSourceClass,sourceCoverage} from '../extensions/rakeez-teacher-import-helper/source-roster.js';
import {GRADES} from '../src/models.js';
import {classGroups} from '../src/lib/class-import-file.js';
import {bundleNamesTargets} from '../src/lib/teacher-setup-import.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.6.manifest.json','utf8'));
 const names=[...old.files.map(f=>f.file),'class-order.js'].sort();
 // Normalize source bytes exactly as Git stores them before packaging on Windows.
 for(const file of names){if(/\.(?:js|css|html|json|md)$/.test(file)){const p=dir+file;await fs.writeFile(p,(await fs.readFile(p,'utf8')).replace(/\r\n/g,'\n'));}}
 await fs.writeFile('src/lib/class-order.js',(await fs.readFile('src/lib/class-order.js','utf8')).replace(/\r\n/g,'\n'));
 const files=await Promise.all(names.map(async file=>{const b=await fs.readFile(dir+file);return {file,sha256:hash(b),bytes:b.length};}));
 execFileSync('python',['-c',`import zipfile,pathlib,json; names=json.loads('${JSON.stringify(names)}'); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.7.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(zipfile.ZipInfo(n,(2026,10,17,0,0,0)),pathlib.Path('${dir}'+n).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)) for n in names]; z.close()`]);
 const file='rakeez-teacher-import-helper-0.5.7.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.7.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.7',applicationBaseSha:'1e265c9ac4552f9503ad2871c39c1ad19cd5d244',officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
export const expected=['خامس1','خامس2','خامس3','خامس4','خامس5','خامس6','خامس7','خامس8','سادس6','سادس7'];
export const shuffled=['سادس7','خامس8','خامس3','خامس1','سادس6','خامس7','خامس4','خامس2','خامس6','خامس5'];
export const counts=[28,28,29,28,30,28,29,31,34,35];
export const roster=shuffled.flatMap(classroom=>Array.from({length:counts[expected.indexOf(classroom)]},(_,i)=>({classroom,name:'طالب اصطناعي '+String.fromCharCode(0x621+Math.floor(i/20))+String.fromCharCode(0x621+i%20)})));
export const terminal=new Map([['synthetic',{total:2,pages:new Set([1,2]),terminal:true,gap:false}]]);
test('academic catalog, gender/article/hamza, all digit scripts and natural sections',()=>{
 assert.deepEqual([...shuffled].sort(compare),expected);
 assert.deepEqual([...GRADES].reverse().sort(compare).map(r=>r.v),GRADES.map(r=>r.v));
 const input=['الثاني الثانوي / ١٠','ثانية متوسط٢','سادس۱','أولى متوسط1','رابع٢','ثانية1','اولى1','خامس10','خامس۲','خامس١','اول ثانوي1'];
 assert.deepEqual(input.slice().sort(compare),['اولى1','ثانية1','رابع٢','خامس١','خامس۲','خامس10','سادس۱','أولى متوسط1','ثانية متوسط٢','اول ثانوي1','الثاني الثانوي / ١٠']);
 assert.equal(compare('خامس٢','الخامس 2'),0);
 // Unknown grade-like text stays fallback, never a grade-five alias.
 assert.ok(compare('سادس1','خامس مجهول1')<0);
 assert.equal(compare('فصل ٢','فصل 2'),0);
 const duplicate=['فصل ٢','فصل 2'];assert.deepEqual(duplicate.slice().sort(compare),duplicate);
});
test('300 actual source rows retain original labels, membership and within-class order after sort',()=>{
 assert.equal(roster.length,300);const before=structuredClone(roster);
 assert.deepEqual(sourceClasses(roster).map(r=>r.classroom),expected);
 for(const group of sourceClasses(roster))assert.deepEqual(selectedSourceClass(roster,group.classroom),roster.filter(r=>r.classroom===group.classroom));
 assert.deepEqual(roster,before);
 const variants=[{classroom:'خامس٢',name:'طالب أول'},{classroom:'خامس2',name:'طالب ثان'}];
 assert.deepEqual(sourceClasses(variants).map(r=>r.classroom),['خامس٢','خامس2']);assert.equal(sourceClasses(variants).length,2);
});
test('source-derived file creation groups and mapped owner target keep IDs and rows',()=>{
 const groups=classGroups([['grade','section','subject','name'],['6','7','علوم','طالب سادس'],['5','10','علوم','طالب عاشر'],['5','2','علوم','طالب ثاني']],{mapping:{grade:0,label:1,subject:2,name:3}});
 assert.deepEqual(groups.map(g=>[g.grade,g.label]),[[5,'2'],[5,'10'],[6,'7']]);
 assert.deepEqual(groups.map(g=>g.rows[0][0]),['طالب ثاني','طالب عاشر','طالب سادس']);
 const bundle={schema:'rakeez-private-teacher-setup',version:1,categories:[{category:'students',provenance:['pasted-visible'],rows:[{name:'طالب سادس',classroom:'سادس7'},{name:'طالب خامس',classroom:'خامس2'}]}]};
 const context={yearId:'y',termId:'t',years:[{id:'y',status:'active'}],terms:[{id:'t',yearId:'y',status:'active'}],classes:[{id:'s6',name:'سادس7'},{id:'s5',name:'خامس2'}],subjects:[],teachings:[{id:'t6',sectionId:'s6',termId:'t'},{id:'t5',sectionId:'s5',termId:'t'}],students:[],enrollments:[]};
 const mappings={classes:{'سادس7':'s6','خامس2':'s5'},subjects:{}};
 assert.deepEqual(bundleNamesTargets(bundle,new Set(['students']),context,mappings).map(t=>[t.id,t.sectionId,t.rows]),[['t5','s5',[['طالب خامس']]],['t6','s6',[['طالب سادس']]]]);
});
test('pause, real failures, terminal with optional tasks, gap and unknown are distinct without a count cap',()=>{
 const paused=sourceCoverage({series:new Map(),pendingReportPages:1,reviewWindow:true});assert.equal(paused.coverage,'paused');assert.equal(paused.complete,false);
 for(const code of ['REPORT_FETCH_FAILED','SOURCE_SCHEMA'])assert.equal(sourceCoverage({series:terminal,warnings:[{category:'students',code}]}).coverage,'partial');
 assert.equal(sourceCoverage({series:terminal,reviewWindow:true,warnings:[{category:'students',code:'ROSTER_LINKS_UNAVAILABLE',optional:true}]}).complete,true);
 assert.equal(sourceCoverage({series:new Map(),warnings:[{category:'students',optional:true}]}).complete,false);
 assert.equal(sourceCoverage({series:terminal,pendingReportPages:1,reviewWindow:true}).complete,false);
 for(const series of [new Map(),new Map([['s',{total:null,pages:new Set([1]),terminal:false}]]),new Map([['s',{total:3,pages:new Set([1,3]),terminal:true}]])])assert.equal(sourceCoverage({series}).complete,false);
 assert.equal(sourceCoverage({series:new Map([['s',{...terminal.get('synthetic'),gap:true}]])}).coverage,'partial');
 assert.equal(sourceCoverage({series:new Map([['s',{total:2,pages:new Set([2]),terminal:true}]])}).coverage,'partial');
 assert.equal(sourceCoverage({series:new Map([['s',{total:2,pages:new Set([1,2]),terminal:false}]])}).coverage,'partial');
 assert.equal(sourceCoverage({series:new Map([['s',{total:null,pages:new Set([1]),terminal:false}]])}).coverage,'unknown');
});
test('0.5.7 source/ZIP binding, unchanged network guards and offline dependency',async()=>{
 assert.deepEqual(await fs.readFile('src/lib/class-order.js'),await fs.readFile(dir+'class-order.js'));
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.7.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);assert.equal(hash(b),m.archive.sha256);
 assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
 assert.equal(JSON.parse(Buffer.from(zip['manifest.json'])).version,'0.5.7');
 const old=unzipSync(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.6.zip'));
 for(const f of ['source-adapter.js','navigation.js','handoff-protocol.js','handoff-worker.js','selection.js','categories.js'])assert.deepEqual(zip[f],old[f],f+' unchanged safeguards/transport');
 for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-0.5.6.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show','1e265c9ac4552f9503ad2871c39c1ad19cd5d244:'+p]));}
 assert.ok((await fs.readFile('sw.js','utf8')).includes("'./src/lib/class-order.js'"));
 assert.equal((await fs.readFile('src/views/class-import-center.js','utf8')).includes('helper-0.5.7.zip'),true);
});

if(process.env.N36_BROWSER_PROOF==='1')test('final browser proof binds the actual affected app/controller source and released resources',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-academic-class-order-browser.json','utf8'));
 assert.equal(e.status,'PASS');assert.equal(e.runId,'f8b69a07-fc03-4447-8dd9-dbb3e06a0b1b');
 for(const [file,sha] of Object.entries(e.sourceHashes))assert.equal(hash(await fs.readFile(file)),sha,file);
 for(const name of ['controller-paused','controller-network','controller-schema','proved-terminal-300-with-optional-task','unproved-unknown','unproved-gap','actual-account-class-list-import-options-and-mapping','expired-lease-ui-entry-rejected','foreign-owner-ui-entry-rejected','actual-service-worker-offline-shell'])assert.ok(e.checks.some(c=>c.name===name&&c.status==='PASS'),name);
 assert.equal(e.offlineRelease,'RELEASED browser');assert.deepEqual(e.errors,[]);
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.7.manifest.json','utf8'));assert.equal(e.archiveSha256,m.archive.sha256);
});
