#!/usr/bin/env node
import { verifiedN36SetupDeliveryGateSplit } from './n36-setup-delivery-gates.mjs';
// Reviewed ops/card maintenance only. This is not a worker, scheduler or publisher.
import fs from 'node:fs';
import {verifiedN44SourceStageSplit,n44QualifiedTask} from './n44-qualified-source-evidence.mjs';
import {verifyPristineN123DependencyCorrection} from './pending-n123-dependency.mjs';
import {verifyPristineN36Verification,n36PristineSelectorSourceChain} from './pending-n36-verification.mjs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { verifiedDeployment, verifiedSourceOnlyPublication } from './controller.mjs';
import { buildLiveServiceEvidence, verifiedLiveServicePublication } from './live-service-publication.mjs';
import { n88MobileNativeTask } from './n88-mobile-native-publication.mjs';
import { STAGED_ACTIVATION_MODE, verifiedActivationStageContinuation, verifiedPilotStagePreparation } from './staged-activation-contract.mjs';
import { validateControllerReload, buildControllerReloadScript } from './reviewed-controller-reload.mjs';
import { HISTORICAL_RUNTIME_MODE, verifyHistoricalRuntimeSupersession } from './historical-runtime-supersession.mjs';
import { sourceWrapperCompanions, verifyPendingCompanion } from './source-wrapper-companions.mjs';

const SELF = 'scripts/ops-supervisor-v4/apply-reviewed-maintenance.mjs';
const WIN_PS = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const WIN_GIT = 'C:/Program Files/Git/cmd/git.exe';
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-z0-9][a-z0-9._-]{0,159}$/;
const RUNTIME_KEYS = new Set(('status sessionId attempt attempts runId lastRunId candidateSha baseSha worktreePath cwd resultPath runnerPid runnerCreatedAt brokerPid brokerCreatedAt ownedProcesses lastWorkerReap deliveryReceipt deliveryOwner implementationFailures infrastructureRetries failureClass lastFailure retryAt nextDeliveryAt lastModelError probingClass productRecordKey createdAt updatedAt workflowVersion __file recoveryHistory maintenanceHistory stagePublicationHistory').split(' '));
const read = file => { try { return fs.readFileSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
export const sha256 = bytes => bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const json = file => parse(fs.readFileSync(file));
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
const fail = message => { throw Error(message); };
const insist = (condition, message) => { if (!condition) fail(message); };
const win = value => path.win32.normalize(value).toLowerCase();
const equalPath = (a, b) => typeof a === 'string' && typeof b === 'string' && win(a) === win(b);
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function safeObject(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    insist(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe object key');
    safeObject(value[key]);
  }
}
export function permittedRepoPath(relative, date = new Date().toISOString().slice(0, 10)) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.startsWith('/') || /[\x00-\x1f:<>"|?*]/.test(relative)) return false;
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) return false;
  if (['AGENTS.md', '.gitignore', 'docs/RAKEEZ_OPS_CONTRACT.md', 'docs/PROJECT_INSTRUCTIONS.md', 'docs/HOURLY_REPORT_MAINTENANCE_PROMPT.txt'].includes(relative)) return true;
  if (relative.startsWith('docs/automation-evidence/' + date.replaceAll('-', '') + '/')) return !parts.some(p => /^(private|secrets?|credentials?|tokens?)$/i.test(p));
  return relative.startsWith('scripts/ops-supervisor-v4/') && !parts.some(p => /^(private|runtime|artifacts|queue|attempts|sessions?|leases|node_modules|\.git|\.env(?:\..*)?)$/i.test(p)) && !/\.(?:sql|pem|key|pfx|p12)$/i.test(relative);
}
// A dedicated operation for the one canonical capacity field. Runtime paths and
// complete replacement configs deliberately remain outside files[].
export function validateRuntimeConfigUpdate(update) {
  insist(update && typeof update === 'object' && !Array.isArray(update), 'Expected a runtimeConfigUpdate object');
  safeObject(update);
  const keys = ['expectedSha256', 'expectedMaxWorkers', 'maxWorkers', 'authorityRef', 'reason'];
  insist(Object.keys(update).length === keys.length && Object.keys(update).every(key => keys.includes(key)), 'Only the reviewed maxWorkers field may change');
  insist(SHA256.test(update.expectedSha256 ?? ''), 'Expected runtime config SHA256');
  for (const key of ['expectedMaxWorkers', 'maxWorkers']) insist(Number.isInteger(update[key]) && update[key] >= 1 && update[key] <= 5, 'Invalid runtime ' + key);
  insist(update.maxWorkers !== update.expectedMaxWorkers, 'Runtime capacity update has no change');
  insist(ID.test(update.authorityRef ?? '') && update.authorityRef.startsWith('po-'), 'A PO authority reference is required for runtime capacity');
  insist(typeof update.reason === 'string' && update.reason.trim().length >= 20 && update.reason.length <= 1000, 'A concrete runtime capacity reason is required');
  return structuredClone(update);
}
export function prepareRuntimeConfigUpdate(raw, update, activationId) {
  validateRuntimeConfigUpdate(update);
  insist(Buffer.isBuffer(raw) && sha256(raw) === update.expectedSha256, 'Runtime config changed since review');
  const current = parse(raw); safeObject(current);
  insist(current?.version === 5 && current.controller?.activationId === activationId, 'Runtime config activation/version changed');
  insist(current.maxWorkers === update.expectedMaxWorkers, 'Runtime capacity differs from review');
  const content = bytes({ ...current, maxWorkers: update.maxWorkers });
  return { content, beforeSha256: sha256(raw), afterSha256: sha256(content), previousMaxWorkers: current.maxWorkers,
    maxWorkers: update.maxWorkers, authorityRef: update.authorityRef, reason: update.reason };
}
export function verifyRuntimeConfigConsumer(snapshot, update) {
  validateRuntimeConfigUpdate(update);
  insist(snapshot.supportedMaxWorkers === 5, 'Live controller has not loaded reviewed five-worker capacity support');
}
export function validatePayload(payload, date = new Date().toISOString().slice(0, 10)) {
  safeObject(payload);
  insist(payload?.version === 1, 'Expected payload version 1');
  for (const field of ['taskId', 'activationId']) insist(ID.test(payload[field] ?? ''), 'Invalid ' + field);
  for (const field of ['repoRoot', 'opsWorktree', 'runtimeRoot']) insist(typeof payload[field] === 'string' && /^[A-Za-z]:[\\/]/.test(payload[field]) && !/[\x00-\x1f]/.test(payload[field]), 'Expected absolute Windows ' + field);
  insist(equalPath(payload.runtimeRoot, path.win32.join(payload.repoRoot, 'artifacts', 'ops-supervisor-v4')), 'Runtime must be the canonical ops runtime');
  insist(!equalPath(payload.repoRoot, payload.opsWorktree), 'An isolated ops worktree is required');
  insist(typeof payload.commitMessage === 'string' && payload.commitMessage.length <= 300 && /\[AI\]/.test(payload.commitMessage) && !/[\r\n\x00]/.test(payload.commitMessage), 'Expected one AI-identified commit subject');
  const runtimeConfigUpdate = Object.hasOwn(payload, 'runtimeConfigUpdate') ? validateRuntimeConfigUpdate(payload.runtimeConfigUpdate) : null;
  const controllerReload = Object.hasOwn(payload, 'controllerReload') ? validateControllerReload(payload.controllerReload) : null;
  insist(Array.isArray(payload.files) && (payload.files.length > 0 || runtimeConfigUpdate || controllerReload), 'No reviewed files, runtime capacity update or controller reload');
  const paths = new Set();
  for (const file of payload.files) {
    insist(permittedRepoPath(file.repoPath, date), 'Outside permitted ops/instruction paths: ' + file.repoPath);
    insist(!paths.has(file.repoPath.toLowerCase()), 'Duplicate file path'); paths.add(file.repoPath.toLowerCase());
    insist(typeof file.content === 'string' && SHA256.test(file.sha256 ?? '') && sha256(Buffer.from(file.content, 'utf8')) === file.sha256, 'Content hash mismatch: ' + file.repoPath);
    insist(file.expectedCanonicalSha256 === null || SHA256.test(file.expectedCanonicalSha256 ?? ''), 'Expected canonical hash or explicit null: ' + file.repoPath);
  }
  const allowed = payload.allowActiveTaskIds ?? [];
  insist(Array.isArray(allowed) && allowed.every(id => ID.test(id)) && new Set(allowed).size === allowed.length, 'Invalid active-task exceptions');
  const requireNoActiveWorkers = payload.requireNoActiveWorkers ?? allowed.length === 0;
  insist(typeof requireNoActiveWorkers === 'boolean' && !(requireNoActiveWorkers && allowed.length), 'Conflicting worker guards');
  if (runtimeConfigUpdate || controllerReload) insist(payload.requireNoActiveWorkers === true && allowed.length === 0, 'Capacity/reload maintenance requires explicit no-active-worker guards');
  insist(Array.isArray(payload.cardUpdates), 'cardUpdates must be an array');
  const taskIds = new Set();
  for (const update of payload.cardUpdates) {
    const { card, expected, materialReason } = update;
    insist(card && expected && ID.test(card.id ?? '') && card.activationId === payload.activationId, 'Invalid activated source card');
    insist(!taskIds.has(card.id) && !allowed.includes(card.id), 'Duplicate or active card update'); taskIds.add(card.id);
    insist(Object.keys(card).every(key => !RUNTIME_KEYS.has(key)), 'Source card contains runtime state: ' + card.id);
    const exactAttempt = (['blocked','retry_wait'].includes(expected.status) || expected.status === 'delivery' && card.completionMode === 'deferred_by_po' && card.deferralAuthority === 'PO-20261014-ABANDON-DUMMY-ACCOUNTS' || expected.status === 'awaiting_po' && card.completionMode === STAGED_ACTIVATION_MODE && card.productId === 'N88' && card.stagedActivation?.phase === 'acceptance-and-public-enable') && typeof expected.sessionId === 'string' && ID.test(expected.lastRunId ?? '') && GIT_SHA.test(expected.candidateSha ?? '');
    const pristinePendingSupersession = expected.status === 'pending' && card.completionMode === 'superseded_by_verified_delivery' && ID.test(card.supersededBy ?? '') && GIT_SHA.test(card.supersedingPublishedSha ?? '') && expected.sessionId === null && expected.lastRunId === null && expected.candidateSha === null && Array.isArray(expected.dependsOn);
    const pendingDependencyCorrection = expected.status === 'pending' && update.pendingDependencyCorrection?.version === 1 && expected.sessionId === null && expected.lastRunId === null && expected.candidateSha === null && SHA256.test(expected.queueSha256 ?? '');
    const pendingVerificationCorrection = expected.status === 'pending' && update.pendingVerificationCorrection?.version === 1 && expected.sessionId === null && expected.lastRunId === null && expected.candidateSha === null && SHA256.test(expected.queueSha256 ?? '');
    insist(expected.id === card.id && (exactAttempt || pristinePendingSupersession || pendingDependencyCorrection || pendingVerificationCorrection), 'Expected exact inactive attempt or pristine pending correction: ' + card.id);
    insist(typeof card.productId === 'string' && typeof card.scopeKey === 'string' && Array.isArray(card.allowedPaths) && Array.isArray(card.requiredChecks) && card.requiredChecks.every(x => typeof x === 'string' && x.length), 'Incomplete source card: ' + card.id);
    insist(typeof materialReason === 'string' && materialReason.trim().length >= 15, 'A concrete material repair is required');
  }
  if (payload.cardUpdates.some(update => update.card.completionMode === HISTORICAL_RUNTIME_MODE)) insist(payload.requireNoActiveWorkers === true && allowed.length === 0, 'Historical classification requires explicit no-active-worker guards');
  if (payload.cardUpdates.length) {
    const file = payload.files.find(x => x.repoPath === payload.sourceCardFile);
    insist(file && file.repoPath.startsWith('scripts/ops-supervisor-v4/') && file.repoPath.endsWith('.json'), 'Reviewed source card wrapper is missing');
    const wrapper = JSON.parse(file.content);
    insist(wrapper.activationId === payload.activationId && Array.isArray(wrapper.tasks) && wrapper.tasks.length === taskIds.size + sourceWrapperCompanions(payload).length, 'Source wrapper activation or task count mismatch');
    for (const update of payload.cardUpdates) insist(wrapper.tasks.filter(c => c.id === update.card.id).length === 1 && same(wrapper.tasks.find(c => c.id === update.card.id), update.card), 'Source wrapper differs from card payload: ' + update.card.id);
  }
  return { taskId: payload.taskId, files: payload.files.map(f => f.repoPath), taskIds: [...taskIds], allowActiveTaskIds: allowed, requireNoActiveWorkers, runtimeConfigUpdate, controllerReload };
}

// Keep all 100 ns digits; Date.parse alone incorrectly equates nearby births.
export function utcTicks(value) {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,7}))?(Z|[+-]\d\d:\d\d)$/.exec(value ?? '');
  insist(m && Number.isFinite(Date.parse(m[1] + m[3])), 'Invalid process creation time');
  return BigInt(Date.parse(m[1] + m[3])) * 10000n + BigInt((m[2] ?? '').padEnd(7, '0'));
}
export function reviewedPreimageMatches(actual, reviewed) {
  if (actual === null || reviewed === null) return actual === reviewed;
  const normalized = value => value.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return normalized(actual) === normalized(reviewed);
}
const SOURCE_ONLY_OPTIONAL_NOT_RUN = new Set([
  'native_action_popup',
  'hosted_activation_and_real_push',
  'hosted_service_auth_tls_and_student_activation',
  'optional_checkpoint_directory_removal',
  'hosted_service_app_device_and_production_verification'
]);
export function reconcilableCheckOutcomes(task, result, receipt) {
  if (!Array.isArray(result?.checks) || !result.checks.length
    || !task.requiredChecks?.every(name => result.checks.some(check => check.name === name && check.status === 'PASS'))) return false;
  const sourceOnly = verifiedSourceOnlyPublication(task, receipt);
  const n36 = task.id === 'continuous-n36-popup-width-top-diagnostics-module-load-0511-20261017' && verifiedDeployment(task, receipt);
  return result.checks.every(check => check.status === 'PASS'
    || sourceOnly && check.status === 'NOT_RUN' && (SOURCE_ONLY_OPTIONAL_NOT_RUN.has(check.name)
      || task.id === 'continuous-n36-final-receiver-journey-20261018' && check.name === 'native_popup_and_personal_account_save')
    || n36 && check.status === 'NOT_RUN' && ['NATIVE_ACTION_POPUP','original_chrome_error_resolution','publisher_production_and_stable_update'].includes(check.name));
}


