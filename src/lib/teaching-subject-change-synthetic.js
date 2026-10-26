/**
 * DEMO ONLY: atomic local proof of a pristine material selection correction.
 * No Product runtime imports this module. No real Cloud RPC is enabled.
 */
import * as defaultDB from './db.js';
import { STORES } from './db.js';
import { reviewTeachingSubjectChange } from './teaching-subject-change-review.js';

export const SUBJECT_CORRECTION_SYNTHETIC_PROTOCOL = 'SUBJECT_CORRECTION_SYNTHETIC_V1';
const problem=(code)=>Object.assign(new Error(code),{code});

/**
 * Mutates ONLY the demo Teaching and one synthetic outbox envelope.
 * Every Product dependency is checked from the SAME write transaction.
 * A real equivalent must use an authenticated, owner-bound server CAS and a
 * verifiable receipt, not this local mock.
 */
export function createSyntheticSubjectCorrection({
  database=defaultDB,currentOwner,clock=()=>Date.now(),enabled=false,
}={}) {
  const guard=(ownerId)=>{
    if(enabled!==true || database.getActiveDatabaseName()!=='rakeezx-demo')
      throw problem('SUBJECT_CORRECTION_DEMO_ONLY');
    if(typeof ownerId!=='string'||!ownerId||
        typeof currentOwner!=='function'||currentOwner()!==ownerId)
      throw problem('SUBJECT_CORRECTION_OWNER_CONTEXT_CHANGED');
  };
  async function apply({ownerId,teachingId,targetSubjectId,currentTermId}={}) {
    guard(ownerId);
    let planned=null,updated=null,envelope=null;
    const batch=Object.fromEntries(STORES.map(name=>[name,{}]));
    await database.applyBatch(batch,{productWrite:true,prepare(current){
      guard(ownerId);
      planned=reviewTeachingSubjectChange({snapshot:current,teachingId,
        targetSubjectId,ownerId,currentTermId});
      if(planned.status!=='preflight_ready')
        throw problem('SUBJECT_CORRECTION_PREFLIGHT_'+planned.reason.toUpperCase());
      const source=current.teachings.find(r=>r.id===teachingId&&!r.deleted);
      if(!source || source.subjectId!==planned.affected.sourceSubjectId)
        throw problem('SUBJECT_CORRECTION_SNAPSHOT_CHANGED');
      // No mutation without stable modern surrogate identity. Old natural IDs
      // embed the subject and cannot safely be reinterpreted.
      if(!/^tch:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.id))
        throw problem('SUBJECT_CORRECTION_LEGACY_TEACHING_ID');
      const timestamp=Math.max(Number(clock()),Number(source.updatedAt??0)+1);
      if(!Number.isSafeInteger(timestamp)||timestamp<=0)
        throw problem('SUBJECT_CORRECTION_INVALID_TIMESTAMP');
      const revision=Number(source.serverRevision??0);
      if(!Number.isSafeInteger(revision)||revision<0)
        throw problem('SUBJECT_CORRECTION_REVISION_INVALID');
      updated={...source,subjectId:targetSubjectId,updatedAt:timestamp,
        syncStatus:'synthetic_subject_correction_pending'};
      envelope={
        id:'subject-correction-synthetic:'+source.id,
        protocol:SUBJECT_CORRECTION_SYNTHETIC_PROTOCOL,
        ownerId,teachingId:source.id,sectionId:source.sectionId,termId:source.termId,
        priorSubjectId:source.subjectId,targetSubjectId,
        baseRevision:revision,updatedAt:timestamp,state:'pending',
      };
      return {teachings:{put:[updated]},outbox:{put:[envelope]}};
    }});
    guard(ownerId);
    return Object.freeze({status:'synthetic_local_staged',
      teachingId:updated.id,subjectId:updated.subjectId,
      baseRevision:envelope.baseRevision,pendingEnvelopeId:envelope.id,
      cloudCommitted:false,serverReceipt:false});
  }
  return Object.freeze({apply});
}
