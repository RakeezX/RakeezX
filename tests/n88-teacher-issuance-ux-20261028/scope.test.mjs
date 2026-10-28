// AI-authored affected-scope check; no service operations or build metadata writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const base='df2186a7ca2edc277f8f9d430f061df7f8c4305f';
const doc='docs/automation-evidence/20261028/N88_TEACHER_ISSUANCE_SAFE_UX_AND_NEXT_STAGE.md';
test('n88_no_service_or_schema_live_data_ops_and_sw_generation_handoff_recorded',async()=>{
 const changed=execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 const allowed=p=>['src/views/student-portal-class.js','src/styles/student-portal-class.css','src/lib/student-portal-class-client.js',doc].includes(p)||p.startsWith('tests/n88-teacher-issuance-ux-20261028/');
 assert([...changed,...untracked].every(allowed));
 const original=execFileSync('git',['show',base+':sw.js'],{encoding:'utf8'});
 assert.equal((await readFile('sw.js','utf8')).replaceAll('\r\n','\n'),original.replaceAll('\r\n','\n'));
 const text=await readFile(doc,'utf8');for(const phrase of ['rakeezx-v92','cache generation','sw.js','N44','item-id','sourceStamp','HTTPS'])assert(text.includes(phrase));
 for(const file of ['src/views/student-portal-class.js','src/lib/student-portal-class-client.js'])execFileSync(process.execPath,['--check',file]);
 for(const file of ['result.json','client-result.json','lifetime-result.json']){const report=JSON.parse(await readFile('tests/n88-teacher-issuance-ux-20261028/'+file,'utf8'));assert.equal(report.providerOperations,0);assert(!report.failure);}
});
