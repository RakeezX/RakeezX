/**
 * DEMO ONLY: reconcile a simulated, owner-scoped CAS receipt for a pristine
 * subject correction. Not imported by real Product Sync or trusted Auth.
 * A transport response alone is NOT proof of provider authenticity.
 */
import * as defaultDB from './db.js';
import {STORES} from './db.js';
import {reviewTeachingSubjectChange} from './teaching-subject-change-review.js';
import {SUBJECT_CORRECTION_SYNTHETIC_PROTOCOL} from './teaching-subject-change-synthetic.js';

export const RESEARCH_SUBJECT_CAS_RECEIPT='RESEARCH_PRISTINE_SUBJECT_V1';
const issue=code=>Object.assign(new Error(code),{code});
const validateReceipt=(r,owner)=>{
  if(!r||r.protocol!==RESEARCH_SUBJECT_CAS_RECEIPT||
     r.status!=='changed'||r.ownerId!==owner||
     !r.teachingId||!r.sectionId||!r.termId||!r.previousSubjectId||
     !r.subjectId||r.subjectId===r.previousSubjectId||
     !Number.isSafeInteger(Number(r.baseRevision))||
     !Number.isSafeInteger(Number(r.revision))||
     Number(r.revision)!==Number(r.baseRevision)+1||
     !Number.isSafeInteger(Number(r.clientUpdatedAt))||
     Number(r.clientUpdatedAt)<=0)
    throw issue('SUBJECT_CAS_RECEIPT_NOT_VERIFIED');
};
const list=(data,key)=>Array.isArray(data[key])?data[key]:[];
const verifyPreflight=(current,receipt,owner,outboxId=null)=>{
  const snapshot={
    ...current,
    teachings:list(current,'teachings').map(row=>row.id!==receipt.teachingId?row:
      {...row,subjectId:receipt.previousSubjectId}),
    outbox:list(current,'outbox').filter(row=>row.id!==outboxId),
  };
  const review=reviewTeachingSubjectChange({
    snapshot,ownerId:owner,teachingId:receipt.teachingId,
    targetSubjectId:receipt.subjectId,currentTermId:receipt.termId,
  });
  if(review.status!=='preflight_ready')
    throw issue('SUBJECT_CAS_REVIEW_CHANGED:'+review.reason);
};
export function createSyntheticSubjectConvergence({
  database=defaultDB,currentOwner,enabled=false,
}={}) {
  const guard=owner=>{
    if(enabled!==true||database.getActiveDatabaseName()!=='rakeezx-demo')
      throw issue('SUBJECT_CAS_DEMO_ONLY');
    if(!owner||currentOwner?.()!==owner)
      throw issue('SUBJECT_CAS_OWNER_CONTEXT_CHANGED');
  };
  async function confirmLocal(ownerId,receipt){
    guard(ownerId);
    validateReceipt(receipt,ownerId);
    let response={};
    await database.applyBatch(Object.fromEntries(STORES.map(k=>[k,{}])),{
      productWrite:true,prepare(current){
        guard(ownerId);
        const teaching=list(current,'teachings').find(row=>row.id===receipt.teachingId&&!row.deleted);
        const pendingId='subject-correction-synthetic:'+receipt.teachingId;
        const pending=list(current,'outbox').find(row=>row.id===pendingId);
        if(!teaching||!pending||pending.protocol!==SUBJECT_CORRECTION_SYNTHETIC_PROTOCOL||
           pending.ownerId!==ownerId||pending.baseRevision!==Number(receipt.baseRevision)||
           pending.updatedAt!==Number(receipt.clientUpdatedAt)||
           pending.priorSubjectId!==receipt.previousSubjectId||
           pending.targetSubjectId!==receipt.subjectId||
           pending.sectionId!==receipt.sectionId||pending.termId!==receipt.termId||
           teaching.subjectId!==receipt.subjectId||teaching.serverRevision!==pending.baseRevision||
           teaching.updatedAt!==pending.updatedAt)
          throw issue('SUBJECT_CAS_LOCAL_INTENT_MISMATCH');
        verifyPreflight(current,receipt,ownerId,pendingId);
        const confirmed={...teaching,serverRevision:Number(receipt.revision),
          syncStatus:'synthetic_subject_confirmed'};
        response={status:'synthetic_receipt_confirmed',revision:confirmed.serverRevision,
          cloudVerified:false,providerIdentityVerified:false};
        return {teachings:{put:[confirmed]},outbox:{remove:[pendingId]}};
      },
    });
    guard(ownerId);
    return Object.freeze(response);
  }
  async function pullPeer(ownerId,receipt){
    guard(ownerId);
    validateReceipt(receipt,ownerId);
    let response={};
    await database.applyBatch(Object.fromEntries(STORES.map(k=>[k,{}])),{
      productWrite:true,prepare(current){
        guard(ownerId);
        const teaching=list(current,'teachings').find(row=>row.id===receipt.teachingId&&!row.deleted);
        if(!teaching||teaching.ownerId&&teaching.ownerId!==ownerId||
           teaching.sectionId!==receipt.sectionId||teaching.termId!==receipt.termId)
          throw issue('SUBJECT_CAS_PEER_TEACHING_MISMATCH');
        const revision=Number(teaching.serverRevision??0);
        if(revision===Number(receipt.revision)&&teaching.subjectId===receipt.subjectId){
          response={status:'already_converged',revision,cloudVerified:false};
          return {};
        }
        if(revision!==Number(receipt.baseRevision)||
           teaching.subjectId!==receipt.previousSubjectId||
           Number(receipt.clientUpdatedAt)<=Number(teaching.updatedAt??0))
          throw issue('SUBJECT_CAS_PEER_CONFLICT');
        verifyPreflight(current,receipt,ownerId);
        const record={...teaching,subjectId:receipt.subjectId,
          serverRevision:Number(receipt.revision),
          updatedAt:Number(receipt.clientUpdatedAt),
          syncStatus:'synthetic_subject_confirmed'};
        response={status:'synthetic_peer_converged',
          revision:record.serverRevision,cloudVerified:false};
        return {teachings:{put:[record]}};
      },
    });
    guard(ownerId);
    return Object.freeze(response);
  }
  return Object.freeze({confirmLocal,pullPeer});
}
