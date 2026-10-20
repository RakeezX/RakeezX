// AI: exact staged source/package identity and bounded scope, no runtime mutation.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const folder='tests/n36-actual-1430-20261020/',base='fdd9ad563996b6126d89a73860f46cf00e62c15a';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),base);
const manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.18.manifest.json','utf8'));
for(const f of manifest.files){const bytes=execFileSync('git',['show',':extensions/rakeez-teacher-import-helper/'+f.file]);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.file+' staged Git/ZIP bytes');}
const changed=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim().split(/\r?\n/);
const exact=new Set(['src/store.js','src/views/class-import-center.js','src/lib/teacher-setup-import.js','src/lib/education-department-directory.js','src/lib/n36-extension-handoff.js','docs/automation-evidence/20261020/N36_SOURCE_PROFILE_CLEAR_RESULTS.md']);
assert.ok(changed.every(p=>exact.has(p)||p.startsWith('extensions/rakeez-teacher-import-helper/')||p.startsWith('assets/extensions/rakeez-teacher-import-helper-0.5.18.')||p.startsWith(folder)));
for(const file of ['browser.json','edges.json','package.json'])assert.equal(JSON.parse(await fs.readFile(folder+file,'utf8')).status,'PASS',file);
const text=await fs.readFile('extensions/rakeez-teacher-import-helper/categories-popup.js','utf8');assert.ok(text.includes('لم يتأكد اكتمال الحفظ محليًا'));assert.ok(text.includes('حُفظ المتاح محليًا'));assert.ok(text.includes('fieldResults:'));
execFileSync('git',['diff','--cached','--check']);
const result={status:'PASS',baseSha:base,runtimeFiles:manifest.files.length,archiveSha256:manifest.archive.sha256,checks:['25 staged Git blobs exactly equal immutable ZIP manifest hashes','All staged paths inside activated scope','Existing browser/edge/package PASS evidence reconciled','Last copy delta scoped assertion; staged whitespace clean'],changedPaths:changed};
await fs.writeFile(folder+'git-candidate.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
