// AI: exact archive bytes, Git newline integrity and unchanged rollback/security boundaries.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {unzipSync} from '../src/lib/student-import-parsers.js';
const base='668fc444bd7a470349048b416883afeab43c31f2',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package')){
 const old=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.1.manifest.json','utf8'));
 execFileSync('python',['-c',`import zipfile,json,pathlib; m=json.loads(pathlib.Path('${assets}rakeez-teacher-import-helper-0.5.1.manifest.json').read_text()); z=zipfile.ZipFile('${assets}rakeez-teacher-import-helper-0.5.2.zip','w',zipfile.ZIP_DEFLATED); [(z.writestr(f['file'],pathlib.Path('${dir}'+f['file']).read_bytes())) for f in m['files']]; z.close()`]);
 const files=await Promise.all(old.files.map(async f=>{const b=await fs.readFile(dir+f.file);return {file:f.file,sha256:hash(b),bytes:b.length};}));
 const file='rakeez-teacher-import-helper-0.5.2.zip',b=await fs.readFile(assets+file);
 await fs.writeFile(assets+'rakeez-teacher-import-helper-0.5.2.manifest.json',JSON.stringify({schema:old.schema,version:'0.5.2',applicationBaseSha:base,officialAccountVerification:'NOT_RUN',files,archive:{file,sha256:hash(b),bytes:b.length}},null,2)+'\n');
}
test('0.5.2 exact ZIP fileset, hashes, checkout bytes and Git LF/CRLF integrity',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.2.manifest.json','utf8'));const b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);
 assert.equal(hash(b),m.archive.sha256);assert.equal(b.length,m.archive.bytes);assert.equal(m.applicationBaseSha,base);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){const data=Buffer.from(zip[f.file]),checkout=await fs.readFile(dir+f.file);assert.equal(hash(data),f.sha256);assert.equal(data.length,f.bytes);assert.deepEqual(data,checkout);const git=execFileSync('git',['hash-object','--path='+dir+f.file,'--stdin'],{input:checkout,encoding:'utf8'}).trim();const canonical=Buffer.from(checkout.toString().replace(/\r\n/g,'\n'));assert.equal(git,execFileSync('git',['hash-object','--stdin'],{input:canonical,encoding:'utf8'}).trim());}
 assert.equal(JSON.parse(Buffer.from(zip['manifest.json'])).version,'0.5.2');
});
test('0.5.1 rollback archive and manifest untouched; no widened permissions or portal/navigation/protocol changes',async()=>{
 for(const f of ['rakeez-teacher-import-helper-0.5.1.zip','rakeez-teacher-import-helper-0.5.1.manifest.json'])assert.deepEqual(await fs.readFile(assets+f),execFileSync('git',['show',base+':'+assets+f]));
 for(const f of ['selection.js','source-adapter.js','navigation.js','route-diagnostics.js','handoff-worker.js','handoff-protocol.js'])assert.equal((await fs.readFile(dir+f,'utf8')).replace(/\r\n/g,'\n'),execFileSync('git',['show',base+':'+dir+f],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
 const m=JSON.parse(await fs.readFile(dir+'manifest.json','utf8')),old=JSON.parse(execFileSync('git',['show',base+':'+dir+'manifest.json'],{encoding:'utf8'}));m.version=old.version;assert.deepEqual(m,old);
 const {RUN_LIMITS}=await import('../extensions/rakeez-teacher-import-helper/navigation.js');const {HANDOFF_TTL}=await import('../extensions/rakeez-teacher-import-helper/handoff-protocol.js');assert.equal(RUN_LIMITS.reviewMilliseconds,300000);assert.equal(HANDOFF_TTL,120000);
});
test('student consequence dedup retains independent student/category failures',async()=>{
 const s=await fs.readFile(dir+'run-controller.js','utf8');const expression=s.match(/const displayWarnings=(warnings\.filter\(.*\));/)[1];
 const warnings=[{category:'students',code:'ROSTER_LINKS_UNAVAILABLE'},{category:'students',code:'EMPTY_OR_LIMIT'},{category:'students',code:'PAGINATION_INCOMPLETE'},{category:'school',code:'EMPTY_OR_LIMIT'}];
 const filtered=Function('warnings','return '+expression)(warnings);assert.deepEqual(filtered,[warnings[0],warnings[2],warnings[3]]);assert.deepEqual(Function('warnings','return '+expression)([warnings[1]]),[warnings[1]]);
});

test('one Koshoof download entry targets verified 0.5.2; guarded access entry unchanged',async()=>{const s=await fs.readFile('src/views/class-import-center.js','utf8');assert.equal((s.match(/href="\/assets\/extensions\/rakeez-teacher-import-helper-0.5.2.zip"/g)||[]).length,1);assert.ok(s.includes('تنزيل الإضافة الخاصة 0.5.2'));assert.ok(!s.includes('0.5.1'));});