// Fresh proof only for the already-integrated N36 .11 candidate; no Product publication.
export function verifiedObservedRepair(task, result, update) {
  const card=update.card, p=card.verificationRepair, old=task.deliveryReceipt, o=p?.observation, d=p?.observedReceipt;
  return card.completionMode==='reconcile_observed_publication'
    && task.id==='continuous-n36-popup-width-top-diagnostics-module-load-0511-20261017'
    && task.status==='blocked' && task.lastFailure?.startsWith('SOURCE_PARITY_PENDING:')
    && result.state==='LOCAL_READY' && update.expected.resultState==='LOCAL_READY'
    && !task.liveMutation && !task.liveAuthorizationRef && !card.liveMutation && !card.liveAuthorizationRef
    && old?.errorCode==='SOURCE_PARITY_PENDING' && old.candidateSha===task.candidateSha
    && sha256(bytes(old))===p.priorReceiptSha256
    && old.provider?.conclusion==='success' && old.evidence?.immutable?.passed===true
    && o?.readOnly===true && o.status==='verified' && o.publishedSha===old.publishedSha
    && o.currentMainSha===o.publishedSha && d?.publishedSha===o.publishedSha
    && same(d.provider,o.provider) && same(d.evidence,o.evidence) && d.verifiedAt===o.verifiedAt
    && sha256(bytes(o))===p.observationSha256 && sha256(bytes(d))===p.observedReceiptSha256
    && Number.isFinite(Date.parse(o.verifiedAt)) && Date.parse(o.verifiedAt)<=Date.now()+1000
    && Date.now()-Date.parse(o.verifiedAt)<15*60*1000
    && p.reason?.length>=50 && SHA256.test(p.reviewedFixtureSha256??'')
    && verifiedDeployment(task,d) && reconcilableCheckOutcomes(task,result,d)
    && old.evidence.production.assets.length===o.evidence.production.assets.length
    && old.evidence.production.assets.every(a=>o.evidence.production.assets.some(b=>a.repoPath===b.repoPath && a.urlPath===b.urlPath && a.expectedSha256===b.expectedSha256 && b.verified===true))
    && same(card.requiredChecks,task.requiredChecks) && same(card.allowedPaths,task.allowedPaths)
    && Object.entries(card).every(([k,v])=>['objective','completionMode','verificationRepair'].includes(k)||same(v,task[k]))
    && result.blockerType==='none' && !result.blocker;
}


export function verifiedSourcePathRepair(task,result,update) {
 const card=update.card,p=card.verificationPathRepair;
 const paths={
  'continuous-n36-source-change-class-upsert-20261019':{old:['scripts/build-teacher-import-helper.mjs'],actual:['src/views/class-import-center.js']},
  'continuous-n88-complete-runtime-binding-20261018':{old:['drafts/n88-student-portal/runtime-http.mjs','docs/automation-evidence/20261018/N88_RUNTIME_BINDING.md'],actual:['drafts/n88-student-portal/runtime.mjs','drafts/n88-student-portal/http-adapter.mjs','docs/automation-evidence/20261018/N88_RUNTIME_BINDING.md']},
  'continuous-n115-email-code-autofill-20261019':{old:['src/auth.js','docs/automation-evidence/20261019/N115_EMAIL_CODE_AUTOFILL.md'],actual:['src/app.js','docs/automation-evidence/20261019/N115_EMAIL_CODE_AUTOFILL.md']},
  'continuous-n36-one-start-all-class-handoff-20261019':{old:['tools/teacher-import-helper/**','docs/automation-evidence/20261019/N36_ONE_START_ALL_CLASS_HANDOFF.md'],actual:['src/lib/n36-extension-protocol.js','docs/automation-evidence/20261019/N36_ONE_START_ALL_CLASS_HANDOFF.md']},
  'continuous-n119-alphabetic-display-roll-number-20261019':{old:['src/lib/student-order.js','docs/automation-evidence/20261019/N119_ALPHABETIC_DISPLAY_ROLL_NUMBER.md'],actual:['src/views/grades.js','docs/automation-evidence/20261019/N119_ALPHABETIC_DISPLAY_ROLL_NUMBER.md']}
 }[task.id];
 if(!paths)return false;const {old,actual}=paths;
 return card.completionMode==='repair_source_verification_paths'
  && task.status==='blocked'
  && result.state==='LOCAL_READY' && update.expected.resultState==='LOCAL_READY'
  && (task.deliveryReceipt?.errorCode==='VERIFICATION_ASSET_MISSING' || task.id==='continuous-n36-one-start-all-class-handoff-20261019' && task.deliveryReceipt?.errorCode==='SOURCE_PARITY_PENDING' && sha256(bytes(task.deliveryReceipt))===p?.previousReceiptSha256 && ['immutable','production'].every(origin=>{const a=task.deliveryReceipt?.evidence?.[origin]?.assets;return a?.length>1&&a.filter(x=>!x.verified).length===1&&a.every(x=>x.verified||x.repoPath==='tools/teacher-import-helper/**'&&x.statusCode===404);}))
  && !task.liveMutation && !task.liveAuthorizationRef && !card.liveMutation && !card.liveAuthorizationRef
  && (same(task.verificationPaths,old) || task.id==='continuous-n115-email-code-autofill-20261019' && same(task.verificationPaths,actual) && task.sourceParityHistory?.some(h=>h.receipt?.errorCode==='VERIFICATION_ASSET_MISSING')) && same(card.verificationPaths,actual)
  && actual.every(path=>result.changedPaths?.includes(path) && task.allowedPaths.some(a=>a===path||a.endsWith('/**')&&path.startsWith(a.slice(0,-2))))
  && same(card.requiredChecks,task.requiredChecks) && same(card.allowedPaths,task.allowedPaths)
  && task.requiredChecks.every(name=>result.checks?.some(c=>c.name===name&&c.status==='PASS'))
  && result.checks.every(c=>c.status==='PASS'||c.status==='NOT_RUN'&&(c.name==='hosted_service_auth_tls_and_student_activation'||task.id==='continuous-n36-one-start-all-class-handoff-20261019'&&c.name==='publisher_production'||task.id==='continuous-n36-source-change-class-upsert-20261019'&&['optional_additional_expiry_phase','production_and_stable_folder_advance'].includes(c.name)))
  && result.blockerType==='none' && !result.blocker
  && sha256(bytes(result))===p?.previousResultSha256 && sha256(bytes(task.verificationPaths))===p?.previousPathsSha256
  && SHA256.test(p?.reviewedFixtureSha256??'') && p?.reason?.length>=50
  && Object.entries(card).every(([k,v])=>['objective','completionMode','verificationPaths','verificationPathRepair'].includes(k)||same(v,task[k]));
}

// Exact N88 card declaration repair: the original authority already permitted
// inert source-only publication. Preserve every provider/served/check proof.
export function verifiedSourceOnlyDeclarationRepair(task, result, update) {
  const card=update.card, proof=card.verificationRepair, d=task.deliveryReceipt, a=card.preparationAuthority;
  return task.id==='continuous-n88-current-functional-review-20261018'
    && card.completionMode==='reconcile_source_only_declaration'
    && task.status==='blocked' && task.lastFailure==='Publisher returned incomplete or mismatched deployment proof'
    && !task.preparationAuthority && !task.liveMutation && !task.liveAuthorizationRef
    && !card.liveMutation && !card.liveAuthorizationRef && /source-only inert launcher release/i.test(task.releaseAuthority??'')
    && a?.publication===true && a.publicationScope==='inert inactive source-only local N88 review launcher'
    && ['realData','hostedSchemaChange','AuthRLSChange','realSend','liveStudentAccessActivation'].every(k=>a[k]===false)
    && Object.keys(a).length===7
    && result.state==='LOCAL_READY' && result.blockerType==='none' && !result.blocker
    && result.checks?.length>0 && result.checks.every(c=>c.status==='PASS')
    && same(card.requiredChecks,task.requiredChecks) && same(card.allowedPaths,task.allowedPaths)
    && card.requiredChecks.every(name=>result.checks.some(c=>c.name===name&&c.status==='PASS'))
    && Object.entries(card).every(([key,value])=>['objective','completionMode','verificationRepair','preparationAuthority'].includes(key)||same(value,task[key]))
    && d?.productSourceChangeObserved===false && d.changedAssets?.length===0
    && verifiedDeployment({...task,preparationAuthority:a},d)
    && proof?.publishedSha===d.publishedSha && proof.priorReceiptSha256===sha256(bytes(d))
    && SHA256.test(proof.reviewedFixtureSha256??'') && proof.reason?.length>=50;
}

