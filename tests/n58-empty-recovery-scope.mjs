// AI: read-only Git/saved-evidence checks for the published-base scope correction.
// No controller dispatch, queue writes, browser, service invocation or SQL application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const taskId='continuous-n58-empty-account-reviewed-recovery-20261014';
const runId='deac4f08-d0db-4ad7-92c5-bc37fbb7cb0a';
const baseSha='46a9cedcbc3f9f95280e33bb950fbc18285225a5';
const savedCandidate='e61e660a3bc731c9ad80b751f7e060e546a0baba';
const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const card=JSON.parse((await fs.readFile('C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','utf8')).replace(/^\uFEFF/,''));
assert.equal(card.attempt.runId,runId);
const remote=git(['ls-remote','--heads','origin','refs/heads/main']).split(/\s+/);
assert.equal(remote[1],'refs/heads/main');assert.match(remote[0],/^[a-f0-9]{40}$/);
git(['merge-base','--is-ancestor',card.baseSha,baseSha]);
git(['merge-base','--is-ancestor',baseSha,remote[0]]);
git(['merge-base','--is-ancestor',baseSha,'HEAD']);
git(['merge-base','--is-ancestor',savedCandidate,'HEAD']);
const paths=git(['diff','--name-only','-z','--no-renames',baseSha,'--']).split('\0').filter(Boolean).sort();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const allowed=p=>card.allowedPaths.some(pattern=>new RegExp('^'+pattern.split('*').map(escape).join('.*')+'$').test(p));
assert.ok(paths.length);assert.deepEqual(paths.filter(p=>!allowed(p)),[]);
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const ui=await read('tests/n58-empty-recovery-ui.json');
for(const [file,expected] of Object.entries(ui.sourceHashes))assert.equal(sha((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')),expected,file);
const service=await read('tests/n58-empty-recovery-service-binding.json');
assert.equal(sha(await fs.readFile(service.sqlPath)),service.sqlSha256);
assert.ok(Object.values(service.checks).every(v=>v===true));
for(const file of ['atomic','limits','ui','entry-negative'])assert.equal((await read('tests/n58-empty-recovery-'+file+'.json')).completed,true,file);
assert.equal((await read('tests/n58-empty-recovery-offline.json')).status,'PASS');
const evidence={taskId,runId,queuedBaseSha:card.baseSha,baseSha,savedCandidate,publishedMainSha:remote[0],changedPaths:paths,
 checks:{publishedBaseAncestry:true,savedCandidatePreserved:true,allowedScopeOnly:true,testedProductSourceUnchanged:true,exactAppliedSQLUnchanged:true,priorCompletedEvidenceReused:true},
 sqlSha256:service.sqlSha256,appliedMigration:service.appliedMigration,serviceRepeated:false,browserRepeated:false};
if(!process.argv.includes('--verify-only'))await fs.writeFile('tests/n58-empty-recovery-scope.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({baseSha,publishedMainSha:remote[0],paths:paths.length,checks:evidence.checks}));
