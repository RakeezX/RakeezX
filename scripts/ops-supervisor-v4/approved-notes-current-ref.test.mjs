import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readApprovedNotes } from './approved-notes.mjs';

const activationId='po-20261012-continuous';
const sourceName='n36-current.json';
const digest=value=>createHash('sha256').update(value).digest('hex');
const card={id:'current-n36',productId:'N36',activationId,objective:'Current approved work',releaseAuthority:'PO',scopeKey:'n36-current',allowedPaths:['src/app.js'],requiredChecks:['check']};
const source=JSON.stringify({version:1,activationId,tasks:[card]});
const current=digest(source);
const stale='f'.repeat(64);
const row=refs=>['','N36','2026-10-17','2026-10-17','External import','FEATURE','Current approved work','OPEN','MEDIUM','HIGH','D-060',refs,''].join('|');
const ref=sha=>'[[OPS_TASK:'+sourceName+':'+sha+']]';

async function withRepo(refs,fn){
  const repo=await fs.mkdtemp(path.join(os.tmpdir(),'rakeez-approved-notes-'));
  try{
    await fs.mkdir(path.join(repo,'docs'),{recursive:true});
    await fs.mkdir(path.join(repo,'scripts','ops-supervisor-v4'),{recursive:true});
    await fs.writeFile(path.join(repo,'docs','PRODUCT_LEDGER.md'),row(refs));
    await fs.writeFile(path.join(repo,'scripts','ops-supervisor-v4',sourceName),source);
    await fn(await readApprovedNotes(repo,activationId));
  }finally{await fs.rm(repo,{recursive:true,force:true});}
}

test('newest same-source reference is authoritative and historical hashes are ignored',async()=>{
  await withRepo(ref(current)+' '+ref(stale),result=>{
    assert.equal(result.cards.length,1);
    assert.equal(result.issues.length,0);
    assert.equal(result.cards[0].approvedNote.sha256,current);
  });
});

test('a stale newest reference cannot be bypassed by a later matching historical entry',async()=>{
  await withRepo(ref(stale)+' '+ref(current),result=>{
    assert.equal(result.cards.length,0);
    assert.equal(result.issues.length,1);
    assert.equal(result.issues[0].message,'Approved source hash differs');
  });
});