export function verifiedStageContinuation(task,result,update){
  return verifiedActivationStageContinuation(task,result,update,{verifiedDeployment,receiptSha256:d=>sha256(bytes(d)),same});
}
export function verifiedPilotPreparation(task,result,update){
  return verifiedPilotStagePreparation(task,result,update,{same,valueSha256:v=>sha256(bytes(v)),stringSha256:s=>sha256(Buffer.from(s,'utf8'))});
}

export function verifiedLiveServiceDeclarationRepair(task,result,update){
  const card=update.card,p=card.verificationRepair,d=task.deliveryReceipt;
  const declared={...task,servicePublicationEvidence:card.servicePublicationEvidence};
  return card.completionMode==='reconcile_live_service_publication'
    &&task.status==='blocked'&&result.state==='LOCAL_READY'&&update.expected.resultState==='LOCAL_READY'
    &&task.lastFailure==='Publisher returned incomplete or mismatched deployment proof'
    &&!task.servicePublicationEvidence&&(p?.kind==='reviewed-nonsending-service-evidence-v1'||n88MobileNativeTask(task)&&p?.kind==='reviewed-n88-mobile-native-publication-v1')
    &&d?.status==='deployed'&&d.publishedSha===p.publishedSha&&sha256(bytes(d))===p.priorReceiptSha256
    &&SHA256.test(p.reviewedFixtureSha256??'')&&p.reason?.length>=50
    &&same(card.requiredChecks,task.requiredChecks)&&same(card.allowedPaths,task.allowedPaths)
    &&Object.entries(card).every(([key,value])=>['objective','completionMode','verificationRepair','servicePublicationEvidence'].includes(key)||same(value,task[key]))
    &&task.requiredChecks?.every(n=>result.checks?.some(c=>c.name===n&&c.status==='PASS'))
    &&result.checks?.every(c=>c.status==='PASS'||c.status==='NOT_RUN'&&(['hosted_auth_fixture_and_closed_client_os_delivery','frontend_publication_and_served_source'].includes(c.name)||n44QualifiedTask(task)&&c.name==='n44_register503_actual_cause_and_qualified_existing_service_correction'))
    &&result.blockerType==='none'&&!result.blocker&&verifiedLiveServicePublication(declared,d)&&verifiedDeployment(declared,d);
}

// A named post-delivery check belongs to the publisher, so NOT_RUN is expected
// before the worker's candidate reaches publication. It cannot be required work.
export function reviewedNameRepairCheckOutcomes(task,result) {
  return Array.isArray(result?.checks) && result.checks.every(c=>
    c.status==='PASS' || c.status==='NOT_RUN' && (
      c.name==='production_publication'
      || (c.name==='publication_and_official_account' || c.name==='Production_parity_and_official_source_acceptance') && task.productId==='N36'
      || Array.isArray(task.postDeliveryChecks) && task.postDeliveryChecks.includes(c.name) && !task.requiredChecks?.includes(c.name)
    ));
}

export function verifyInactiveIdentity(task, result, update, activationId, historicalContext = null) {
  const e = update.expected;
  insist(task.id === e.id && task.activationId === activationId && task.productId === update.card.productId && task.scopeKey === update.card.scopeKey, 'Task identity/scope changed: ' + e.id);
  insist(task.status === e.status && (['blocked','retry_wait'].includes(task.status) || task.status === 'delivery' && update.card.completionMode === 'deferred_by_po' || task.status === 'awaiting_po' && verifiedStageContinuation(task,result,update)) && task.sessionId === e.sessionId && task.attempt?.runId === e.lastRunId && !task.runnerPid && !task.brokerPid, 'Task is no longer the exact inactive attempt: ' + e.id);
  insist(task.lastWorkerReap?.exactAbsence === true && task.lastWorkerReap.activationId === activationId && task.lastWorkerReap.runId === e.lastRunId && Array.isArray(task.lastWorkerReap.owners) && task.lastWorkerReap.owners.length > 0, 'No exact owned-process absence proof: ' + e.id);
  const evidenceOnly = update.card.completionMode === 'record_published_evidence' && e.resultState === 'LOCAL_READY' && result.state === 'LOCAL_READY' && !update.card.liveMutation && !update.card.liveAuthorizationRef && update.card.evidenceOnly?.acceptanceAuthority && result.changedPaths?.length && result.changedPaths.every(p => /^docs\/automation-evidence\/\d{8}\/[a-zA-Z0-9_-]+\.(md|json)$/.test(p) && update.card.allowedPaths.includes(p)) && update.card.requiredChecks?.length && update.card.requiredChecks.every(name => result.checks?.some(c => c.name === name && c.status === 'PASS')) && result.checks.every(c => c.status === 'PASS') && result.blockerType === 'none' && !result.blocker;
  const poDeferred = update.card.completionMode === 'deferred_by_po' && update.card.deferralAuthority === 'PO-20261014-ABANDON-DUMMY-ACCOUNTS' && update.card.productId === 'N58' && update.card.id === 'continuous-n58-empty-account-reviewed-recovery-20261014' && update.card.deferralReason?.length >= 20 && ['LOCAL_READY','BLOCKED'].includes(result.state);
  const d = task.deliveryReceipt, proof = update.card.verificationRepair;
  const deliveryRecheck = update.card.completionMode === 'recheck_existing_publication' && result.state === 'LOCAL_READY'
    && e.resultState === 'LOCAL_READY' && !update.card.liveMutation && !update.card.liveAuthorizationRef
    && d?.errorCode === 'SOURCE_PARITY_PENDING'
    // A terminal source-parity receipt may be rechecked ONLY after a separately reviewed
    // material verifier repair; all existing provider, immutable, identity and PASS guards remain.
    && (d.status === 'pending' || (d.status === 'blocked' && d.retryable === false
      && typeof task.lastFailure === 'string' && task.lastFailure.startsWith('SOURCE_PARITY_PENDING:')))
    && d.candidateSha === e.candidateSha
    && d.publishedSha === proof?.publishedSha && sha256(bytes(d)) === proof?.priorReceiptSha256
    && SHA256.test(proof?.reviewedFixtureSha256 ?? '') && proof?.reason?.length >= 20
    && d.provider?.conclusion === 'success' && d.provider?.headSha === d.publishedSha && d.evidence?.immutable?.passed === true
    && result.checks?.every(x => x.status === 'PASS' || update.card.id === 'continuous-n36-popup-width-top-diagnostics-module-load-0511-20261017' && x.status === 'NOT_RUN' && ['NATIVE_ACTION_POPUP','original_chrome_error_resolution','publisher_production_and_stable_update'].includes(x.name)) && update.card.requiredChecks?.every(name => result.checks.some(x => x.name === name && x.status === 'PASS'));

  // Material contract repair only: a worker finished safe Product checks, but
  // reported differently named groups. This authorizes another exact-session
  // worker review; it NEVER converts an absent/failed check into PASS.
  const nameRepair=update.card.completionMode==='repair_validation_check_names'
    && e.status==='blocked' && e.resultState==='LOCAL_READY' && result.state==='LOCAL_READY'
    && task.lastFailure?.startsWith('Candidate validation: Required affected checks have not passed:')
    && task.implementationFailures>=1 && !task.deliveryReceipt
    && result.blockerType==='none' && !result.blocker
    && Array.isArray(result.changedPaths) && result.changedPaths.length>0
    && result.changedPaths.every(p=>task.allowedPaths.some(a=>a===p || a.endsWith('/**') && p.startsWith(a.slice(0,-2))))
    && Array.isArray(result.checks) && result.checks.some(c=>c.status==='PASS')
    && reviewedNameRepairCheckOutcomes(task,result)
    && same(update.card.requiredChecks,task.requiredChecks)
    && same(update.card.allowedPaths,task.allowedPaths)
    && Object.entries(update.card).every(([key,value])=>
      ['objective','completionMode','checkNameRepair'].includes(key)||same(value,task[key]))
    && update.card.requiredChecks.some(name=>!result.checks.some(c=>c.name===name && c.status==='PASS'))
    && SHA256.test(update.card.checkNameRepair?.previousResultSha256??'')
    && SHA256.test(update.card.checkNameRepair?.previousFailureSha256??'')
    && sha256(Buffer.from(JSON.stringify(result)))===update.card.checkNameRepair.previousResultSha256
    && sha256(Buffer.from(task.lastFailure,'utf8'))===update.card.checkNameRepair.previousFailureSha256
    && update.card.checkNameRepair.reason?.length>=35
    && result.candidateSha===e.candidateSha
    && result.baseSha===e.baseSha;
  const verifiedReconcile = update.card.completionMode === 'reconcile_verified_publication'
    && e.status === 'blocked' && e.resultState === 'LOCAL_READY' && result.state === 'LOCAL_READY'
    && task.lastFailure === 'Publisher returned incomplete or mismatched deployment proof'
    && !update.card.liveMutation && !update.card.liveAuthorizationRef && !task.liveMutation && !task.liveAuthorizationRef
    && d?.status === 'deployed' && verifiedDeployment(task, d)
    && d.publishedSha === proof?.publishedSha && sha256(bytes(d)) === proof?.priorReceiptSha256
    && SHA256.test(proof?.reviewedFixtureSha256 ?? '') && proof?.reason?.length >= 50
    && same(update.card.requiredChecks, task.requiredChecks) && same(update.card.allowedPaths, task.allowedPaths)
    && Object.entries(update.card).every(([key,value]) => ['objective','completionMode','verificationRepair'].includes(key) || same(value,task[key]))
    && reconcilableCheckOutcomes(task, result, d)
    && result.blockerType === 'none' && !result.blocker;
  const historicalSupersession = update.card.completionMode === HISTORICAL_RUNTIME_MODE && verifyHistoricalRuntimeSupersession(task, result, update, historicalContext);
  insist(result.taskId === e.id && result.runId === e.lastRunId && (result.state === 'BLOCKED' || evidenceOnly || deliveryRecheck || verifiedReconcile || verifiedLiveServiceDeclarationRepair(task,result,update) || verifiedStageContinuation(task,result,update) || verifiedObservedRepair(task,result,update) || verifiedSourcePathRepair(task,result,update) || verifiedSourceOnlyDeclarationRepair(task,result,update) || poDeferred || nameRepair || historicalSupersession) && result.candidateSha === e.candidateSha, 'Worker result identity changed: ' + e.id);
  insist(equalPath(result.worktreePath, task.worktreePath), 'Result worktree mismatch: ' + e.id);
  const savedBinding = e.queuedBaseSha !== undefined || e.queuedCandidateSha !== undefined;
  if (savedBinding) {
    // A blocked worker may have reconciled a newer main base without any queued candidate yet.
    // Require the explicit null marker AND actual nullish queue state; every other identity guard stays exact.
    const noQueuedCandidate = e.queuedCandidateSha === null && task.candidateSha == null;
    insist(GIT_SHA.test(e.queuedBaseSha ?? '') && (noQueuedCandidate || GIT_SHA.test(e.queuedCandidateSha ?? '')) && GIT_SHA.test(e.baseSha ?? ''), 'Incomplete reviewed queued/result binding: ' + e.id);
    insist(task.baseSha === e.queuedBaseSha && (noQueuedCandidate || task.candidateSha === e.queuedCandidateSha) && result.baseSha === e.baseSha, 'Reviewed queued/result preimage changed: ' + e.id);
  } else {
    insist(result.baseSha === task.baseSha, 'Result base mismatch: ' + e.id);
    insist(task.candidateSha == null || task.candidateSha === e.candidateSha, 'Queue candidate differs from result: ' + e.id);
  }
  if (e.worktreePath) insist(equalPath(task.worktreePath, e.worktreePath), 'Expected worktree changed');
  if (e.baseSha && !savedBinding) insist(task.baseSha === e.baseSha, 'Expected base changed');
  return true;
}

