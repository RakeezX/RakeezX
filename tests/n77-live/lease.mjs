import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {TASK_FILE} from './binding.mjs';

const script='C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/resource-lease.ps1';
export function phaseLease(name,action,execute=execFileSync) {
  for(let attempt=0;attempt<2;attempt++) {
    try {
      return execute('powershell.exe',['-NoProfile','-File',script,'-Name',name,'-Action',action,
        '-TaskFile',TASK_FILE,'-WaitSeconds','0'],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    } catch(error) {
      const stderr=String(error.stderr??'');
      // Retry only the observed checkpoint sharing race through the same owner
      // verifier. Busy/ownership/authority failures are never retried or bypassed.
      if(attempt===1 || !stderr.includes('checkpoint.json') || !stderr.includes('being used by another process'))throw error;
    }
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(phaseLease(process.argv[2],process.argv[3]));}
  catch(error){console.error(String(error.stderr??error.message));process.exitCode=1;}
}
