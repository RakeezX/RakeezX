/** AI: actual numeric handler and credential repository over a fabricated memory SQL port.
 * This checks composition, not PostgreSQL durability, hosted Auth or live ingress. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createMemoryRepository} from '../../drafts/n88-student-portal/memory-repository.mjs';
import {withCredentialRepository} from '../../drafts/n88-student-portal/class-credentials.mjs';
import {createNumericCredentialOperations,NUMERIC_POLICY} from '../../drafts/n88-student-portal/numeric-credentials.mjs';
import {createRolloutGuard} from '../../drafts/n88-student-portal/rollout-guard.mjs';
export async function studentFixture() {
  let time=Date.now();
  const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const member={ownerId,studentId:'synthetic-student',enrollmentId:'synthetic-enrollment',classId:'synthetic-class',revision:1,canonicalStamp:'a'.repeat(64),status:'active',endDate:null,studentActive:true,classActive:true};
  const memory=createMemoryRepository({contexts:[{ownerId,active:true}],memberships:[member],tables:{}});
  const repository=withCredentialRepository({transaction:action=>memory.transaction(db=>action(db,{
    synchronizeOwner:async id=>assert.equal(id,ownerId),
    async query(sql,args=[]){
      const table=/n88_private\.(\w+)/.exec(sql)?.[1];assert(table);
      const rows=db.tables[table]??=[];
      if(sql.startsWith('select '))return {rows:rows.map(r=>({payload:structuredClone(r.payload)}))};
      const index=rows.findIndex(r=>r.key===args[0]);
      if(sql.startsWith('delete ')){if(index<0)return {rowCount:0};rows.splice(index,1);}
      else if(sql.startsWith('insert ')||sql.startsWith('update ')){
        if(sql.startsWith('update ')&&index<0)return {rowCount:0};
        const row={key:args[0],payload:JSON.parse(args[1])};if(index<0)rows.push(row);else rows[index]=row;
      }else throw Error('Unexpected fixture query');
      return {rowCount:1};
    }
  }))});
  const rollout=createRolloutGuard(k=>({N88_ROLLOUT_MODE:'public',N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256:'a'.repeat(64),N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED:'true'})[k]);
  const operations=createNumericCredentialOperations({keys:new Map([['v1',randomBytes(32)]]),activeKeyVersion:'v1',reservationKey:randomBytes(32),now:()=>time,rollout});
  const issued=await repository.transaction(db=>operations.issueMember(db,member,{expectedVersion:0}));
  const handler=operations.createStudentHandler({repository,origin:'https://synthetic.invalid',verifyIngress:async()=>({clientKey:'synthetic-source'}),project:async()=>({version:'n88-student-v3',profile:{name:'طالب مصطنع',classLabel:'الفصل المصطنع'},work:{required:[{id:'task',title:'مهمة مصطنعة'}]}})});
  return {
    code:issued.code,
    expire(){time+=NUMERIC_POLICY.sessionMs+1;},
    revoke:()=>repository.transaction(db=>operations.revokeMember(db,member,{expectedVersion:1})),
    send(path,{method='GET',body={},cookie=''}={}){return handler({path,method,body,headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1','content-type':'application/json','sec-fetch-site':'same-origin',cookie}});},
    snapshot:()=>memory.snapshot()
  };
}
