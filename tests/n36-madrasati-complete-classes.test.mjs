// AI: exact source/package and review-vs-transport boundary checks.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {appendSourceRows,sourceClasses,selectedSourceClass,reportsComplete} from '../extensions/rakeez-teacher-import-helper/source-roster.js';
import {validateCategory} from '../extensions/rakeez-teacher-import-helper/categories.js';
import {validateHandoff,HANDOFF_TTL} from '../extensions/rakeez-teacher-import-helper/handoff-protocol.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',base='6ed9ab3c79f5d2a8767002edb9f58411f79fb305',hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.3.manifest.json','utf8'));
 const names=[...old.files.map(f=>f.file),'source-roster.js'].sort();
 // Canonical LF bytes are stable across checkout autocrlf and match Git source.
 for(const name of names){const p=dir+name,b=await fs.readFile(p);if(!['.js','.css','.html','.json'].some(ext=>name.endsWith(ext)))continue;await fs.writeFile(p,b.toString('utf8').replace(/\r\n/g,'\n'));}
 const files=await Promise.all(names.map(async file=>{const b=await fs.readFile(dir+file);return {file,sha256:hash(b),bytes:b.length};}));
 execFileSync('python',['-c',`import zipfile,pathlib,json; names=json.loads('${JSON.stringify(names)}'); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.4.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(n,pathlib.Path('${dir}'+n).read_bytes())) for n in names]; z.close()`]);
 const file='rakeez-teacher-import-helper-0.5.4.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.4.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.4',applicationBaseSha:base,officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
const alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي',word=n=>[Math.floor(n/(alphabet.length**2)),Math.floor(n/alphabet.length)%alphabet.length,n%alphabet.length].map(i=>alphabet[i]).join('');
const rows=n=>Array.from({length:n},(_,i)=>({name:'طالب اصطناعي '+word(i),classroom:'فصل '+Math.floor(i/300)}));
test('full review retains 303/350/600/601/1200; only one <=300 class batch materializes (PO partial decision supersedes total cap)',()=>{
 for(const n of [303,350,600,601,1200]){let r=[];for(let i=0;i<n;i+=50)r=appendSourceRows(r,rows(n).slice(i,i+50));assert.equal(r.length,n);assert.equal(sourceClasses(r).reduce((sum,c)=>sum+c.count,0),n);assert.equal(selectedSourceClass(r,'فصل 0').length,300);}
 assert.equal(appendSourceRows(rows(1200),rows(1201).slice(1200)).length,1201);
 const oversized=rows(301).map(r=>({...r,classroom:'فصل واحد'}));assert.equal(sourceClasses(oversized)[0].available,true);assert.equal(selectedSourceClass(oversized,'فصل واحد').length,300);assert.equal(selectedSourceClass(oversized,'فصل واحد',300).length,1);
 assert.throws(()=>validateCategory('students',rows(301)),/CATEGORY_ROW_LIMIT/);
 const now=Date.now();assert.throws(()=>validateHandoff({schema:'rakeez-extension-names',version:1,source:'madrasati',scope:'reviewed-run',createdAt:now,expiresAt:now+HANDOFF_TTL,rows:rows(301)}));
});
test('same name across exact different classrooms allowed; duplicates and classroom aliases denied',()=>{
 const [r]=rows(1);assert.equal(appendSourceRows([r],[{...r,classroom:'فصل آخر'}]).length,2);
 assert.throws(()=>appendSourceRows([r],[r]),/DUPLICATE/);assert.throws(()=>appendSourceRows([r],[{...r,classroom:'فـصل 0'}]),/AMBIGUOUS_CLASSROOM/);
});
test('all pages plus terminal required, never infer from names or counts',()=>{
 const s={total:3,terminal:true,pages:new Set([1,2,3])};assert.equal(reportsComplete(new Map([['a',s]])),true);
 for(const v of [{...s,terminal:false},{...s,total:null},{...s,pages:new Set([1,3])}])assert.equal(reportsComplete(new Map([['a',v]])),false);
 assert.equal(reportsComplete(new Map()),false);
});
test('reuse immutable 0.5.3 actual MV3 reproduction of two independent failures',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-300-then-zero-browser.json','utf8'));assert.equal(e.status,'PASS');
 const zip=unzipSync(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.3.zip'));
 for(const [file,sha] of Object.entries(e.runtimeHashes))assert.equal(hash(zip[file]),sha);
 assert.match(e.reusedPartial.diagnostic,/staged=300.*complete=0.*ROSTER_LINKS_UNAVAILABLE/);
 assert.ok(e.scenarios.some(s=>s.scenario==='overflow350'&&s.diagnostic.includes('CATEGORY_ROW_LIMIT')));
 assert.ok(e.scenarios.some(s=>s.scenario==='full300'&&s.transferAllowed));
});
test('immutable 0.5.4 package matches its recorded Git source bytes; rollback and route/receiver guards unchanged',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.4.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);assert.equal(hash(b),m.archive.sha256);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),execFileSync('git',['show','eda13b5ec13266d8b0ca114dd7666bad9c87db6e:'+dir+f.file]));}
 for(const v of ['0.5.1','0.5.3'])for(const ext of ['zip','manifest.json']){const f=assets+'rakeez-teacher-import-helper-'+v+'.'+ext;assert.deepEqual(await fs.readFile(f),execFileSync('git',['show',base+':'+f]));}
 for(const f of ['navigation.js','route-diagnostics.js','categories.js','selection.js','handoff-protocol.js'])assert.equal((await fs.readFile(dir+f,'utf8')).replace(/\r\n/g,'\n'),execFileSync('git',['show',base+':'+dir+f],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
 const manifest=JSON.parse(Buffer.from(zip['manifest.json'])),old=JSON.parse(execFileSync('git',['show',base+':'+dir+'manifest.json']));assert.equal(manifest.version,'0.5.4');manifest.version=old.version;assert.deepEqual(manifest,old);
});
test('installed MV3 evidence binds all runtime bytes and 26 affected actual app/source cases',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-madrasati-complete-classes-browser.json','utf8'));
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.4.manifest.json','utf8'));
 assert.equal(e.runId,'b249261d-12d5-4295-895f-284258f16903');assert.equal(e.status,'PASS');assert.equal(e.archiveSha256,m.archive.sha256);
 for(const [file,sha] of Object.entries(e.sourceHashes))assert.equal(m.files.find(f=>f.file===file).sha256,sha,file);
 const cases=['full301','full303','full350','full600','full601','full1200','full1201','class301','sameNames','nonterminal','missingLast','missingMiddle','repeat','duplicate','drift','missingReport','schoolChanged','roleChanged','sourceClosed','windowClosed','cancelled','alarmExpired','corrupt','originChanged','sessionChanged','multi303'];
 assert.deepEqual(e.scenarios.map(s=>s.scenario).sort(),cases.sort());
 assert.deepEqual(e.ownerPreview,{rows:300,committed:0,ownerSwitchInvalidates:true,databaseUnchanged:true});assert.match(e.secondClass,/50 exact rows/);assert.match(e.expiry,/300000ms/);
 assert.match(e.scenarios.find(s=>s.scenario==='full1201').diagnostic,/observedRowsLowerBound=50.*complete=0/);
 for(const name of ['full301','full303','full350','full600','full601','full1200','multi303'])assert.doesNotMatch(e.scenarios.find(s=>s.scenario===name).diagnostic,/ROSTER_LINKS_UNAVAILABLE/);
 assert.match(e.scenarios.find(s=>s.scenario==='missingReport').diagnostic,/ROSTER_LINKS_UNAVAILABLE/);
 assert.deepEqual(e.externalRequests,[]);assert.deepEqual(e.errors,[]);assert.equal(e.release,'RELEASED browser');assert.ok(e.priorFailures.length>0);
});
