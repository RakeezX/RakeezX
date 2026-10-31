import {publicationRuntimeAllowed} from './activation/v2-runtime-writer-1031/capability.mjs';
/** AI: INACTIVE canonical/session binding. No route, env, DSN, SQL dispatcher,
 * provider activation or positive issuance. Hosted finite boundary is unchanged.
 * Reuses actual teacher SDK verifier, numeric READ handler, canonical adapter,
 * complete canonical reader and original owner-key/row locking contracts.
 */
import { createHash } from 'node:crypto';
import { createTeacherVerifier } from './auth-verifier.mjs';
import { createNumericCredentialOperations } from './numeric-credentials.mjs';
import { createCanonicalAdapter } from './canonical-adapter.mjs';
import { readCanonical } from './integrated-service.mjs';
import { studentPortalPublicationBindings } from './student-projection.mjs';
import { createPublicationV2PostgresPorts } from './publication-v2-postgres.inactive.mjs';
import { proposePublicationRows, samePublicationScope } from '../../src/lib/n88-item-publication-proposal.js';
import {parseStudentScopePath} from './web-protocol.mjs';
import {readStudentLabels} from './activation/v2-student-scope-1031/labels.mjs';

const fail = () => { throw Error('n88_v2_canonical_unavailable'); };
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const active = r => r && !r.deleted && r.deletedAt == null && r.archivedAt == null;
const flagsOff = () => ({ required: false, scheduled: false, completed: false, grade: false });
const clockDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now()));
const receiptScope = (c, owner, teachingId) => {
  const t = c.teachings.find(t => t.id === teachingId && t.ownerId === owner && active(t));
  if (!t) fail();
  return { ownerId: owner, teachingId: t.id, sectionId: t.sectionId, termId: t.termId, subjectId: t.subjectId };
};

