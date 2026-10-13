import fs from 'node:fs/promises';
import path from 'node:path';

export const TASK_ID = 'continuous-n77-real-delete-20261012';
const PROJECT_ROOT = 'C:/Users/Abody/Projects/RakeezX';
const RUNTIME = PROJECT_ROOT + '/artifacts/ops-supervisor-v4';
export const STATE_ROOT = RUNTIME + '/capabilities/n77';
export const TASK_FILE = RUNTIME + '/queue/' + TASK_ID + '.json';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const denied = code => Object.assign(new Error(code), { safeCode: code });
const samePath = (a,b) => typeof a === 'string' && typeof b === 'string' &&
  path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// Pure admission checks are importable without accessing live/private state.
export function validateBinding({runId,card,attempt,activationId,saved,requireCurrent=true}) {
  if(typeof runId !== 'string' || !uuid.test(runId)) throw denied('EXPLICIT_FIXTURE_RUN_REQUIRED');
  const authority=card?.preparationAuthority, continuation=authority?.supabase?.materialContinuation;
  if(card?.id!==TASK_ID || card.productId!=='N77' || card.activationId!==activationId ||
    authority?.kind!=='scoped_preview_and_fixture_ops' || authority.productId!=='N77' ||
    card.liveAuthorizationRef!=='D120' || authority.liveAuthorizationRef!=='D120' ||
    continuation?.maximumAdditionalPairs!==1 || !uuid.test(continuation.previousRunId) ||
    continuation.retiredPairReuseAllowed!==false) throw denied('CONTINUATION_AUTHORITY_MISMATCH');
  if(runId===continuation.previousRunId) throw denied('RETIRED_FIXTURE_RUN_FORBIDDEN');
  if(attempt?.taskId!==TASK_ID || attempt.runId!==runId || attempt.activationId!==activationId ||
    !samePath(attempt.taskFile,TASK_FILE) ||
    !samePath(attempt.cwd,PROJECT_ROOT+'/.worktrees/'+TASK_ID)) throw denied('ATTEMPT_BINDING_MISMATCH');
  const binding={version:1,taskId:TASK_ID,activationId,fixtureRunId:runId,
    previousRunId:continuation.previousRunId,
    attemptPath:RUNTIME+'/attempts/'+TASK_ID+'/'+runId+'/attempt.json',sessionId:attempt.sessionId};
  if(saved) {
    if(JSON.stringify(saved)!==JSON.stringify(binding)) throw denied('SAVED_FIXTURE_RUN_MISMATCH');
  } else if(requireCurrent && card.attempt?.runId!==runId) throw denied('FIRST_CONTINUATION_ATTEMPT_REQUIRED');
  return binding;
}

export async function loadBinding(runId) {
  if(typeof runId !== 'string' || !uuid.test(runId)) throw denied('EXPLICIT_FIXTURE_RUN_REQUIRED');
  const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
  const card=await read(TASK_FILE), workflow=await read(RUNTIME+'/workflow-v5.json');
  const attemptPath=RUNTIME+'/attempts/'+TASK_ID+'/'+runId+'/attempt.json';
  let attempt;
  try {attempt=await read(attemptPath);} catch {throw denied('ATTEMPT_RECORD_UNAVAILABLE');}
  // Validate before using any card-derived value as a filesystem component.
  const proposed=validateBinding({runId,card,attempt,activationId:workflow.controller.activationId,requireCurrent:false});
  const anchor=STATE_ROOT+'/continuation-'+proposed.previousRunId+'.tmp';
  let saved;
  try {saved=await read(anchor);} catch(e) {if(e.code!=='ENOENT')throw e;}
  const binding=validateBinding({runId,card,attempt,activationId:workflow.controller.activationId,saved});
  if(!saved) {
    const previous=await read(STATE_ROOT+'/'+binding.previousRunId+'/private/receipt.tmp');
    if(previous.runId!==binding.previousRunId || previous.disposition!=='RETAINED_BANNED' || previous.disarmed!==true)
      throw denied('RETIRED_DISPOSITION_EVIDENCE_REQUIRED');
    await fs.mkdir(STATE_ROOT,{recursive:true});
    // One immutable continuation anchor prevents a later retry allocating a new pair.
    let file;
    try {file=await fs.open(anchor,'wx',0o600);await file.writeFile(JSON.stringify(binding,null,2));await file.sync();}
    catch(e) {if(e.code!=='EEXIST')throw e;
      validateBinding({runId,card,attempt,activationId:workflow.controller.activationId,saved:await read(anchor)});}
    finally {await file?.close();}
  }
  return binding;
}
