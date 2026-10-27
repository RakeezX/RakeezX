/** AI-authored INACTIVE transaction review. No runtime import, routes, I/O or activation.
 * These functions operate ONLY on an already locked transaction draft. `verified`
 * is a server-owned, synchronized snapshot, NOT a browser binding or Auth proof.
 * A repository must revalidate Auth/source at COMMIT and withhold every ACK until
 * durable COMMIT. Never call admission, issue and record in separate transactions.
 */
import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields = ['ownerId','sessionId','leaseId','teachingId','classId','termId','contextRevision'];
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value,k));
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.includes('\0');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const requestId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(value);
const unknown = () => ({resolutionVersion:1,state:'unknown',created:0,skipped:0,failed:0});
const closed = () => ({...unknown(),state:'closed'});
const commandKeys = ['binding','requestId','expectedRosterRevision','expectedCredentialRevision'];
const bound = (v,r) => fields.every(k => id(v?.[k]) && r.binding[k] === v[k]);
const fingerprint = (kind,v,r) => digest(['n88-terminal-review-v1',kind,
  fields.map(k => v[k]),r.requestId,r.expectedRosterRevision,r.expectedCredentialRevision]);

function valid(db,v,r,now) {
  return exact(r,commandKeys) && exact(r.binding,fields) && bound(v,r) &&
    requestId(r.requestId) && hex(r.expectedRosterRevision) && hex(r.expectedCredentialRevision) &&
    v.current === true && Number.isSafeInteger(now) && Number.isSafeInteger(v.validUntil) && v.validUntil > now &&
    hex(v.rosterRevision) && hex(v.credentialRevision) && Array.isArray(v.members) && v.members.length <= 2000 &&
    v.members.every(m => id(m.studentId) && id(m.enrollmentId) && m.ownerId === v.ownerId && m.classId === v.classId) &&
    new Set(v.members.map(m => m.studentId)).size === v.members.length &&
    new Set(v.members.map(m => m.enrollmentId)).size === v.members.length &&
    Array.isArray(db?.classReceipts) && db.classReceipts.length <= 10000;
}
function validResults(rows,v) {
  return Array.isArray(rows) && rows.length === v.members.length &&
    new Set(rows.map(r => r?.studentId)).size === rows.length && rows.every(r =>
      r && Object.keys(r).every(k => ['studentId','enrollmentId','credentialVersion','status','reason'].includes(k)) &&
      v.members.some(m => m.studentId === r.studentId && m.enrollmentId === r.enrollmentId) &&
      Number.isSafeInteger(r.credentialVersion) && r.credentialVersion >= 0 &&
      ['created','skipped','failed'].includes(r.status) &&
      (r.status !== 'created' || r.credentialVersion > 0) &&
      (!Object.hasOwn(r,'reason') || ['existing','revoked_rotate_required','revoked','unavailable'].includes(r.reason)));
}
function inspect(db,v,r) {
  const rows = db.classReceipts.filter(x => x?.ownerId === v.ownerId && x.requestId === r.requestId);
  if (!rows.length) return {absent:true,ack:unknown()};
  if (rows.length !== 1) return {absent:false,ack:unknown()};
  const row = rows[0];
  if (!exact(row,['ownerId','requestId','binding','results'])) return {absent:false,ack:unknown()};
  if (row.binding === fingerprint('closed',v,r) && Array.isArray(row.results) && row.results.length === 0)
    return {absent:false,ack:closed()};
  if (row.binding === fingerprint('committed',v,r) && validResults(row.results,v))
    return {absent:false,ack:{...unknown(),state:'committed',...Object.fromEntries(
      ['created','skipped','failed'].map(k => [k,row.results.filter(x => x.status === k).length]))}};
  // Legacy batch digests do not prove the full original session/context. Immutable
  // malformed/mismatched/partial receipts are never repaired, overwritten or erased.
  return {absent:false,ack:unknown()};
}
const unchanged = (v,r) => r.expectedRosterRevision === v.rosterRevision &&
  r.expectedCredentialRevision === v.credentialRevision;

/** Status is strictly read-only, including for an absent receipt. Close reserves
 * the ORIGINAL owner/request key permanently; it is not a new revoke/issue ID.
 * An old issuer encountering this distinct digest returns stale_request before
 * issuing. A reviewed issuer uses the same key and recognizes the terminal fence.
 */
export function reviewTerminalTransaction(db,verified,request,mode,now) {
  if (!['close','status'].includes(mode) || !valid(db,verified,request,now)) return unknown();
  const prior = inspect(db,verified,request);
  if (!prior.absent || mode === 'status') return prior.ack;
  if (!unchanged(verified,request) || db.classReceipts.length >= 10000) return unknown();
  db.classReceipts.push({ownerId:verified.ownerId,requestId:request.requestId,
    binding:fingerprint('closed',verified,request),results:[]});
  return closed(); // provisional until the enclosing repository's durable COMMIT
}

/** Admission for the hypothetical fully bound issuer, within the SAME transaction
 * as member savepoints, credential writes, recovery writes and recordReviewedCommit.
 * This is not permission to retry UNKNOWN under another ID or issue from the UI.
 */
export function reviewIssueAdmission(db,verified,request,now) {
  if (!valid(db,verified,request,now)) return {mayIssue:false,ack:unknown()};
  const prior = inspect(db,verified,request);
  return {mayIssue:prior.absent && unchanged(verified,request) && db.classReceipts.length < 10000,ack:prior.ack};
}

/** Record a complete batch outcome, including honest per-member failures. The
 * verified input remains the locked PRE-issue snapshot. No codes enter receipts.
 * Call only after member operations in that transaction; this helper cannot prove
 * those operations happened and is deliberately not a service implementation.
 */
export function recordReviewedCommit(db,verified,request,results,now) {
  if (!reviewIssueAdmission(db,verified,request,now).mayIssue || !validResults(results,verified))
    throw Error('n88_terminal_review_denied');
  const receipt={ownerId:verified.ownerId,requestId:request.requestId,
    binding:fingerprint('committed',verified,request),results:structuredClone(results)};
  if (Buffer.byteLength(JSON.stringify(receipt)) > 1048576) throw Error('n88_terminal_review_denied');
  db.classReceipts.push(receipt);
  return inspect(db,verified,request).ack;
}