export function createCanonicalPublicationV2Ports({ executionMode, runtimeCapability, repository, teacher, numeric, rollout,
  verifyIngress, origin, now = Date.now, onVerifiedIdentity }) {
  if (!publicationRuntimeAllowed(executionMode,runtimeCapability) || typeof verifyIngress !== 'function' ||
      typeof now !== 'function' || !rollout?.configured || !numeric) fail();
  const verifyTeacher = createTeacherVerifier({ ...teacher, now });
  const numbers = createNumericCredentialOperations({ ...numeric, rollout, now });
  const synchronize = createCanonicalAdapter({ rollout });
  const admission = new WeakMap(), ingress = new WeakMap(), tickets = new WeakMap();
  const admitted = async (request, tx) => {
    let record = ingress.get(tx);
    if (!record) { record = { request, result: await verifyIngress(request, tx) }; ingress.set(tx, record); }
    if (record.request !== request || !record.result?.clientKey) fail();
    return record.result; // Original verified ingress, same transaction/request ONLY.
  };
  const read = async (tx, owner) => readCanonical(tx, owner); // Existing bounded 13-family reader/locks.
  const snapshot = async (tx, auth, scope) => {
    if (!samePublicationScope(scope, scope) || scope.ownerId !== auth.ownerId) fail();
    const c = await read(tx, auth.ownerId);
    if (!samePublicationScope(receiptScope(c, auth.ownerId, scope.teachingId), scope)) fail();
    proposePublicationRows({ scope, data: { ...c, ownerId: auth.ownerId } });
    const section = c.sections.find(s => s.id === scope.sectionId), term = c.terms.find(t => t.id === scope.termId);
    const year = c.years.find(y => y.id === section?.yearId), today = clockDate(now);
    if (![section, term, year].every(r => active(r) && r.status === 'active') ||
        term.startDate && term.startDate > today || term.endDate && term.endDate < today ||
        !rollout.admitsTeacher({ ownerId: auth.ownerId, current: true }, { ownerId: auth.ownerId, current: true,
          classId: scope.sectionId, teachingId: scope.teachingId })) fail();
    return { canonical: c, now: today };
  };
  const ports = createPublicationV2PostgresPorts({ executionMode, runtimeCapability, repository,
    authenticate: async (request, tx, role) => {
      await admitted(request, tx);
      if (role === 'teacher') {
        const auth = await verifyTeacher(request.headers?.authorization, request.signal, tx);
        if (!auth?.current || !rollout.allowsOwner(auth.ownerId)) return null;
        // Optional trusted host observer, never request authority. The original
        // verifier/locks already succeeded; service admission still needs context.
        await onVerifiedIdentity?.({ role, auth }, request, tx);
        const contexts = await tx.query('select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share', [auth.ownerId]);
        if (contexts.rows.length !== 1 || contexts.rows[0].active !== true) return null;
        admission.set(tx, { role, auth }); return auth;
      }
      if (role !== 'student' || request.method !== 'GET') return null;
      // A bounded locator ONLY; authentication remains the original numeric READ
      // handler below, not this cookie parse or a caller-supplied owner/student.
      const token = /(?:^|;\s*)__Secure-n88-student=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.headers?.cookie ?? '')?.[1];
      if (!token) return null;
      const found = await tx.query('select payload from n88_private.numeric_sessions where token_hash=$1 for share',
        [createHash('sha256').update(token).digest('hex')]);
      if (found.rows.length !== 1) return null;
      const s = found.rows[0].payload;
      const credentials = await tx.query('select payload from n88_private.numeric_credentials where id=$1::uuid and owner_id=$2::uuid and student_id=$3 and version=$4::bigint for share',
        [s.credentialId, s.ownerId, s.studentId, String(s.version)]);
      const contexts = await tx.query('select namespace,owner_id,active from n88_private.contexts where owner_id=$1::uuid for share', [s.ownerId]);
      if (credentials.rows.length !== 1 || contexts.rows.length !== 1) return null;
      const db = { contexts: contexts.rows.map(r => ({ namespace: r.namespace, ownerId: r.owner_id, active: r.active })),
        memberships: [], sessions: [], publications: [], numericCredentials: [credentials.rows[0].payload], numericSessions: [s] };
      let current;
      const handler = numbers.createStudentHandler({ origin,
        repository: { transaction: action => action(db, { query: tx.query,
          synchronizeOwner: owner => synchronize(db, tx, owner) }) },
        verifyIngress: () => admitted(request, tx),
        project: async (_db, member) => {
          const c = await read(tx, member.ownerId), today=clockDate(now),selector=parseStudentScopePath(request.path,'');
          if(!selector)fail();
          current = { ownerId: member.ownerId, sessionId: s.id, studentId: member.studentId,
            enrollmentId: member.enrollmentId, scope:null, current: true };
          // Numeric READ has already verified this exact current member/session.
          await onVerifiedIdentity?.({role,auth:current,numeric:{tokenHash:s.tokenHash,credentialId:s.credentialId,studentId:s.studentId,version:String(s.version)},expiresAt:s.expiresAt},request,tx);
          const labels=await readStudentLabels(tx,member.ownerId,member.classId,s.id,today),eligible=[];
          for(const t of c.teachings){
            if(t.ownerId!==member.ownerId||t.sectionId!==member.classId||!active(t))continue;
            const term=c.terms.find(r=>r.id===t.termId&&r.ownerId===member.ownerId),section=c.sections.find(r=>r.id===member.classId&&r.ownerId===member.ownerId),year=c.years.find(r=>r.id===section?.yearId&&r.ownerId===member.ownerId);
            if(![term,section,year].every(r=>active(r)&&r.status==='active')||term.yearId!==section.yearId||term.startDate&&term.startDate>today||term.endDate&&term.endDate<today)continue;
            if(!rollout.admitsTeacher({ownerId:member.ownerId,current:true},{ownerId:member.ownerId,current:true,classId:member.classId,teachingId:t.id}))continue;
            const label=labels.find(r=>r.teaching_id===t.id&&r.subject_id===t.subjectId&&r.term_id===t.termId);if(!label)fail();
            studentPortalPublicationBindings({canonical:c,ownerId:member.ownerId,studentId:member.studentId,enrollmentId:member.enrollmentId,classId:member.classId,termId:t.termId,now:today});
            eligible.push({scope:receiptScope(c,member.ownerId,t.id),subject:label.subject_name,term:label.term_name});
          }
          if(eligible.length>2000)fail();
          const choices=eligible.map(e=>({teachingId:e.scope.teachingId,label:e.subject+(eligible.filter(v=>v.subject===e.subject).length>1?' — '+e.term:'')}));
          let selected=selector.teachingId;
          if(selected&&!eligible.some(e=>e.scope.teachingId===selected))fail();
          if(!selected&&eligible.length===1)selected=eligible[0].scope.teachingId;
          current={...current,scope:selected?eligible.find(e=>e.scope.teachingId===selected).scope:null,choices,
            selectionState:selected?'selected':choices.length?'choice':'empty',
            eligibilityRevision:createHash('sha256').update(JSON.stringify([c,labels,choices])).digest('hex')};
          return {}; // Internal admission only: no source/score payload escapes.
        },
      });
      const result = await handler({ ...request, path: '/student/read' });
      if (result.status !== 200 || !current) return null;
      await onVerifiedIdentity?.({ role, auth: current, numeric: { tokenHash: s.tokenHash,
        credentialId: s.credentialId, studentId: s.studentId, version: String(s.version) }, expiresAt: s.expiresAt }, request, tx);
      admission.set(tx, { role, auth: current }); return Object.freeze(current);
    },
    readCurrent: async (tx, auth, scope) => {
      const admitted = admission.get(tx);
      if (!admitted || admitted.auth.ownerId !== auth.ownerId || admitted.auth.sessionId !== auth.sessionId ||
          admitted.role === 'student' && !samePublicationScope(admitted.auth.scope, scope)) fail();
      return snapshot(tx, auth, scope);
    },
  });

  /** A server lifecycle captures a capability BEFORE its existing canonical
   * write, and completes it AFTER parent/child deletion in the SAME tx. This
   * exports no mutation dispatcher/query port and installs no trigger or route.
   */
  const captureRetirement = async (tx, scope, kind, sourceId, expectedRevision) => {
    const a = admission.get(tx);
    if (a?.role !== 'teacher' || !['item', 'subitem'].includes(kind) || !id(sourceId)) fail();
    await tx.bindOwner(a.auth.ownerId);
    const { canonical: c } = await snapshot(tx, a.auth, scope);
    const item = kind === 'item' ? c.items.find(r => r.id === sourceId) :
      c.items.find(r => r.id === c.scoreSubitems.find(s => s.id === sourceId)?.itemId);
    const source = kind === 'item' ? item : c.scoreSubitems.find(s => s.id === sourceId);
    if (!active(item) || !active(source) || item.teachingId !== scope.teachingId || source.revision !== expectedRevision) fail();
    const retired = [{ table: kind === 'item' ? 'items' : 'scoreSubitems', id: source.id, revision: source.revision }];
    if (kind === 'item') for (const s of c.scoreSubitems.filter(s => s.itemId === item.id)) retired.push({ table: 'scoreSubitems', id: s.id, revision: s.revision });
    const ticket = Object.freeze({});
    const pending = { tx, auth: a.auth, scope: structuredClone(scope), kind, sourceId, retired, complete: false };
    tickets.set(ticket, pending);
    tx.beforeCommit(async () => {
      if (!pending.complete) fail();
      const current = await read(tx, pending.auth.ownerId);
      for (const r of pending.retired) {
        const row = current[r.table].find(row => row.id === r.id);
        if (row && (active(row) || BigInt(row.revision) <= BigInt(r.revision))) fail();
      }
    });
    return ticket;
  };
  const completeRetirement = async (tx, ticket) => {
    const plan = tickets.get(ticket), a = admission.get(tx);
    if (!plan || plan.tx !== tx || plan.complete || a?.role !== 'teacher' || a.auth.sessionId !== plan.auth.sessionId) fail();
    const after = await read(tx, plan.auth.ownerId);
    for (const r of plan.retired) {
      const row = after[r.table].find(row => row.id === r.id);
      if (row && (active(row) || BigInt(row.revision) <= BigInt(r.revision))) fail();
    }
    let scopes = tx.state.scopes.filter(s => s.scope.teachingId === plan.scope.teachingId);
    if (!scopes.length) {
      const stored = { scope: plan.scope, manualTasks: [], publications: [], sourceVersions: [] };
      tx.state.scopes.push(stored); scopes = [stored];
    }
    for (const s of scopes) {
      for (const r of plan.retired) {
        const key = r.table + ':' + r.id, row = after[r.table].find(row => row.id === r.id);
        const v = s.sourceVersions.find(v => v.key === key);
        const revision = row?.revision ?? r.revision;
        if (v) { if (BigInt(revision) < BigInt(v.revision)) fail(); v.revision = revision; v.retired = true; }
        else s.sourceVersions.push({ key, revision, retired: true });
      }
      for (const p of s.publications) {
        const [kind, parent, id] = JSON.parse(p.rowId);
        if (!p.tombstone && (plan.kind === 'item' ? kind !== 'manual' && parent === plan.sourceId : kind === 'subitem' && id === plan.sourceId)) {
          p.publicationRevision++; p.tombstone = true; p.decisions = flagsOff();
        }
      }
    }
    plan.complete = true; // Existing adapter atomically flushes source history/CAS;
    // canonical mutation and tombstones share original repository COMMIT/rollback.
  };
  return Object.freeze({ ...ports, captureRetirement, completeRetirement });
}
