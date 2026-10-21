// AI: one owned browser at a time; no live/external or shared browser phase.
import {execFileSync} from 'node:child_process';
const runtime='tests/n36-1018-unsafe-setup-partial-20261021/runtime.mjs';
const batches=[
 ['serial-critical','onclick-missing-before,onclick-conflict-before,onclick-unsafe-student-before,base-response-login-before,base-response-role-before','classes'],
 ['strict-anchor-controls','nonget-before,download-before,disabled-before,form-before,onclick-reimport-before','classes'],
 ['safe-setup','safe-before,safe-after','classes'],
 ['serial-metadata','onclick-before,onclick-after,route-before,absent-before,base-before,lateunsafe-before,lateabsent-before','metadata'],
];
for(const [label,cases,kind] of batches){
 execFileSync(process.execPath,['--experimental-vm-modules',runtime,'--candidate','--observe'],{stdio:'inherit',env:{...process.env,N36_LABEL:label,N36_CASES:cases,N36_SETUP_KIND:kind,N36_PORT:'49928',N36_WAIT_MS:'30000',N36_TILES:'20',N36_SCRIPT_DELAY_MS:'0',N36_HOLD_MS:'0'}});
}
