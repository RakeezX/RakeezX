import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {validateBinding,TASK_ID,TASK_FILE} from './n77-live/binding.mjs';
import {phaseLease} from './n77-live/lease.mjs';

const runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const previousRunId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const nextRunId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const activationId='synthetic-activation';
const fixture=()=>({runId,activationId,
  attempt:{runId,activationId,taskId:TASK_ID,taskFile:TASK_FILE,
    cwd:'C:/Users/Abody/Projects/RakeezX/.worktrees/'+TASK_ID,sessionId:'synthetic-session'},
  card:{id:TASK_ID,productId:'N77',activationId,liveAuthorizationRef:'D120',attempt:{runId},
    preparationAuthority:{kind:'scoped_preview_and_fixture_ops',productId:'N77',liveAuthorizationRef:'D120',
      supabase:{materialContinuation:{previousRunId,maximumAdditionalPairs:1,retiredPairReuseAllowed:false}}}}});

test('no missing/invalid run, retired run, task or activation mismatch is admitted',()=>{
  const variants=[x=>{delete x.runId;},x=>{x.runId='../latest';},
    x=>{x.runId=previousRunId;x.attempt.runId=previousRunId;},
    x=>{x.attempt.taskId='another-task';},x=>{x.attempt.activationId='old';},
    x=>{x.card.activationId='old';},x=>{x.attempt.cwd='C:/elsewhere';}];
  for(const mutate of variants){const x=fixture();mutate(x);assert.throws(()=>validateBinding(x));}
});
test('first binding admits current controller attempt; recovery retains it across later retries',()=>{
  const x=fixture(),saved=validateBinding(x);assert.equal(saved.fixtureRunId,runId);
  x.card.attempt.runId=nextRunId;
  assert.throws(()=>validateBinding(x),/FIRST_CONTINUATION_ATTEMPT_REQUIRED/);
  assert.deepEqual(validateBinding({...x,saved}),saved);
  assert.throws(()=>validateBinding({...x,runId:nextRunId,attempt:{...x.attempt,runId:nextRunId},saved}),/SAVED_FIXTURE_RUN_MISMATCH/);
});
test('flush-only import has no live binding; missing live input fails before initialization',()=>{
  const env={...process.env};delete env.RAKEEZX_N77_FIXTURE_RUN_ID;
  const imported=spawnSync(process.execPath,['--input-type=module','-e',
    "import {flush} from './tests/n77-live/gate.mjs'; import {RUN_ID,PRIVATE} from './tests/n77-live/run.mjs'; if(typeof flush!=='function'||RUN_ID!==undefined||PRIVATE!==undefined)process.exit(1);"],{env,encoding:'utf8',windowsHide:true});
  assert.equal(imported.status,0,imported.stderr);
  const denied=spawnSync(process.execPath,['tests/n77-live/run.mjs','prepare','https://00000000.rakeezx.pages.dev'],{env,encoding:'utf8',windowsHide:true});
  assert.equal(denied.status,1);assert.equal(JSON.parse(denied.stdout).errorCode,'EXPLICIT_FIXTURE_RUN_REQUIRED');
});
test('lease sharing race retries only the same verifier; second failure and ownership denial stop work',()=>{
  let calls=0;
  const sharing=()=>Object.assign(new Error('sharing'),{stderr:'checkpoint.json: being used by another process'});
  assert.equal(phaseLease('browser','acquire',()=>{if(++calls===1)throw sharing();return 'ACQUIRED browser';}),'ACQUIRED browser');
  assert.equal(calls,2);calls=0;
  assert.throws(()=>phaseLease('browser','acquire',()=>{calls++;throw sharing();}));assert.equal(calls,2);calls=0;
  assert.throws(()=>phaseLease('browser','acquire',()=>{calls++;throw Object.assign(new Error('owner'),{stderr:'Exact worker process not verified'});}));
  assert.equal(calls,1);
});
