/** AI: final startup/lazy-import/offline bootstrap check; reuse unchanged UI evidence. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,rename,access} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {root} from '../drafts/n88-student-portal/current-review.mjs';
import {powershell,canonicalRoot,processIdentity} from './fixtures/n88-current-review/native-pg.mjs';
const taskId='continuous-n88-current-functional-review-20261018',runId='02c487b0-7239-4750-b293-5ce1e9c480c1';
const cmd=args=>execFileSync(powershell,['-NoProfile','-NonInteractive',...args],{encoding:'utf8',windowsHide:true,timeout:60000});
const launch=path.join(root,'drafts/n88-student-portal/current-review-launch.ps1');
const lease=action=>cmd(['-File',canonicalRoot+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',canonicalRoot+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-RuntimeRoot',canonicalRoot+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId]).trim();
const file=path.join(root,'tests/fixtures/n88-current-review/receipts',randomUUID()+'.json');
const packageFile=path.join(root,'drafts/n88-student-portal/node_modules/@supabase/auth-js/package.json');
// Move only this run's installed package manifest, not a directory/user source.
const backup=packageFile+'.n88-review-'+randomUUID();let moved=false,held=false,r;
const report={aiAuthored:true,taskId,runId,checks:[],cleanup:{}};
try {
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED) integration$/);held=true;
  await rename(packageFile,backup);moved=true;
  assert.match(execFileSync(process.execPath,['drafts/n88-student-portal/current-review.mjs','--help'],{encoding:'utf8',windowsHide:true}),/14400/);
  // Missing manifest triggers the launcher's actual locked offline npm path.
  r=JSON.parse(cmd(['-File',launch,'-TtlSeconds','1','-Receipt',file])).review;
  assert.equal(r.status,'running');
  for(let i=0;i<100;i++){r=JSON.parse(await readFile(file,'utf8'));if(r.status==='stopped')break;await new Promise(ok=>setTimeout(ok,200));}
  assert.equal(r.status,'stopped');assert.equal(r.reason,'expired');assert.ok(r.cleanup.postgresStopped&&r.cleanup.httpClosed&&r.cleanup.ownedFilesRemoved);
  for(let i=0;i<20&&processIdentity(r.pid);i++)await new Promise(ok=>setTimeout(ok,100));
  assert.equal(processIdentity(r.pid),null);assert.equal(processIdentity(r.postgres.pid),null);await assert.rejects(access(r.phase));
  assert.equal(JSON.parse(await readFile(packageFile,'utf8')).version,'2.118.0');
  report.checks.push({name:'final_launcher_offline_bootstrap_and_expiry',status:'PASS',evidence:'Node --help works with service dependency manifest absent; actual hidden PS launcher restored locked dependencies using offline npm cache, started current composition, then 1s TTL closed HTTP/PG/Node and removed owned data. Existing 390/1280 UI evidence reused unchanged.'});
} finally {
  try {
    if(r?.status==='running')cmd(['-File',launch,'-Stop','-Receipt',file]);
    // npm ci replaces its owned node_modules, including the temporary manifest backup.
    if(moved){try{await access(packageFile);}catch{await rename(backup,packageFile);}}
  } finally {if(held)report.cleanup.leaseRelease=lease('release');await writeFile('tests/n88-current-review-launcher.result.json',JSON.stringify(report,null,2)+'\n');}
}
console.log('Final N88 launcher bootstrap/expiry PASS; no owned server or PG remains.');
