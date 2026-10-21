// AI: same approved large fixture, serialized after resource-pressure failures.
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['--experimental-vm-modules','tests/n36-1018-unsafe-setup-partial-20261021/runtime.mjs','--candidate','--observe'],{stdio:'inherit',env:{...process.env,N36_LABEL:'serial-large',N36_CASES:'onclick-before',N36_SETUP_KIND:'classes',N36_PORT:'49929',N36_WAIT_MS:'100000',N36_TILES:'640',N36_SCRIPT_DELAY_MS:'100',N36_HOLD_MS:'1600'}});
