/** Explicit, local-only support capture. Never calls a provider or writes app data. */
import * as store from '../store.js';
import * as cloud from './cloud.js';
import { currentNotificationContext } from './notification-events.js';
import { getSyncOperationalSummary } from './sync.js';
import { dateControlBounds, validDateTimeValue } from './rakeez-datetime-values.js';
const GRANT = 'efedbcea-f227-4a91-bbab-79cad814fc81';
const TASK = 'n44-core-live-1028';
const requireValue = (ok, code) => { if (!ok) throw new Error(code); };
const exact = (v, keys) => requireValue(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === keys.sort().join(), 'challenge_shape');
export async function readinessHash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export function validateSourceChallenge(raw, now = Date.now()) {
  requireValue(typeof raw === 'string' && raw.length <= 8192, 'challenge_size');
  const c = JSON.parse(raw);
  exact(c, ['version','taskId','grantId','runId','nonce','issuedAt','expiresAt','ownerHash','workspaceHash','dueAt','publicKey']);
  requireValue(c.version === 1 && c.taskId === TASK && c.grantId === GRANT, 'challenge_authority');
  requireValue(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(c.runId) && /^[a-f0-9]{64}$/.test(c.nonce), 'challenge_identity');
  requireValue([c.issuedAt,c.expiresAt,c.dueAt].every(Number.isSafeInteger) && c.issuedAt <= now && c.expiresAt > now && c.expiresAt - c.issuedAt <= 300000, 'challenge_expired');
  requireValue(/^[a-f0-9]{64}$/.test(c.ownerHash) && /^[a-f0-9]{64}$/.test(c.workspaceHash), 'challenge_scope');
  requireValue(c.dueAt > now && c.dueAt - now <= 7 * 86400000 && (c.dueAt + 10800000) % 86400000 === 0, 'challenge_time');
  exact(c.publicKey, ['kty','n','e']);
  requireValue(c.publicKey.kty === 'RSA' && c.publicKey.e === 'AQAB' && /^[A-Za-z0-9_-]{342,683}$/.test(c.publicKey.n), 'challenge_key');
  return c;
}
const metadataFields = ['id','ownerId','serverRevision','deleted','syncCreatePending','termId','yearId','sectionId','subjectId','status','startDate','endDate'];
const pick = row => row && Object.fromEntries(metadataFields.map(k => [k, row[k]]));
function selectedRows(id) {
  const teaching = store.getTeaching(id), term = store.getTerm(teaching?.termId);
  return { teaching, term, year: store.getYear(term?.yearId), section: store.getSection(teaching?.sectionId), subject: store.getSubject(teaching?.subjectId) };
}
function sourceIds(id, owner) {
  const own = r => !r.deleted && (r.ownerId == null || r.ownerId === owner);
  const parents = store.state.items.filter(r => own(r) && r.teachingId === id).map(r => r.id);
  const ids = [...parents, ...store.state.scoreSubitems.filter(r => own(r) && parents.includes(r.itemId)).map(r => r.id), ...store.state.sessions.filter(r => own(r) && r.teachingId === id).map(r => r.id)];
  requireValue(ids.length <= 2000 && ids.every(id => typeof id === 'string' && id.length <= 200), 'source_bound');
  return [...new Set(ids)].sort();
}
const used = new Set();
/** Called only by the mounted teaching view; no dependency injection or globals. */
export async function captureNotificationSourceReadiness(raw, teachingId, mountedElement) {
  let stage = 'challenge';
  try {
  const c = validateSourceChallenge(raw);
  stage = 'context';
  const context = currentNotificationContext(store, cloud);
  requireValue(context && mountedElement?.isConnected, 'context_unavailable');
  const workspace = store.getActiveWorkspace(), session = cloud.session, route = location.hash;
  const initial = selectedRows(teachingId), refs = Object.values(initial);
  const checkpoint = () => {
    requireValue(mountedElement.isConnected && location.hash === route && cloud.session === session && store.getActiveWorkspace() === workspace, 'context_replaced');
    requireValue(JSON.stringify(currentNotificationContext(store, cloud)) === JSON.stringify(context), 'owner_changed');
    requireValue(store.classOperationsStatus(teachingId) === null && store.getOfflineLeaseStatus().editable, 'not_writable');
    requireValue(!document.querySelector('dialog[open], [role="dialog"], form'), 'draft_open');
    const rows = selectedRows(teachingId);
    requireValue(Object.values(rows).every((r,i) => r && r === refs[i] && !r.deleted && (r.ownerId == null || r.ownerId === context.ownerId) && !r.syncCreatePending && !store.isLocalOnlyRecord(r) && Number.isSafeInteger(r.serverRevision) && r.serverRevision > 0), 'ancestry_unconfirmed');
    requireValue(rows.section.yearId === rows.year.id && rows.year.status === 'active' && !store.isTermClosed(rows.term.id) && !store.isTeachingArchived(rows.teaching), 'ancestry_inactive');
    return JSON.stringify({ rows: Object.fromEntries(Object.entries(rows).map(([k,r]) => [k,pick(r)])), sources: sourceIds(teachingId,context.ownerId) });
  };
  stage = 'ancestry';
  const before = checkpoint();
  stage = 'scope';
  requireValue(await readinessHash(context.ownerId) === c.ownerHash && await readinessHash(context.workspaceId) === c.workspaceHash, 'scope_mismatch');
  stage = 'key_import';
  const key = await crypto.subtle.importKey('jwk', c.publicKey, { name:'RSA-OAEP', hash:'SHA-256' }, false, ['encrypt']);
  requireValue(key.algorithm.modulusLength >= 2048 && key.algorithm.modulusLength <= 4096, 'key_size');
  requireValue(checkpoint() === before, 'snapshot_changed');
  stage = 'sync';
  const sync = await getSyncOperationalSummary();
  const healthy = value => value.state === 'synced' && value.cloudSyncHealthy === true && !value.studentLifecycleInFlight && !value.classDeletionInFlight && ['queuedCount','pendingCount','failedCount','blockedCount','rejectedCount'].every(k => value[k] === 0);
  requireValue(healthy(sync), 'sync_pending');
  requireValue(checkpoint() === before, 'snapshot_changed');
  requireValue(Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Riyadh', 'timezone');
  stage = 'calendar';
  const date = new Date(c.dueAt + 10800000).toISOString().slice(0,10);
  const bounds = dateControlBounds('session', initial.term.startDate, initial.term.endDate, new Date());
  requireValue(validDateTimeValue(date,'date',bounds.min,bounds.max) && store.isSessionEligibleDate(date,{year:initial.year,term:initial.term}), 'calendar');
  requireValue(validDateTimeValue('00:15','time') && validDateTimeValue('00:45','time'), 'lesson_time');
  stage = 'reservation';
  const challengeDigest = await readinessHash(JSON.stringify(c));
  requireValue(!used.has(challengeDigest) && used.size < 32, 'challenge_used');
  used.add(challengeDigest);
  stage = 'encryption';
  const payload = { version:1, kind:'n44-source-readiness', taskId:TASK, grantId:GRANT, runId:c.runId, nonce:c.nonce, challengeDigest,
    observedAt:Date.now(), documentCheckpoint:crypto.randomUUID(), ownerId:context.ownerId, workspaceId:context.workspaceId,
    captureDevice:{ deviceId:context.deviceId, role:'read-only-capture', sendRecipientVerified:false },
    ancestry:Object.fromEntries(Object.entries(initial).map(([k,r]) => [k,pick(r)])), existingSourceIds:sourceIds(teachingId,context.ownerId),
    sync:{state:sync.state,queuedCount:0,pendingCount:0,failedCount:0,blockedCount:0,rejectedCount:0},
    proposed:{dueAt:c.dueAt,lessonStart:c.dueAt+900000,lessonEnd:c.dueAt+2700000,timezone:'Asia/Riyadh',lessonLeadMinutes:15,dateAllowed:true,testAuthority:GRANT,records:3,studentWrites:0,gradeWrites:0}, clockStarted:false };
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  requireValue(plain.length <= 131072, 'receipt_size');
  const aes = await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']), iv = crypto.getRandomValues(new Uint8Array(12));
  const secret = new Uint8Array(await crypto.subtle.exportKey('raw',aes));
  try {
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,plain));
    const b64 = bytes => btoa(Array.from(new Uint8Array(bytes),b => String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    const envelope = {key:b64(await crypto.subtle.encrypt({name:'RSA-OAEP'},key,secret)),iv:b64(iv),tag:b64(encrypted.slice(-16)),ciphertext:b64(encrypted.slice(0,-16))};
    stage = 'final_checkpoint';
    requireValue(healthy(await getSyncOperationalSummary()), 'sync_pending');
    validateSourceChallenge(raw); requireValue(checkpoint() === before, 'snapshot_changed');
    return {version:1,kind:payload.kind,taskId:TASK,grantId:GRANT,runId:c.runId,nonce:c.nonce,challengeDigest,observedAt:payload.observedAt,documentCheckpoint:payload.documentCheckpoint,envelope};
  } finally { plain.fill(0); secret.fill(0); }
  } catch (error) {
    // Only a fixed stage crosses to the support UI; no message/stack/context logging.
    const failure = new Error(typeof error?.message === 'string' ? error.message : 'unavailable');
    failure.name = error?.name;
    failure.sourceReadinessStage = stage;
    throw failure;
  }
}
