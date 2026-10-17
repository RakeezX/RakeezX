// AI-authored: reuse accepted export/offline/security evidence by exact scope.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base='21ee4587c5e69be05720fd4818eb19a8f0e8f57f';
const old=f=>execFileSync('git',['show',base+':'+f],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const current=async f=>(await readFile(f,'utf8')).replace(/\r\n/g,'\n');
const part=(s,a,b)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start, a+' -> '+b);return s.slice(start,end);};
test('accepted export rendering/actions and N90 owner/capability/receipt protocol remain exact',async()=>{
 const f='src/views/class-import-center.js',view=await current(f),before=old(f);
 for(const [a,b]of [['<section aria-label="تصدير الكشوف">','</section>`}'],["    'koshoof-export'()",'function exportEntries()'],['function noorPane(', 'export default koshoofCenter;']])assert.equal(part(view,a,b),part(before,a,b));
 const store=await current('src/store.js');
 assert.equal(part(store,'export function reviewGradeImport(','export async function applyReviewedScoreDistribution('),part(old('src/store.js'),'export function reviewGradeImport(','export async function applyReviewedScoreDistribution('));
});
test('no new startup module, SW shell or accepted export/Noor/extension asset change',async()=>{
 for(const f of ['sw.js','src/lib/grade-transfer.js','src/lib/grade-transfer-parsers.js','src/lib/class-import-file.js','src/lib/class-koshoof-bundle.js','src/lib/grade-transfer-export.js','src/lib/grade-transfer-xlsx.js','src/styles/components.css'])assert.equal(await current(f),old(f));
 const imports=s=>[...s.matchAll(/^import .* from '([^']+)';$/gm)].map(m=>m[1]).sort();
 const f='src/views/class-import-center.js';
 assert.ok(imports(await current(f)).every(path=>imports(old(f)).includes(path)));
});