export function verifyPristinePendingSupersession(task, replacement, update, activationId) {
  const e = update.expected, card = update.card;
  insist(task.id === e.id && task.activationId === activationId && task.productId === card.productId && task.scopeKey === card.scopeKey, 'Task identity/scope changed: ' + e.id);
  insist(task.status === 'pending' && e.status === 'pending' && same(task.dependsOn ?? [], e.dependsOn), 'Pending task state or dependency changed: ' + e.id);
  const pristine = ['sessionId','attempt','candidateSha','baseSha','worktreePath','resultPath','runnerPid','brokerPid','ownedProcesses'];
  insist(pristine.every(key => task[key] == null), 'Pending task already owns execution state: ' + e.id);
  insist(card.completionMode === 'superseded_by_verified_delivery' && card.supersededBy === replacement.id && GIT_SHA.test(card.supersedingPublishedSha ?? ''), 'Invalid verified supersession card: ' + e.id);
  const receipt = replacement.deliveryReceipt;
  insist(replacement.productId === task.productId && replacement.status === 'awaiting_po' && replacement.candidateSha === receipt?.candidateSha, 'Replacement is not the exact same-product awaiting-PO delivery: ' + replacement.id);
  insist(receipt?.taskId === replacement.id && receipt.ticketId === task.productId && receipt.status === 'deployed' && receipt.state === 'DEPLOYED_AWAITING_PO' && receipt.productionDeployed === true && receipt.closed === false, 'Replacement lacks deployed-awaiting-PO receipt: ' + replacement.id);
  insist(receipt.publishedSha === card.supersedingPublishedSha && receipt.currentMainSha === receipt.publishedSha && receipt.provider?.headSha === receipt.publishedSha && receipt.provider?.conclusion === 'success' && Number.isFinite(Date.parse(receipt.verifiedAt)), 'Replacement publication identity is unverified: ' + replacement.id);
  insist(receipt.binding?.candidateAncestorOfPublished === true && receipt.binding?.previousMainAncestorOfPublished === true && receipt.binding?.mainContainsPublished === true && receipt.binding?.checkHeadShaMatches === true, 'Replacement publication binding is incomplete: ' + replacement.id);
  insist(receipt.evidence?.immutable?.passed === true && receipt.evidence?.production?.passed === true, 'Replacement served-source proof is incomplete: ' + replacement.id);
  for (const group of [receipt.evidence.immutable.assets, receipt.evidence.production.assets]) insist(Array.isArray(group) && group.length > 0 && group.every(asset => asset.verified === true), 'Replacement contains an unverified served asset: ' + replacement.id);
  return true;
}

export function catalogSourceBinding(catalogTasks, task, update, sourceCardFile, expectedSourceSha256, followupSources = []) {
  const previous = catalogTasks.filter(t => t.id === update.card.id);
  if (previous.length === 1) {
    insist(previous[0].activationId === update.card.activationId && previous[0].productId === update.card.productId && previous[0].scopeKey === update.card.scopeKey, 'Catalog source identity changed');
    return { kind: 'catalog', index: catalogTasks.indexOf(previous[0]), baseline: previous[0] };
  }
  insist(previous.length === 0, 'Catalog source identity changed');
  const sourceName = path.win32.basename(sourceCardFile ?? '');
  insist(task?.approvedNote?.source === sourceName && SHA256.test(task.approvedNote.sha256 ?? ''), 'Approved-note source identity changed');
  if (task.approvedNote.sha256 !== expectedSourceSha256) {
    // A previous OWNED reviewed maintenance committed a new source hash after
    // the initial approved-note admission. Bind only the latest exact chain.
    const history = followupSources.filter(x => Array.isArray(x.updatedTaskIds) && x.updatedTaskIds.includes(task.id));
    const latest = history.at(-1), wanted = '\\' + win(sourceCardFile).replaceAll('/', '\\');
    insist(latest && latest.sourceSha256 === expectedSourceSha256 && GIT_SHA.test(latest.commit ?? '')
      && win(latest.sourceFile ?? '').replaceAll('/', '\\').endsWith(wanted)
      && task.recoveryHistory?.some(event => event.kind === 'reviewed-material-maintenance'
        && event.commit === latest.commit && (event.sessionId === task.sessionId || n36PristineSelectorSourceChain(task,event,latest))),
      'Approved-note source is not the latest reviewed owned maintenance chain');
  }
  return { kind: 'approved-note', index: -1, baseline: task, approvedNoteSha256: task.approvedNote.sha256 };
}

export function reviewedSourcePreimageMatches(remoteBytes, opsBytes, canonicalBytes, file, approvedNoteSha256 = null) {
  if (reviewedPreimageMatches(remoteBytes, canonicalBytes) && reviewedPreimageMatches(opsBytes, canonicalBytes)) return true;
  return remoteBytes === null && opsBytes === null && canonicalBytes !== null
    && approvedNoteSha256 === file.expectedCanonicalSha256
    && sha256(canonicalBytes) === file.expectedCanonicalSha256;
}


// Only an exact reviewed missing-asset failure may re-enter bounded preparation.
export function prepareVerificationJournalRepair(task,update,raw){
 const p=update.card.verificationPathRepair,j=parse(raw);
 insist(verifiedSourcePathRepair(task,json(task.resultPath),update),'Journal repair lacks exact accepted source-path correction');
 if(p.publishedJournalSha256){
  insist(task.id==='continuous-n36-one-start-all-class-handoff-20261019'&&sha256(raw)===p.publishedJournalSha256,'Published source-selector journal changed');
  insist(j.stage==='pushed'&&j.pushConfirmedAt&&j.candidateSha===update.expected.candidateSha&&j.baseSha===update.expected.baseSha&&j.ticketId===task.productId&&j.publishedSha===task.deliveryReceipt.publishedSha,'Wrong published journal identity/phase');
  const invalid='tools/teacher-import-helper/**',actual='src/lib/n36-extension-protocol.js';
  insist(j.assets?.filter(a=>a.repoPath===invalid).length===1&&j.assets.some(a=>a.repoPath===actual&&!a.deleted)&&update.card.verificationPaths.includes(actual),'Exact corrected real source is missing');
  return {...j,assets:j.assets.filter(a=>a.repoPath!==invalid),verificationRepairHistory:[...(j.verificationRepairHistory??[]),{at:new Date().toISOString(),oldJournalSha256:sha256(raw),removedInvalidSelector:invalid,mandatoryActualSource:actual,reason:p.reason}]};
 }

 insist(SHA256.test(p?.blockedJournalSha256??'')&&sha256(raw)===p.blockedJournalSha256,'Blocked publisher journal changed since review');
 insist(j.stage==='blocked'&&j.errorCode==='VERIFICATION_ASSET_MISSING'&&j.candidateSha===update.expected.candidateSha&&j.baseSha===update.expected.baseSha&&j.ticketId===task.productId,'Journal is not the exact missing-asset attempt');
 insist(j.prepareAttempt>=1&&j.prepareAttempt<3&&!j.pushedAt&&!j.receipt,'Only an unpushed bounded preparation may resume');
 const {errorCode,message,errorDetails,...kept}=j;
 return {...kept,stage:'reprepare',verificationRepairHistory:[...(j.verificationRepairHistory??[]),{at:new Date().toISOString(),oldStage:j.stage,errorCode,message,oldJournalSha256:sha256(raw),reviewedPaths:update.card.verificationPaths,reason:p.reason}]};
}

