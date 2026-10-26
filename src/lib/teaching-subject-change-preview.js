/**
 * Atomic, READ-ONLY local impact inspection for correcting a material choice.
 * Never provides server authority, lease/write permission, or cloud freshness.
 */
import * as database from './db.js';
import {reviewTeachingSubjectChange} from './teaching-subject-change-review.js';

const fault=(code)=>Object.assign(new Error(code),{code});
const STORES=database.STORES.filter(name=>!['device','meta','profile'].includes(name));

export async function readSubjectChangeLocalSnapshot({
  db=database,assertContext=()=>{},signal,
}={}) {
  if(signal?.aborted)throw fault('SUBJECT_CHANGE_PREVIEW_CANCELLED');
  assertContext();
  const conn=await db.openDB();
  const names=STORES.filter(name=>conn.objectStoreNames.contains(name));
  if(names.length!==STORES.length)
    throw fault('SUBJECT_CHANGE_PREVIEW_DATABASE_INCOMPLETE');
  // A single READONLY IndexedDB transaction provides a consistent
  // cross-store snapshot and cannot insert an Outbox event.
  const read=await new Promise((resolve,reject)=>{
    const tx=conn.transaction(names,'readonly');
    const data={};let failure;
    const abort=()=>{try{tx.abort();}catch{/* already closed */}};
    signal?.addEventListener('abort',abort,{once:true});
    tx.oncomplete=()=>{
      signal?.removeEventListener('abort',abort);
      if(signal?.aborted)reject(fault('SUBJECT_CHANGE_PREVIEW_CANCELLED'));
      else resolve(data);
    };
    tx.onabort=()=>{
      signal?.removeEventListener('abort',abort);
      reject(failure??tx.error??fault('SUBJECT_CHANGE_PREVIEW_ABORTED'));
    };
    tx.onerror=ev=>{failure??=ev.target.error;};
    for(const name of names){
      const request=tx.objectStore(name).getAll();
      request.onsuccess=()=>{data[name]=request.result;};
      request.onerror=()=>{failure??=request.error;};
    }
  });
  assertContext();
  if(signal?.aborted)throw fault('SUBJECT_CHANGE_PREVIEW_CANCELLED');
  return read;
}
export async function previewTeachingSubjectChange({
  db=database,ownerId,teachingId,targetSubjectId,currentTermId,
  assertContext=()=>{},signal,
}={}) {
  if(!ownerId||!teachingId||!targetSubjectId)
    throw fault('SUBJECT_CHANGE_PREVIEW_CONTEXT_REQUIRED');
  const snapshot=await readSubjectChangeLocalSnapshot({db,assertContext,signal});
  // The review contract treats absent store arrays and mismatched parents as
  // blocked; it never returns an authorization to write.
  return reviewTeachingSubjectChange({
    snapshot,ownerId,teachingId,targetSubjectId,currentTermId,
  });
}
