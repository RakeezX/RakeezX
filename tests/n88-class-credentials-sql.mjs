/** AI: affected proposals on fresh in-process PGlite, NOT native/hosted qualification.
 * No TCP listener, credentials, filesystem DB or shared service. Always close owned DB.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createClassCredentialOperations,withCredentialRepository } from '../drafts/n88-student-portal/class-credentials.mjs';
import { createNumericCredentialOperations } from '../drafts/n88-student-portal/numeric-credentials.mjs';
const owner='11111111-1111-4111-8111-111111111111';
test('inactive SQL constraints, restricted-role operations and durable extension integration',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(`create role n88_backend nologin;create role synthetic_anon nologin;
      create schema n88_private;revoke all on schema n88_private from public;
      grant usage on schema n88_private to n88_backend;
      create table n88_private.contexts(owner_id uuid primary key);
      insert into n88_private.contexts values('${owner}');`);
    for(const name of ['numeric-credentials','class-credentials'])await pg.exec(await readFile(new URL(`../drafts/n88-student-portal/${name}.inactive.sql`,import.meta.url),'utf8'));
    let baseState={contexts:[{ownerId:owner,active:true}],memberships:[{ownerId:owner,classId:'fabricated-class',studentId:'fabricated-student',
      enrollmentId:'fabricated-enrollment',revision:1,canonicalStamp:'fabricated-stamp',status:'active',endDate:null,studentActive:true,classActive:true,label:'Fabricated'}]};
    let lose=false;
    const base={async transaction(fn){
      const db=structuredClone(baseState);
      await pg.exec('begin;set local role n88_backend');
      try {
        const value=await fn(db,{query:async(sql,args=[])=>{const r=await pg.query(sql,args);return {...r,rowCount:r.affectedRows};},synchronizeOwner:async()=>{}});
        await pg.exec('commit');baseState=db;
        if(lose){lose=false;throw Error('synthetic lost ACK');}
        return value;
      }catch(error){await pg.exec('rollback');throw error;}
    }};
    const repository=withCredentialRepository(base);
    const numeric=createNumericCredentialOperations({keys:new Map([['v1',Buffer.alloc(32,2)]]),activeKeyVersion:'v1',reservationKey:Buffer.alloc(32,3)});
    const module=createClassCredentialOperations({repository,...numeric,origin:'https://synthetic.invalid',verifyIngress:async()=>({clientKey:'synthetic-ingress'}),
      verifyTeacher:async()=>({ownerId:owner,sessionId:'synthetic',current:true}),
      resolveClass:async()=>({ownerId:owner,teachingId:'teaching',classId:'fabricated-class',revision:'1',current:true})});
    const ops={...module.forRequest({method:'POST',headers:{origin:'https://synthetic.invalid','x-n88-csrf':'1','content-type':'application/json'}}),
      listClass:module.forRequest({method:'GET'}).listClass};
    const input={requestId:'sql-synthetic-batch-01',expectedRosterRevision:(await ops.listClass('teaching')).body.rosterRevision};
    lose=true;assert.equal((await ops.issueMissingClassCodes('teaching',input)).status,503);
    const retry=await ops.issueMissingClassCodes('teaching',input);assert.equal(retry.body.counts.uncertain,1);assert.equal(retry.body.secrets,undefined);
    const member={studentId:'fabricated-student',enrollmentId:'fabricated-enrollment',revision:1,credentialVersion:1};
    const rotated=await ops.rotate({...member,requestId:'sql-synthetic-rotate-01'});assert.equal(rotated.body.counts.created,1);
    const student=numeric.createStudentHandler({repository,verifyIngress:async()=>({clientKey:'synthetic-trusted-ingress'}),origin:'https://synthetic.invalid',project:async()=>({tasks:[]})});
    const request=(action,cookie)=>student({path:'/api/n88/student/'+action,method:action==='read'?'GET':'POST',body:{code:rotated.body.secrets[0].code},
      headers:{origin:'https://synthetic.invalid','content-type':'application/json','x-n88-csrf':'1',...(cookie?{cookie}:{})}});
    const login=await request('claim');assert.equal(login.status,200);
    const cookie=login.headers['Set-Cookie'].split(';')[0];assert.equal((await request('read',cookie)).status,200);
    assert.equal((await ops.revoke({...member,credentialVersion:2,requestId:'sql-synthetic-revoke-01'})).status,200);
    assert.equal((await request('read',cookie)).status,401);
    const credentials=(await pg.query('select payload from n88_private.numeric_credentials')).rows;
    assert.equal(credentials.length,2);
    assert.equal(JSON.stringify(credentials).includes(rotated.body.secrets[0].code),false);
    assert.ok(credentials.every(r=>r.payload.revokedAt!==null));
    async function rejected(sql,args=[]) {
      await pg.exec('begin;set local role n88_backend');let rejected=false;
      try{await pg.query(sql,args);}catch{rejected=true;}finally{await pg.exec('rollback');}
      assert.equal(rejected,true);
    }
    await rejected('delete from n88_private.numeric_credentials');
    await rejected('update n88_private.numeric_credentials set payload=jsonb_set(payload,\'{revokedAt}\',\'null\'::jsonb)');
    await rejected('delete from n88_private.class_credential_receipts');
    await rejected(`update n88_private.class_credential_receipts set payload=payload`);
    // Global reservation persists even when both versions are retired.
    const duplicate={...credentials[0].payload,id:'22222222-2222-4222-8222-222222222222',version:3};
    await rejected('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[duplicate.id,JSON.stringify(duplicate)]);
    const plaintext={...duplicate,reservation:'a'.repeat(64),code:'fabricated-disallowed-plaintext'};
    await rejected('insert into n88_private.numeric_credentials(row_key,payload) values($1,$2::jsonb)',[plaintext.id,JSON.stringify(plaintext)]);
    await pg.exec('begin;set local role synthetic_anon');let denied=false;
    try{await pg.query('select * from n88_private.numeric_credentials');}catch{denied=true;}finally{await pg.exec('rollback');}
    assert.equal(denied,true);
  }finally{await pg.close();}
});