export function revisedTask(task, update, commit, at, historicalContext = null) {
  if (update.card.completionMode === HISTORICAL_RUNTIME_MODE) {
    insist(historicalContext?.result, 'Original unchanged result is required for historical classification');
    verifyInactiveIdentity(task, historicalContext.result, update, task.activationId, historicalContext);
    const event = { at, commit, kind: 'reviewed-material-maintenance', effect: 'historical-source-supersession-only', reason: update.materialReason,
      previousRunId: task.attempt.runId, sessionId: task.sessionId, preservedCandidateSha: task.candidateSha, preservedResultBaseSha: task.baseSha,
      previousFailure: task.lastFailure, originalResultSha256: update.card.historicalSupersession.originalResultSha256,
      originalReceiptSha256: update.card.historicalSupersession.originalReceiptSha256, replacementTaskId: update.card.supersededBy,
      replacementPublishedSha: update.card.supersedingPublishedSha, coverageEvidencePath: update.card.historicalSupersession.coverageEvidencePath,
      coverageEvidenceSha256: update.card.historicalSupersession.coverageEvidenceSha256 };
    return { ...structuredClone(task), ...structuredClone(update.card), status: 'blocked', failureClass: 'external',
      lastFailure: 'SUPERSEDED_BY_VERIFIED_DELIVERY: ' + update.card.supersededBy + ' published as ' + update.card.supersedingPublishedSha,
      nextDeliveryAt: null, retryAt: null, deliveryOwner: null, updatedAt: at,
      recoveryHistory: [...(task.recoveryHistory ?? []), event], historicalSupersessionHistory: [...(task.historicalSupersessionHistory ?? []), event],
      supersessionEvidence: { taskId: update.card.supersededBy, publishedSha: update.card.supersedingPublishedSha, at,
        classificationOnly: true, coverageEvidencePath: event.coverageEvidencePath, coverageEvidenceSha256: event.coverageEvidenceSha256 } };
  }
  const saved = structuredClone(task);
  const event = { at, commit, kind: 'reviewed-material-maintenance', reason: update.materialReason, previousRunId: task.attempt?.runId ?? null, sessionId: task.sessionId ?? null, preservedCandidateSha: update.expected.candidateSha ?? null, previousQueuedCandidateSha: task.candidateSha ?? null, previousQueuedBaseSha: task.baseSha ?? null, preservedResultBaseSha: update.expected.baseSha ?? task.baseSha ?? null, previousFailure: task.lastFailure ?? null, previousImplementationFailures: task.implementationFailures ?? 0, previousInfrastructureRetries: task.infrastructureRetries ?? 0 };

  Object.assign(saved, structuredClone(update.card), { status: 'pending', candidateSha: update.expected.candidateSha, baseSha: update.expected.baseSha ?? task.baseSha, implementationFailures: 0, infrastructureRetries: 0, failureClass: null, lastFailure: null, retryAt: null, nextDeliveryAt: null, probingClass: null, lastModelError: null, productRecordKey: null, updatedAt: at, recoveryHistory: [...(task.recoveryHistory ?? []), event] });
  if(update.card.completionMode===STAGED_ACTIVATION_MODE){
    insist(verifiedStageContinuation(task,json(task.resultPath),update),'Verified pilot stage no longer qualifies');
    saved.stagePublicationHistory=[...(task.stagePublicationHistory??[]),{at,phase:'pilot',runId:task.attempt.runId,candidateSha:task.candidateSha,receipt:structuredClone(task.deliveryReceipt)}];
    saved.deliveryReceipt=null;saved.deliveryOwner=null;
  }
  if (update.card.completionMode === 'repair_source_verification_paths') {
    insist(verifiedSourcePathRepair(task, json(task.resultPath), update), 'Source verification-path repair no longer qualifies');
    saved.status='delivery'; saved.nextDeliveryAt=at; saved.deliveryOwner=null;
    saved.sourceParityHistory=[...(task.sourceParityHistory??[]),{at,reason:update.materialReason,receipt:structuredClone(task.deliveryReceipt)}];
  }
  if (update.card.completionMode === 'recheck_existing_publication') {
    saved.status = 'delivery'; saved.nextDeliveryAt = at; saved.lastFailure = null;
    saved.sourceParityHistory = [...(task.sourceParityHistory ?? []), { at, reason: update.materialReason, receipt: structuredClone(task.deliveryReceipt) }];
    saved.sourceParityState = null;
  }
  if (update.card.completionMode === 'reconcile_verified_publication') {
    insist(task.deliveryReceipt?.status === 'deployed' && verifiedDeployment(task,task.deliveryReceipt), 'Production receipt no longer qualifies for reconciliation');
    saved.status = 'awaiting_po'; saved.productionVerifiedAt = task.deliveryReceipt.verifiedAt;
    saved.deliveryOwner = null; saved.nextDeliveryAt = null;
    saved.publisherReconciliation = { at, commit, publishedSha: task.deliveryReceipt.publishedSha,
      originalDeliveryReceiptSha256: sha256(bytes(task.deliveryReceipt)), reason: update.materialReason };
  }

  if(update.card.completionMode==='reconcile_live_service_publication'){
    insist(verifiedLiveServiceDeclarationRepair(task,json(task.resultPath),update),'Live-service declaration no longer qualifies');
    insist(verifiedDeployment(saved,saved.deliveryReceipt),'Declared service receipt no longer verifies');
    saved.status='awaiting_po';saved.productionVerifiedAt=saved.deliveryReceipt.verifiedAt;
    saved.deliveryOwner=null;saved.nextDeliveryAt=null;
    saved.publisherReconciliation={at,commit,publishedSha:saved.deliveryReceipt.publishedSha,
      originalDeliveryReceiptSha256:sha256(bytes(task.deliveryReceipt)),reason:update.materialReason,liveService:true};
  }

  if (update.card.completionMode === 'reconcile_source_only_declaration') {
    insist(verifiedSourceOnlyDeclarationRepair(task,json(task.resultPath),update), 'Source-only declaration repair no longer qualifies');
    insist(verifiedDeployment(saved,saved.deliveryReceipt), 'Source-only receipt no longer verifies with explicit original authority');
    saved.status='awaiting_po'; saved.productionVerifiedAt=saved.deliveryReceipt.verifiedAt;
    saved.deliveryOwner=null; saved.nextDeliveryAt=null;
    saved.publisherReconciliation={at,commit,publishedSha:saved.deliveryReceipt.publishedSha,
      originalDeliveryReceiptSha256:sha256(bytes(task.deliveryReceipt)),reason:update.materialReason,sourceOnly:true};
  }

  if (update.card.completionMode==='reconcile_observed_publication') {
    const d=update.card.verificationRepair.observedReceipt;
    insist(verifiedDeployment(task,d),'Observed Production receipt no longer qualifies');
    saved.sourceParityHistory=[...(task.sourceParityHistory??[]),{at,reason:update.materialReason,receipt:structuredClone(task.deliveryReceipt)}];
    saved.deliveryReceipt=structuredClone(d); saved.status='awaiting_po';saved.productionVerifiedAt=d.verifiedAt;
    saved.deliveryOwner=null;saved.nextDeliveryAt=null;
    saved.publisherReconciliation={at,commit,publishedSha:d.publishedSha,originalDeliveryReceiptSha256:sha256(bytes(task.deliveryReceipt)),observationSha256:update.card.verificationRepair.observationSha256,reason:update.materialReason};
  }

  if (update.card.completionMode === 'deferred_by_po') {
    insist(typeof update.card.deferralReason === 'string' && update.card.deferralReason.length >= 20, 'Explicit PO deferral reason required');
    saved.status = 'blocked'; saved.lastFailure = 'DEFERRED_BY_PO: ' + update.card.deferralReason; saved.failureClass = 'external';
  }
  if (update.card.completionMode === 'superseded_by_verified_delivery') {
    saved.status = 'blocked';
    saved.dependsOn = [];
    saved.lastFailure = 'SUPERSEDED_BY_VERIFIED_DELIVERY: ' + update.card.supersededBy + ' published as ' + update.card.supersedingPublishedSha;
    saved.failureClass = 'external';
    saved.supersessionEvidence = { taskId: update.card.supersededBy, publishedSha: update.card.supersedingPublishedSha, at };
  }
  return saved;
}

