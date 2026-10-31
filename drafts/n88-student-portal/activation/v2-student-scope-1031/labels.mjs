/** AI: separately versioned fixed private read; never a raw table/SQL dispatcher. */
import {Buffer} from 'node:buffer';
import {encodeArguments,unwrapEnvelope} from '../v2-hosted-compat-1031/boundary.mjs';
export const LABEL_READ=Object.freeze({id:'student-scope-labels-1031',name:'safe_student_scope_labels_1031',
  sql:'select n88_private.safe_student_scope_labels_1031($1::text) as envelope',maxRows:2000,maxBytes:2097152});
export async function readStudentLabels(tx,ownerId,classId,sessionId,today){
  const r=unwrapEnvelope(await tx.query(LABEL_READ.sql,[encodeArguments([ownerId,classId,sessionId,today])]));
  const fail=()=>{throw Error('n88_scope_labels_unavailable');};
  if(r.command!=='SELECT'||r.rowCount!==r.rows.length||r.rows.length>2000||Buffer.byteLength(JSON.stringify(r))>LABEL_READ.maxBytes)fail();
  const keys=['teaching_id','subject_id','term_id','subject_name','term_name'],seen=new Set();
  for(const row of r.rows){
    if(!row||Object.keys(row).sort().join(',')!==keys.slice().sort().join(',')||seen.has(row.teaching_id)||keys.some(k=>typeof row[k]!=='string'||!row[k].trim()||row[k].length>(k.endsWith('_name')?2000:200)||row[k].includes('\0')))fail();
    seen.add(row.teaching_id);
  }
  return r.rows;
}
