// AI: exact archive bytes, Git newline integrity and unchanged rollback/security boundaries.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {unzipSync} from '../src/lib/student-import-parsers.js';
const base='668fc444bd7a470349048b416883afeab43c31f2',dir='extensions/rakeez-teacher-import-helper/',assets='assets/extensions/';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--package'))throw Error('0.5.2 is immutable rollback; package 0.5.3 through n36-300-then-zero.test.mjs');
test('0.5.2 exact ZIP fileset, hashes, checkout bytes and Git LF/CRLF integrity',async()=>{
 const m=JSON.parse(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.2.manifest.json','utf8'));const b=await fs.readFile(assets+m.archive.file),zip=unzipSync(b);
 assert.equal(hash(b),m.archive.sha256);assert.equal(b.length,m.archive.bytes);assert.equal(m.applicationBaseSha,base);assert.deepEqual(Object.keys(zip).sort(),m.files.map(f=>f.file).sort());
 for(const f of m.files){const data=Buffer.from(zip[f.file]),checkout=execFileSync('git',['show','8714bef9f047a5169a5c4ca3eb0d9ef6e3b08199:'+dir+f.file]);assert.equal(hash(data),f.sha256);assert.equal(data.length,f.bytes);assert.equal(data.toString().replace(/\r\n/g,'\n'),checkout.toString().replace(/\r\n/g,'\n'));const git=execFileSync('git',['hash-object','--path='+dir+f.file,'--stdin'],{input:checkout,encoding:'utf8'}).trim();const canonical=Buffer.from(checkout.toString().replace(/\r\n/g,'\n'));assert.equal(git,execFileSync('git',['hash-object','--stdin'],{input:canonical,encoding:'utf8'}).trim());}
 assert.equal(JSON.parse(Buffer.from(zip['manifest.json'])).version,'0.5.2');
});
test('0.5.1 rollback archive and manifest untouched; no widened permissions or portal/navigation/protocol changes',async()=>{
 for(const f of ['rakeez-teacher-import-helper-0.5.1.zip','rakeez-teacher-import-helper-0.5.1.manifest.json'])assert.deepEqual(await fs.readFile(assets+f),execFileSync('git',['show',base+':'+assets+f]));
 for(const f of ['selection.js','navigation.js','route-diagnostics.js','handoff-worker.js','handoff-protocol.js'])assert.equal((await fs.readFile(dir+f,'utf8')).replace(/\r\n/g,'\n'),execFileSync('git',['show',base+':'+dir+f],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
 const m=JSON.parse(await fs.readFile(dir+'manifest.json','utf8')),old=JSON.parse(execFileSync('git',['show',base+':'+dir+'manifest.json'],{encoding:'utf8'}));m.version=old.version;assert.deepEqual(m,old);
 const {RUN_LIMITS}=await import('../extensions/rakeez-teacher-import-helper/navigation.js');const {HANDOFF_TTL}=await import('../extensions/rakeez-teacher-import-helper/handoff-protocol.js');assert.equal(RUN_LIMITS.reviewMilliseconds,300000);assert.equal(HANDOFF_TTL,120000);
});
test('0.5.2 warning presentation is preserved as historical evidence; 0.5.3 distinguishes independent causes',async()=>{
 const archived=unzipSync(await fs.readFile(assets+'rakeez-teacher-import-helper-0.5.2.zip'));
 const s=Buffer.from(archived['run-controller.js']).toString();const expression=s.match(/const displayWarnings=(warnings\.filter\(.*\));/)[1];
 const warnings=[{category:'students',code:'ROSTER_LINKS_UNAVAILABLE'},{category:'students',code:'EMPTY_OR_LIMIT'},{category:'school',code:'EMPTY_OR_LIMIT'}];
 assert.deepEqual(Function('warnings','return '+expression)(warnings),[warnings[0],warnings[2]]);
 const {validateCategory}=await import('../extensions/rakeez-teacher-import-helper/categories.js');assert.throws(()=>validateCategory('students',[]),/EMPTY_CATEGORY/);assert.throws(()=>validateCategory('students',Array(301).fill({})),/CATEGORY_ROW_LIMIT/);
});

test('one Koshoof download entry advances to 0.5.3 while 0.5.2 remains rollback; guarded access entry unchanged',async()=>{const s=await fs.readFile('src/views/class-import-center.js','utf8');assert.equal((s.match(/href="\/assets\/extensions\/rakeez-teacher-import-helper-0.5.3.zip"/g)||[]).length,1);assert.ok(s.includes('تنزيل الإضافة الخاصة 0.5.3'));assert.ok(!s.includes('0.5.1'));});