const ps = (script, timeout = 20000) => execFileSync(WIN_PS, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop'\n" + script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 }).trim();
function inventory(pids) {
  const ids = [...new Set(pids)];
  insist(ids.length && ids.every(n => Number.isSafeInteger(n) && n > 0), 'Invalid process identity');
  const filter = ids.map(n => 'ProcessId=' + n).join(' OR ');
  const output = ps('@(Get-CimInstance Win32_Process -Filter ' + literal(filter) + ' | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;createdAt=$_.CreationDate.ToUniversalTime().ToString("o");name=[string]$_.Name} }) | ConvertTo-Json -Depth 3 -Compress');
  const rows = output ? JSON.parse(output) : [];
  return Array.isArray(rows) ? rows : [rows];
}
function noLinks(file) {
  let item = path.resolve(file);
  while (true) { const stat = fs.existsSync(item) ? fs.lstatSync(item) : null; insist(!stat?.isSymbolicLink(), 'Symlink/junction is outside maintenance scope: ' + item); const parent = path.dirname(item); if (parent === item) break; item = parent; }
}
function replaceGuarded(file, content, expectedHash) {
  noLinks(file); insist(sha256(read(file)) === expectedHash, 'File changed before write: ' + file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.maintenance-' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, content, { flag: 'wx' });
  try {
    insist(sha256(read(file)) === expectedHash, 'File changed before replace: ' + file);
    try { fs.renameSync(temp, file); }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || expectedHash === null || !fs.existsSync(file)) throw error;
      ps(nativeGuardedReplacementScript(file,temp,expectedHash));
    }
    insist(sha256(read(file)) === sha256(content), 'Installed bytes differ: ' + file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function safeError(error) {
  const redact = value => String(value ?? '').replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@').replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, '[REDACTED]').replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]');
  const stderr = redact(error.stderr).slice(-2500), stdout = redact(error.stdout).slice(-2500);
  return { message: redact(error.message).split('\n')[0].slice(0, 700), ...(stderr ? { stderr } : {}), ...(stdout ? { stdout } : {}), ...(Number.isInteger(error.status) ? { exitCode: error.status } : {}) };
}

export async function applyReviewedMaintenance(payload, payloadHash) {
  const plan = validatePayload(payload);
  insist(process.platform === 'win32', '--apply is a Windows-native operation; --check is portable');
  const { repoRoot: root, opsWorktree: ops, runtimeRoot: rt } = payload;
  for (const dir of [root, ops, rt]) { noLinks(dir); insist(fs.statSync(dir).isDirectory(), 'Missing directory: ' + dir); }
  const startedAt = new Date().toISOString(), token = randomUUID();
  const me = inventory([process.pid]).find(p => p.pid === process.pid); insist(me, 'Cannot establish maintenance process birth');
  const lockPath = path.join(rt, 'maintenance.lock.json'), stopPath = path.join(rt, 'STOP');
  const owner = { version: 1, owner: 'apply-reviewed-maintenance', taskId: payload.taskId, token, nodePID: process.pid, processCreationTime: me.createdAt, activationId: payload.activationId, startedAt, payloadSha256: payloadHash };
  // Atomic wx is the lock. Existing locks, including stale/unknown ones, are never removed.
  const ownerBytes = bytes(owner);
  fs.writeFileSync(lockPath, ownerBytes, { flag: 'wx' });
  const evidenceRoot = path.join(rt, 'maintenance', payload.taskId, token);
  const receipt = { version: 1, ...owner, status: 'LOCKED', evidenceRoot, steps: [], committed: false, pushed: false, opsWrittenPaths: [], installedPaths: [], runtimeConfigUpdated: false, controllerReloadAttempted: false, catalogUpdated: false, activatedTasks: [], touchedWorkerProcesses: [] };
  let ownStop = false, stopBytes, pausedAt = 0, controller, beforeCatalog, controllerReloaded = false;
  const runtimeConfigPath = path.join(rt, 'workflow-v5.json');
  let runtimeConfigBefore, runtimeConfigPlan;
  const queueBefore = new Map(), sourceBindings = new Map(), opsPreimageHashes = new Map();
  const record = (stage, detail = {}) => { receipt.stage = stage; receipt.steps.push({ at: new Date().toISOString(), stage, ...detail }); replaceGuarded(path.join(evidenceRoot, 'progress.json'), bytes(receipt), sha256(read(path.join(evidenceRoot, 'progress.json')))); };
  const ownsLock = () => read(lockPath)?.equals(ownerBytes) === true;
  const git = (args, cwd = ops, timeout = 45000) => execFileSync(WIN_GIT, ['-c', 'core.longpaths=true', ...args], { cwd, encoding: 'utf8', timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }).trim();
  const gitRaw = args => execFileSync(WIN_GIT, ['-c', 'core.longpaths=true', ...args], { cwd: ops, encoding: 'utf8', timeout: 20000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const dirtyPaths = () => gitRaw(['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0').filter(Boolean).map(line => { insist(!/[RC]/.test(line.slice(0, 2)), 'Renames/copies are outside this maintenance operation'); return line.slice(3); });
  function inspectController() {
    insist(ownsLock(), 'Maintenance lock identity changed');
    const active = json(path.join(rt, 'ACTIVE_TASKS.json')), id = json(path.join(rt, 'CONTROLLER_IDENTITY.json'));
    insist(active.activationId === payload.activationId && id.pid === controller.pid && id.instanceId === controller.instanceId && utcTicks(id.createdAt) === utcTicks(controller.createdAt), 'Controller identity changed during maintenance');
    const observed = inventory([id.pid]).find(p => p.pid === id.pid);
    insist(observed && utcTicks(observed.createdAt) === utcTicks(id.createdAt), 'Controller process is absent or PID was reused');
    insist(active.controllerPid === id.pid && active.instanceId === id.instanceId && active.controllerAlive === true && active.processInventoryKnown === true, 'Unverified controller snapshot');
    insist((active.active ?? []).every(t => plan.allowActiveTaskIds.includes(t.id)), 'An unapproved active task is present');
    if (plan.requireNoActiveWorkers) insist((active.active ?? []).length === 0 && active.runningCount === 0, 'Maintenance requires no active workers');
    if (plan.runtimeConfigUpdate && (!plan.controllerReload || controllerReloaded)) verifyRuntimeConfigConsumer(active, plan.runtimeConfigUpdate);
    return active;
  }
  function pausedIdle() {
    insist(ownStop && read(stopPath)?.equals(stopBytes) && !fs.existsSync(path.join(rt, 'STOP-REFILL')), 'Maintenance pause ownership changed');
    const active = inspectController();
    return active.paused === true && Date.parse(active.at) >= pausedAt && Date.now() - Date.parse(active.at) < 25000 && !active.deliveryInFlight && !fs.existsSync(path.join(rt, 'leases', 'integration.json')) ? active : null;
  }
  function exactInactive(update) {
    const file = path.join(rt, 'queue', update.card.id + '.json'); noLinks(file);
    const raw = fs.readFileSync(file), task = parse(raw), run = update.expected.lastRunId;
    if (update.expected.status === 'pending') {
      if(update.pendingDependencyCorrection?.version===1){verifyPristineN123DependencyCorrection(task,update,sha256(raw));return {file,raw,task,resultSha256:null,candidateSha:null};}
      if(update.pendingVerificationCorrection?.version===1){verifyPristineN36Verification(task,update,sha256(raw));return {file,raw,task,resultSha256:null,candidateSha:null};}
      const replacementFile = path.join(rt, 'queue', update.card.supersededBy + '.json'); noLinks(replacementFile);
      const replacement = json(replacementFile);
      verifyPristinePendingSupersession(task, replacement, update, payload.activationId);
      return { file, raw, task, resultSha256: null, candidateSha: null, supersedingPublishedSha: replacement.deliveryReceipt.publishedSha };
    }
    const resultPath = path.join(rt, 'attempts', update.card.id, run, 'result.json'); noLinks(resultPath);
    insist(equalPath(task.resultPath ?? task.attempt?.outputPath, resultPath), 'Unexpected result path: ' + task.id);
    const resultBytes = fs.readFileSync(resultPath), result = parse(resultBytes);
    let historicalContext = null;
    if (update.card.completionMode === HISTORICAL_RUNTIME_MODE) {
      insist(update.card.supersededBy === 'continuous-n88-six-digit-unified-student-code-20261018', 'Only the exact reviewed N88 replacement may be read');
      const replacementPath = path.join(rt, 'queue', update.card.supersededBy + '.json'); noLinks(replacementPath);
      const replacementBytes = fs.readFileSync(replacementPath), replacement = parse(replacementBytes);
      const integrationPath = path.join(rt, 'queue', 'continuous-n88-integrated-class-student-journey-20261018.json'); noLinks(integrationPath);
      const integration = json(integrationPath);
      insist(replacement.id === update.card.supersededBy && integration.id === 'continuous-n88-integrated-class-student-journey-20261018', 'Historical replacement/integration identity changed');
      const replacementReceiptPath = path.join(rt, 'delivery', replacement.id, 'receipt.json'); noLinks(replacementReceiptPath);
      const integrationReceiptPath = path.join(rt, 'delivery', integration.id, 'receipt.json'); noLinks(integrationReceiptPath);
      const coverageSpec = payload.files.find(file => file.repoPath === update.card.historicalSupersession?.coverageEvidencePath);
      insist(coverageSpec && coverageSpec.sha256 === update.card.historicalSupersession.coverageEvidenceSha256, 'Reviewed historical coverage file is missing');
      historicalContext = { result, resultSha256: sha256(resultBytes), replacement, replacementSha256: sha256(replacementBytes), integration,
        replacementReceiptSha256: sha256(fs.readFileSync(replacementReceiptPath)), integrationReceiptSha256: sha256(fs.readFileSync(integrationReceiptPath)),
        coverage: JSON.parse(coverageSpec.content), coverageSha256: sha256(Buffer.from(coverageSpec.content, 'utf8')),
        assertAncestor: (older, newer) => { git(['merge-base', '--is-ancestor', older, newer], task.worktreePath); },
        readPublishedBlob: (publishedSha, repoPath) => git(['rev-parse', publishedSha + ':' + repoPath], task.worktreePath) };
    }
    verifyInactiveIdentity(task, result, update, payload.activationId, historicalContext);
    if(update.card.verificationPathRepair?.blockedJournalSha256||update.card.verificationPathRepair?.publishedJournalSha256){const jf=path.join(rt,'delivery',task.id,update.expected.candidateSha+'.journal.json');noLinks(jf);prepareVerificationJournalRepair(task,update,fs.readFileSync(jf));}
    insist(equalPath(task.worktreePath, path.join(root, '.worktrees', task.id)), 'Task worktree is outside its owned path');
    noLinks(task.worktreePath);
    insist(git(['rev-parse', 'HEAD'], task.worktreePath) === update.expected.candidateSha, 'Worktree HEAD differs from preserved candidate: ' + task.id);
    if(update.card.completionMode==='reconcile_live_service_publication'){
      const actual=buildLiveServiceEvidence(task,task.deliveryReceipt,p=>execFileSync(WIN_GIT,['show',task.candidateSha+':'+p],{cwd:task.worktreePath,windowsHide:true,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}));
      insist(same(actual,update.card.servicePublicationEvidence),'Declared service evidence differs from immutable candidate artifacts');
    }
    insist(!git(['status', '--porcelain=v1', '--untracked-files=no'], task.worktreePath), 'Candidate has tracked uncommitted changes: ' + task.id);
    if (update.expected.queuedBaseSha !== undefined) {
      const remoteMain = git(['ls-remote', '--heads', 'origin', 'refs/heads/main']).split(/\s+/)[0];
      insist(GIT_SHA.test(remoteMain), 'Published main binding missing');
      git(['merge-base', '--is-ancestor', update.expected.queuedBaseSha, result.baseSha], task.worktreePath);
      git(['merge-base', '--is-ancestor', result.baseSha, remoteMain], task.worktreePath);
      git(['merge-base', '--is-ancestor', result.baseSha, result.candidateSha], task.worktreePath);
    }

    if(update.card.completionMode==='reconcile_observed_publication') {
      const o=update.card.verificationRepair.observation;
      const head=git(['ls-remote','--heads','origin','refs/heads/main']).split(/\s+/)[0];
      insist(head===o.publishedSha || receipt.pushed && head===receipt.commit,'Main changed since read-only verification');
      for(const ancestor of [task.candidateSha,task.baseSha,o.publishedSha])git(['merge-base','--is-ancestor',ancestor,head],task.worktreePath);
      for(const asset of o.evidence.production.assets) {
        const raw=execFileSync(WIN_GIT,['show',head+':'+asset.repoPath],{cwd:task.worktreePath,maxBuffer:16*1024*1024,windowsHide:true});
        insist(sha256(raw)===asset.expectedSha256,'Observed Product asset changed: '+asset.repoPath);
      }
    }

    const owners = task.lastWorkerReap.owners, alive = inventory(owners.map(p => p.pid));
    for (const saved of owners) insist(!alive.some(p => p.pid === saved.pid && utcTicks(p.createdAt) === utcTicks(saved.createdAt)), 'An owned worker process remains alive: ' + task.id);
    return { file, raw, task, resultSha256: sha256(resultBytes), candidateSha: result.candidateSha, historicalContext };
  }
  try {
    noLinks(evidenceRoot); fs.mkdirSync(evidenceRoot, { recursive: true });
    record('LOCKED');
    noLinks(runtimeConfigPath); runtimeConfigBefore = fs.readFileSync(runtimeConfigPath);
    const config = parse(runtimeConfigBefore);
    insist(config.controller?.activationId === payload.activationId, 'Activation changed');
    if (plan.runtimeConfigUpdate) runtimeConfigPlan = prepareRuntimeConfigUpdate(runtimeConfigBefore, plan.runtimeConfigUpdate, payload.activationId);
    insist(!fs.existsSync(stopPath) && !fs.existsSync(path.join(rt, 'STOP-REFILL')), 'An existing stop marker requires its owner; it will not be removed');
    controller = json(path.join(rt, 'CONTROLLER_IDENTITY.json')); receipt.controllerBefore = controller;
    if (plan.controllerReload) {
      const expected = plan.controllerReload.expectedIdentity;
      insist(controller.pid === expected.pid && controller.instanceId === expected.instanceId && utcTicks(controller.createdAt) === utcTicks(expected.createdAt), 'Controller reload identity differs from review');
    }
    const prePause = inspectController();
    insist(Date.now() - Date.parse(prePause.at) < 25000 && Date.parse(prePause.at) <= Date.now() + 1000 && !prePause.deliveryInFlight && !fs.existsSync(path.join(rt, 'leases', 'integration.json')), 'Before STOP: a fresh publisher-idle snapshot is required');
    receipt.activeBefore = prePause.active; record('PRE_PAUSE_VERIFIED', { activeTaskIds: prePause.active.map(t => t.id) });
    stopBytes = bytes({ ...owner, purpose: 'Pause only new admission/delivery; existing allowed workers continue' });
    pausedAt = Date.now(); fs.writeFileSync(stopPath, stopBytes, { flag: 'wx' }); ownStop = true;
    let active;
    for (let i = 0; i < 20; i++) { active = pausedIdle(); if (active) break; await new Promise(resolve => setTimeout(resolve, 1000)); }
    insist(active, 'No fresh paused publisher-idle acknowledgement');
    receipt.activeBefore = active.active; record('PAUSED_PUBLISHER_IDLE', { activeTaskIds: active.active.map(t => t.id) });
    const catalogPath = path.join(rt, 'intake-catalog.json'); noLinks(catalogPath);
    beforeCatalog = fs.readFileSync(catalogPath); const catalog = parse(beforeCatalog);
    const pendingCompanions = sourceWrapperCompanions(payload).map(card => { const file=path.join(rt,'queue',card.id+'.json'); noLinks(file); const raw=fs.readFileSync(file), task=parse(raw); verifyPendingCompanion(card,task); insist(!catalog.tasks.some(t=>t.id===card.id),'Companion catalog identity already exists'); return {card,file,raw}; });
    insist(catalog.currentActivationId === payload.activationId && Array.isArray(catalog.tasks), 'Catalog activation changed');
    for (const update of payload.cardUpdates) {
      const state = exactInactive(update); queueBefore.set(update.card.id, state);
      const sourceSpec = payload.files.find(file => file.repoPath === payload.sourceCardFile);
      let bindingHash=sourceSpec.expectedCanonicalSha256,bindingFollowups=catalog.followupSources??[];
      // A committed/installed source may precede catalog activation when an exact guarded reload refuses.
      // Rebind only this original N88 pilot and the immutable owned partial receipt/payload.
      if(sourceSpec.partialInstallationRecovery?.receiptPath){
        const rec=sourceSpec.partialInstallationRecovery,rp=path.resolve(rec.receiptPath),pp=path.resolve(rec.payloadPath);
        insist(win(rp).startsWith(win(path.join(rt,'maintenance'))+'\\')&&win(pp).startsWith(win(path.join(rt,'intake-evidence'))+'\\'),'Partial evidence outside owned runtime');noLinks(rp);noLinks(pp);
        const rb=fs.readFileSync(rp),pb=fs.readFileSync(pp),pr=parse(rb);insist(equalPath(rp,path.join(rt,'maintenance',pr.taskId,pr.token,'receipt.json')),'Partial receipt identity/path changed');
        const recovery=reviewedOwnedPartialQueueRecovery(state.task,update,sourceSpec,rb,pb,bindingFollowups);git(['merge-base','--is-ancestor',recovery.partialCommit,'origin/main'],ops);bindingHash=recovery.bindingHash;bindingFollowups=recovery.followups;
      }else if(sourceSpec.partialInstallationRecovery){
        const rec=sourceSpec.partialInstallationRecovery;
        insist(state.task.id==='continuous-n88-official-student-portal-activation-20261018'&&state.task.sessionId==='01a14fc3-b292-7390-9952-8549a286c80f'&&state.task.status==='awaiting_po'&&state.task.stagedActivation?.phase==='pilot','Partial recovery task changed');
        const priorReceiptPath=path.join(rt,'maintenance','po-20261019-final-activation-and-ingress-transport','fd2d0f13-cd63-4440-8703-c650e0856c1f','receipt.json');
        const priorPayloadPath=path.join(rt,'intake-evidence','po-20261019-supabase28p01','transport-and-final-stage-maintenance.payload.json');
        noLinks(priorReceiptPath);noLinks(priorPayloadPath);
        const rb=fs.readFileSync(priorReceiptPath),pb=fs.readFileSync(priorPayloadPath),pr=parse(rb),pp=parse(pb),pf=pp.files?.find(f=>f.repoPath===payload.sourceCardFile);
        insist(rec.receiptSha256===sha256(rb)&&rec.payloadSha256===sha256(pb)&&pr.payloadSha256===sha256(pb)&&pr.status==='PARTIAL_FAILURE'&&pr.owner==='apply-reviewed-maintenance'&&pr.taskId===pp.taskId&&pr.activationId===payload.activationId,'Owned partial receipt binding changed');
        insist(pr.committed===true&&pr.pushed===true&&pr.commit==='a935127ef7c2c25e873355322c96c33189b924a9'&&pr.catalogUpdated===false&&pr.activatedTasks?.length===0&&pr.touchedWorkerProcesses?.length===0&&pr.cleanupErrors?.length===0&&pr.ownedPauseRemoved===true&&pr.ownedLockRemoved===true&&pr.error?.stderr?.includes('Controller command identity mismatch'),'Owned partial operation changed');
        insist(pr.installedPaths?.includes(payload.sourceCardFile)&&pf&&pf.sha256===sourceSpec.expectedCanonicalSha256&&sha256(Buffer.from(pf.content))===pf.sha256&&pp.cardUpdates?.length===1&&same(pp.cardUpdates[0].expected,update.expected)&&same(pp.cardUpdates[0].card,update.card),'Partial source/card identity differs');
        git(['merge-base','--is-ancestor',pr.commit,'origin/main'],ops);bindingHash=pf.expectedCanonicalSha256;
      }
      const binding = catalogSourceBinding(catalog.tasks, state.task, update, payload.sourceCardFile, bindingHash, bindingFollowups);
      sourceBindings.set(update.card.id, binding);
      const baselineChecks = binding.baseline.requiredChecks ?? [];
      const preservesChecks = baselineChecks.every(check => update.card.requiredChecks.includes(check));
      const n36PublisherGateSplit = update.card.id === 'continuous-n36-available-partial-class-import-no-total-cap-20261017'
        && binding.baseline.productId === 'N36' && update.card.productId === 'N36'
        && baselineChecks.includes('n36_versioned_package_SHA_and_published_source_parity')
        && !update.card.requiredChecks.includes('n36_versioned_package_SHA_and_published_source_parity')
        && update.card.requiredChecks.includes('n36_versioned_package_SHA_and_local_source_binding')
        && update.card.requiredChecks.length === baselineChecks.length
        && baselineChecks.filter(check => check !== 'n36_versioned_package_SHA_and_published_source_parity').every(check => update.card.requiredChecks.includes(check))
        && typeof update.card.objective === 'string' && update.card.objective.includes('VALIDATION CONTRACT REPAIR — 2026-10-17')
        && update.card.acceptance?.some(item => typeof item === 'string' && item.includes('Cloudflare provider/immutable/served Production parity'))
        && update.card.preparationAuthority?.publication === true;
      insist(preservesChecks || verifiedN36SetupDeliveryGateSplit(state.task,json(state.task.resultPath),update,binding.baseline) || verifiedN44SourceStageSplit(state.task,json(state.task.resultPath),update,json(path.join(rt,'queue','continuous-n44-one-approved-closed-page-push-20261019.json'))) || n36PublisherGateSplit || verifiedPilotPreparation(state.task,json(state.task.resultPath),update), 'This helper cannot remove required checks');
    }
    insist(!dirtyPaths().length, 'Ops checkout must be clean before maintenance');
    const common = cwd => path.resolve(cwd, git(['rev-parse', '--git-common-dir'], cwd));
    insist(equalPath(common(root), common(ops)), 'Ops checkout belongs to another repository');
    git(['fetch', '--no-write-fetch-head', '--no-tags', 'origin', 'main']);
    const remoteHead = git(['ls-remote', '--heads', 'origin', 'refs/heads/main']).split(/\s+/)[0]; insist(GIT_SHA.test(remoteHead), 'Cannot observe remote main');
    git(['cat-file', '-e', remoteHead + '^{commit}']); git(['merge', '--ff-only', remoteHead]);
    receipt.baseSha = git(['rev-parse', 'HEAD']); insist(receipt.baseSha === remoteHead, 'Ops checkout has unpublished commits; this helper will not include them');
    insist(!dirtyPaths().length, 'Ops checkout changed while preparing');
    for (const file of payload.files) {
      const canonicalFile = path.join(root, file.repoPath), opFile = path.join(ops, file.repoPath); noLinks(canonicalFile); noLinks(opFile);
      const original = read(canonicalFile); insist(sha256(original) === file.expectedCanonicalSha256, 'Canonical hash differs from review: ' + file.repoPath);
      const remoteEntry = gitRaw(['ls-tree', '-z', remoteHead, '--', file.repoPath]);
      const remoteBytes = remoteEntry ? Buffer.from(gitRaw(['show', remoteHead + ':' + file.repoPath]), 'utf8') : null;
      const approvedBinding = file.repoPath === payload.sourceCardFile ? [...sourceBindings.values()].find(binding => binding.kind === 'approved-note') : null;
      insist(reviewedSourcePreimageMatches(remoteBytes, read(opFile), original, file, approvedBinding?.approvedNoteSha256 ?? null), 'Remote main preimage differs from canonical review: ' + file.repoPath);
      opsPreimageHashes.set(file.repoPath, sha256(read(opFile)));
      if (original !== null) { const backup = path.join(evidenceRoot, 'before-files', file.repoPath); fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.writeFileSync(backup, original, { flag: 'wx' }); }
    }
    fs.writeFileSync(path.join(evidenceRoot, 'catalog-before.json'), beforeCatalog, { flag: 'wx' });
    if (runtimeConfigPlan) {
      insist(sha256(read(runtimeConfigPath)) === runtimeConfigPlan.beforeSha256, 'Runtime config changed before maintenance');
      fs.writeFileSync(path.join(evidenceRoot, 'runtime-config-before.json'), runtimeConfigBefore, { flag: 'wx' });
    }
    for (const [id, state] of queueBefore) fs.writeFileSync(path.join(evidenceRoot, id + '.before.json'), state.raw, { flag: 'wx' });
    record('PREFLIGHT_VERIFIED', { candidates: [...queueBefore].map(([id, s]) => ({ id, candidateSha: s.candidateSha, resultSha256: s.resultSha256, sessionId: s.task.sessionId ?? null, runId: s.task.attempt?.runId ?? null, supersedingPublishedSha: s.supersedingPublishedSha ?? null })) });

    for (const file of payload.files) { replaceGuarded(path.join(ops, file.repoPath), Buffer.from(file.content, 'utf8'), opsPreimageHashes.get(file.repoPath)); receipt.opsWrittenPaths.push(file.repoPath); }
    record('OPS_FILES_WRITTEN');
    const permitted = new Set(plan.files), dirty = dirtyPaths(); insist(dirty.every(p => permitted.has(p)), 'Unlisted ops change before staging');
    git(['-c', 'core.whitespace=-blank-at-eof,-blank-at-eol,-space-before-tab', 'diff', '--check']);
    if (dirty.length) {
      git(['add', '--', ...plan.files]);
      const staged = gitRaw(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean); insist(staged.length && staged.every(p => permitted.has(p)), 'Unlisted staged path');
      git(['-c', 'core.whitespace=-blank-at-eof,-blank-at-eol,-space-before-tab', 'diff', '--cached', '--check']); git(['commit', '-m', payload.commitMessage]); receipt.committed = true;
    }
    const commit = git(['rev-parse', 'HEAD']); receipt.commit = commit;
    if (receipt.committed) insist(gitRaw(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', commit]).split('\0').filter(Boolean).every(p => permitted.has(p)), 'Unlisted committed path');
    insist(!dirtyPaths().length, 'Unexpected remaining ops modifications');
    record('COMMITTED');
    insist(pausedIdle(), 'Pause lost before push'); git(['push', 'origin', 'HEAD:main']); receipt.pushed = true;
    insist(git(['ls-remote', '--heads', 'origin', 'refs/heads/main']).split(/\s+/)[0] === commit, 'Remote main changed after maintenance push'); record('PUSH_VERIFIED');
    for (const file of payload.files) {
      replaceGuarded(path.join(root, file.repoPath), Buffer.from(file.content, 'utf8'), file.expectedCanonicalSha256); receipt.installedPaths.push(file.repoPath); record('INSTALLING');
    }
    if (plan.controllerReload) {
      insist(pausedIdle(), 'Pause lost before reviewed controller reload');
      for (const file of ['scripts/ops-supervisor-v4/controller.mjs', 'scripts/ops-supervisor-v4/start-ops.ps1', 'artifacts/ops-supervisor-v4/operator-monitor/launch-ops-no-console.vbs']) noLinks(path.join(root, file));
      receipt.controllerReloadAttempted = true; record('CONTROLLER_RELOAD_STARTED');
      const script = buildControllerReloadScript({ reload: plan.controllerReload, repoRoot: root, runtimeRoot: rt, activationId: payload.activationId,
        maintenanceLockSha256: sha256(ownerBytes), stopSha256: sha256(stopBytes), pauseStartedAt: new Date(pausedAt).toISOString(), evidenceRoot });
      const reloaded = JSON.parse(ps(script, 55000));
      insist(reloaded.status === 'RELOADED_SINGLE_CURRENT_CONTROLLER' && reloaded.scheduledStarts === 1 && reloaded.controllerLockEdited === false && reloaded.queueEdited === false, 'Reviewed controller reload proof is incomplete');
      controller = reloaded.newIdentity; controllerReloaded = true;
      receipt.controllerReload = reloaded; insist(pausedIdle(), 'Replacement controller is not paused and idle'); record('CONTROLLER_RELOADED');
    }
    insist(pausedIdle(), 'Pause lost before card activation');
    insist(sha256(read(catalogPath)) === sha256(beforeCatalog), 'Catalog changed before activation');
    for (const update of payload.cardUpdates) { const fresh = exactInactive(update); insist(sha256(fresh.raw) === sha256(queueBefore.get(update.card.id).raw), 'Queue changed before activation: ' + update.card.id); }
    for(const p of pendingCompanions){insist(sha256(read(p.file))===sha256(p.raw),'Pending companion runtime changed');verifyPendingCompanion(p.card,json(p.file));}
    const at = new Date().toISOString();
    for (const update of payload.cardUpdates) {
      const binding = sourceBindings.get(update.card.id), index = catalog.tasks.findIndex(t => t.id === update.card.id);
      if (binding.kind === 'catalog') { insist(index === binding.index && index >= 0, 'Catalog source changed before activation'); catalog.tasks[index] = structuredClone(update.card); }
      else insist(index === -1, 'Approved-note task unexpectedly appeared in catalog');
    }
    if (payload.cardUpdates.length) {
      for(const p of pendingCompanions){catalog.tasks.push(Object.fromEntries(Object.entries(p.card).filter(([k])=>!RUNTIME_KEYS.has(k))));fs.writeFileSync(path.join(evidenceRoot,p.card.id+'.preserved-pending.json'),p.raw,{flag:'wx'});}
      receipt.preservedPendingCompanions=pendingCompanions.map(p=>({id:p.card.id,queueSha256:sha256(p.raw),queueChanged:false,sourceCardChanged:false}));
      catalog.updatedAt = at;
      catalog.followupSources = [...(catalog.followupSources ?? []), { commit, sourceFile: path.join(root, payload.sourceCardFile), sourceSha256: payload.files.find(f => f.repoPath === payload.sourceCardFile).sha256, updatedTaskIds: plan.taskIds, at, maintenanceToken: token }];
      replaceGuarded(catalogPath, bytes(catalog), sha256(beforeCatalog)); receipt.catalogUpdated = true; record('CATALOG_UPDATED');
      for (const update of payload.cardUpdates) {
        insist(pausedIdle(), 'Pause lost during activation');
        const previous = queueBefore.get(update.card.id);
        const state = update.card.completionMode === HISTORICAL_RUNTIME_MODE ? exactInactive(update) : previous;
        insist(sha256(state.raw) === sha256(previous.raw), 'Queue changed during historical classification');
        const revised = revisedTask(state.task, update, commit, at, state.historicalContext);
        if(update.card.verificationPathRepair?.blockedJournalSha256||update.card.verificationPathRepair?.publishedJournalSha256){const jf=path.join(rt,'delivery',state.task.id,update.expected.candidateSha+'.journal.json');noLinks(jf);const raw=fs.readFileSync(jf),next=prepareVerificationJournalRepair(state.task,update,raw);fs.writeFileSync(path.join(evidenceRoot,state.task.id+'.publisher-journal-before.json'),raw,{flag:'wx'});replaceGuarded(jf,bytes(next),sha256(raw));receipt.publisherJournalRepairs=[...(receipt.publisherJournalRepairs??[]),{taskId:state.task.id,candidateSha:update.expected.candidateSha,oldSha256:sha256(raw),newSha256:sha256(bytes(next)),stage:'reprepare',originalFailurePreserved:true,providerOperation:false}];record('PUBLISHER_JOURNAL_REPAIRED');}
        replaceGuarded(state.file, bytes(revised), sha256(state.raw));
        receipt.activatedTasks.push({ id: revised.id, status: revised.status, sessionId: revised.sessionId ?? null, runId: revised.attempt?.runId ?? null, candidateSha: revised.candidateSha ?? null, reason: update.materialReason }); record('CARD_ACTIVATED');
      }
    }
    if (runtimeConfigPlan) {
      insist(pausedIdle(), 'Pause lost before runtime capacity update');
      replaceGuarded(runtimeConfigPath, runtimeConfigPlan.content, runtimeConfigPlan.beforeSha256);
      receipt.runtimeConfigUpdated = true;
      const { content, ...binding } = runtimeConfigPlan;
      receipt.runtimeConfigUpdate = { ...binding, updatedAt: new Date().toISOString() }; record('RUNTIME_CONFIG_UPDATED');
      let observed;
      for (let i = 0; i < 20; i++) {
        const fresh = pausedIdle();
        if (fresh?.maxWorkers === runtimeConfigPlan.maxWorkers && Date.parse(fresh.at) >= Date.parse(receipt.runtimeConfigUpdate.updatedAt)) { observed = fresh; break; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      insist(observed, 'No fresh controller acknowledgement of reviewed runtime capacity');
      receipt.runtimeConfigUpdate.observedAt = observed.at; record('RUNTIME_CONFIG_OBSERVED');
    }
    receipt.activeAfter = json(path.join(rt, 'ACTIVE_TASKS.json')).active;
    receipt.status = 'INSTALLED_AND_ACTIVATED'; record('COMPLETE');
  } catch (error) {
    receipt.status = receipt.committed || receipt.opsWrittenPaths.length || receipt.pushed || receipt.installedPaths.length || receipt.runtimeConfigUpdated || receipt.controllerReloadAttempted || receipt.activatedTasks.length ? 'PARTIAL_FAILURE' : 'FAILED'; receipt.error = safeError(error);
    try { record('FAILED'); } catch (loggingError) { receipt.evidenceError = safeError(loggingError); }
  } finally {
    receipt.cleanupErrors = [];
    receipt.pauseCreated = ownStop;
    try { if (ownStop && read(stopPath)?.equals(stopBytes)) fs.unlinkSync(stopPath); receipt.ownedPauseRemoved = ownStop ? !read(stopPath)?.equals(stopBytes) : true; } catch (error) { receipt.cleanupErrors.push(safeError(error)); }
    try { if (ownsLock()) fs.unlinkSync(lockPath); receipt.ownedLockRemoved = !ownsLock(); } catch (error) { receipt.cleanupErrors.push(safeError(error)); }
    receipt.finishedAt = new Date().toISOString();
    if (receipt.cleanupErrors.length) receipt.status = 'PARTIAL_FAILURE';
    try { noLinks(evidenceRoot); fs.mkdirSync(evidenceRoot, { recursive: true }); replaceGuarded(path.join(evidenceRoot, 'receipt.json'), bytes(receipt), sha256(read(path.join(evidenceRoot, 'receipt.json')))); } catch (error) { receipt.finalEvidenceError = safeError(error); receipt.status = 'PARTIAL_FAILURE'; }
  }
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), mode = args[0]; insist(['--check', '--apply'].includes(mode) && args.length === 2, 'Usage: node apply-reviewed-maintenance.mjs --check|--apply payload.json');
    const raw = fs.readFileSync(path.resolve(args[1])), payload = parse(raw);
    if (mode === '--check') console.log(JSON.stringify({ status: 'LOCAL_PAYLOAD_CHECK_PASS', payloadSha256: sha256(raw), ...validatePayload(payload), liveStateChecked: false, mutationPerformed: false }));
    else { const result = await applyReviewedMaintenance(payload, sha256(raw)); console.log(JSON.stringify(result)); if (result.status !== 'INSTALLED_AND_ACTIVATED') process.exitCode = 1; }
  } catch (error) { console.error(JSON.stringify({ status: 'FAILED_BEFORE_APPLY_OR_LOCK', error: safeError(error) })); process.exitCode = 1; }
}

export function nativeGuardedReplacementScript(file,temp,expectedHash){
 return '$target='+literal(file)+'\n$h=[Security.Cryptography.SHA256]::Create();$s=[IO.File]::Open($target,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);try{$actual=([BitConverter]::ToString($h.ComputeHash($s))).Replace("-","").ToLowerInvariant()}finally{$s.Dispose();$h.Dispose()}\nif($actual -ne '+literal(expectedHash)+'){throw "Concurrent file change"}\n[IO.File]::Replace('+literal(temp)+',$target,[NullString]::Value)';
}

export function reviewedOwnedPartialQueueRecovery(task,update,spec,receiptRaw,payloadRaw,followups){
 const rec=spec.partialInstallationRecovery,pr=parse(receiptRaw),pp=parse(payloadRaw),pf=pp.files?.find(f=>f.repoPath===spec.repoPath);
 insist(task.id==='continuous-n88-official-student-portal-activation-20261018'&&task.sessionId==='01a14fc3-b292-7390-9952-8549a286c80f'&&task.status==='awaiting_po'&&task.stagedActivation?.phase==='pilot','Partial stage identity changed');
 insist(rec.receiptSha256===sha256(receiptRaw)&&rec.payloadSha256===sha256(payloadRaw)&&pr.payloadSha256===sha256(payloadRaw)&&pr.owner==='apply-reviewed-maintenance'&&pr.status==='PARTIAL_FAILURE'&&pr.taskId===pp.taskId&&pr.activationId===task.activationId,'Owned partial bytes/authority changed');
 insist(pr.committed===true&&pr.pushed===true&&pr.catalogUpdated===true&&GIT_SHA.test(pr.commit)&&pr.activatedTasks?.length===0&&pr.touchedWorkerProcesses?.length===0&&pr.cleanupErrors?.length===0&&pr.ownedPauseRemoved===true&&pr.ownedLockRemoved===true&&pr.error?.stderr?.includes('Get-FileHash')&&pr.error.stderr.includes('CommandNotFoundException'),'Partial queue failure disposition changed');
 insist(pr.installedPaths?.includes(spec.repoPath)&&pf&&pf.sha256===spec.expectedCanonicalSha256&&sha256(Buffer.from(pf.content))===pf.sha256&&spec.content===pf.content&&pp.cardUpdates?.length===1&&same(pp.cardUpdates[0].expected,update.expected)&&same(pp.cardUpdates[0].card,update.card),'Installed partial card/source changed');
 const chain=followups.filter(x=>x.updatedTaskIds?.includes(task.id)),latest=chain.at(-1);
 insist(latest?.commit===pr.commit&&latest.sourceSha256===pf.sha256&&latest.maintenanceToken===pr.token&&!task.recoveryHistory?.some(e=>e.commit===pr.commit),'Catalog/queue partial boundary changed');
 return {bindingHash:pf.expectedCanonicalSha256,followups:followups.filter(x=>x!==latest),partialCommit:pr.commit};
}
