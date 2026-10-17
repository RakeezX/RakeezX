// AI: source windows, transport limits and exact versioned package identity.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {appendSourceRows,sourceClasses,selectedSourceClass,reportsComplete} from '../extensions/rakeez-teacher-import-helper/source-roster.js';
import {validateHandoff,HANDOFF_TTL} from '../extensions/rakeez-teacher-import-helper/handoff-protocol.js';
import {unzipSync} from '../src/lib/student-import-parsers.js';
const dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/',hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.4.manifest.json','utf8'));
 const names=old.files.map(f=>f.file).sort();
 for(const name of names){const p=dir+name;if(/\.(js|css|html|json)$/.test(name))await fs.writeFile(p,(await fs.readFile(p,'utf8')).replace(/\r\n/g,'\n'));}
 const files=await Promise.all(names.map(async file=>{const b=await fs.readFile(dir+file);return {file,sha256:hash(b),bytes:b.length};}));
 // Fixed ZIP timestamps and source bytes; no package overwrites of previous versions.
 execFileSync('python',['-c',`import zipfile,pathlib,json; names=json.loads('${JSON.stringify(names)}'); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.5.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(zipfile.ZipInfo(n,(2026,10,17,0,0,0)),pathlib.Path('${dir}'+n).read_bytes(),compress_type=zipfile.ZIP_DEFLATED)) for n in names]; z.close()`]);
 const file='rakeez-teacher-import-helper-0.5.5.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.5.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.5',applicationBaseSha:'eda13b5ec13266d8b0ca114dd7666bad9c87db6e',officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
const alphabet='ابتثجحخدذرزسشصضطظعغفقكلمنهوي',word=n=>[Math.floor(n/(alphabet.length**2)),Math.floor(n/alphabet.length)%alphabet.length,n%alphabet.length].map(i=>alphabet[i]).join('');
const rows=n=>Array.from({length:n},(_,i)=>({name:'طالب اصطناعي '+word(i),classroom:'فصل '+Math.floor(i/Math.ceil(n/2))}));
test('50/299/300/301/303/350/1000/1251 have no product total gate; exact class batches preserve ordered tail',()=>{
 for(const n of [50,299,300,301,303,350,1000,1251]){
  const r=appendSourceRows([],rows(n));assert.equal(r.length,n);
  for(const c of sourceClasses(r)){const actual=[];for(let offset=0;offset<c.count;offset+=300)actual.push(...selectedSourceClass(r,c.classroom,offset));assert.deepEqual(actual,r.filter(r=>r.classroom===c.classroom));}
  const one=r.map(r=>({...r,classroom:'فصل واحد'}));const all=[];for(let offset=0;offset<n;offset+=300)all.push(...selectedSourceClass(one,'فصل واحد',offset));assert.deepEqual(all,one);
 }
});
test('row identity and transport safety survive source windowing',()=>{
 const [r]=rows(1);assert.throws(()=>appendSourceRows([r],[r]),/DUPLICATE/);assert.throws(()=>appendSourceRows([r],[{...r,classroom:'فـصل 0'}]),/AMBIGUOUS/);
 for(const row of [{...r,name:'طالب 123'},{...r,classroom:''},{...r,name:'<script>'}])assert.throws(()=>appendSourceRows([],[row]));
 const now=Date.now(),e={schema:'rakeez-extension-names',version:1,source:'madrasati',scope:'reviewed-run',createdAt:now,expiresAt:now+HANDOFF_TTL,rows:rows(300)};
 assert.equal(validateHandoff(e).rows.length,300);assert.throws(()=>validateHandoff({...e,rows:rows(301)}));assert.throws(()=>validateHandoff(e,now+HANDOFF_TTL));
 assert.throws(()=>selectedSourceClass(rows(1),'فصل 0',-1));
});
test('coverage never inferred from names, counts, missing pages or unknown terminal',()=>{
 const s={total:40,last:40,terminal:true,gap:false};assert.equal(reportsComplete(new Map([['report',s]])),true);
 for(const bad of [{...s,terminal:false},{...s,gap:true},{...s,last:39},{...s,total:null}])assert.equal(reportsComplete(new Map([['report',bad]])),false);
 assert.equal(reportsComplete(new Map()),false);
});
test('0.5.5 bytes bind every source file and archive; old packages unchanged',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.5.manifest.json','utf8')),b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);assert.equal(hash(b),m.archive.sha256);
 assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){assert.equal(hash(zip[f.file]),f.sha256);assert.deepEqual(Buffer.from(zip[f.file]),await fs.readFile(dir+f.file));}
 assert.equal(JSON.parse(Buffer.from(zip['manifest.json'])).version,'0.5.5');
 for(const version of ['0.5.3','0.5.4'])for(const ext of ['zip','manifest.json']){const p=assets+'rakeez-teacher-import-helper-'+version+'.'+ext;assert.deepEqual(await fs.readFile(p),execFileSync('git',['show','eda13b5ec13266d8b0ca114dd7666bad9c87db6e:'+p]));}
});

if(process.env.N36_BROWSER_PROOF==='1')test('final synthetic MV3/application proof binds the candidate bytes, required cases and resource release',async()=>{
 const e=JSON.parse(await fs.readFile('tests/n36-partial-class-import-no-total-cap-browser.json','utf8'));
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.5.manifest.json','utf8'));
 assert.equal(e.status,'PASS');assert.equal(e.archiveSha256,m.archive.sha256);
 assert.equal(e.runId,'f6a46781-46ef-419d-ba71-457ab0ba7c2f');
 for(const name of ['full50','full299','full300','full301','full303','full350','full1000','full1251','single350','single1251','nonterminal','missingLast','missingMiddle','duplicate','invalid','hidden','unsafe','missingReport','schoolChanged','roleChanged','originChanged','sessionChanged','owner','lease','expiry','retry','lostReceipt','sourceClosed'])assert.ok(e.scenarios.some(s=>s.scenario===name),name);
 for(const [file,sha] of Object.entries(e.sourceHashes))assert.equal(m.files.find(f=>f.file===file)?.sha256,sha,file);
 for(const [file,sha] of Object.entries(e.appHashes))assert.equal(hash(await fs.readFile(file)),sha,file);
 assert.deepEqual(e.externalRequests,[]);assert.deepEqual(e.errors,[]);assert.equal(e.release,'RELEASED browser');
});
