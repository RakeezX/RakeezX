/** AI: regenerate only the inactive closure/extension in a disposable PG17. */
import {startNativePg} from '../fixtures/n88-integrated-class/native-pg.mjs';
import {compileGuidanceBoundary} from '../../drafts/n88-student-portal/activation/build-error-boundary.mjs';
import {execFileSync} from 'node:child_process';
export const taskId='n88-core-stable-guidance-1028',runId='0e0e1581-90bd-4c3e-9ec8-1c74827ef9cd';
const root='C:/Users/Abody/Projects/RakeezX';
export const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',root+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
if(process.argv.includes('--compile')) {
 let pg,owned=false;
 try {
  const acquired=lease('acquire');if(!/^(ACQUIRED|ALREADY OWNED)/.test(acquired))throw Error(acquired);owned=true;
  pg=await startNativePg(process.cwd());
  const c=await compileGuidanceBoundary(process.cwd(),pg);
  console.log(JSON.stringify({inactiveClosureCompiled:true,operations:c.operations.length,identities:c.identities.length,staging:c.staging,providerOperations:0}));
 }finally{try{await pg?.close();}finally{if(owned)console.log(lease('release'));}}
}
