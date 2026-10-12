import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { inspectProductEligibility, recordProductTransition } from './product-records.mjs';

test('ledger fixture: preserve all PO notes, refuse false publication, update once and honor later closure', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-records-'));
  try {
    await fs.mkdir(path.join(temp, 'docs'));
    const source = await fs.readFile(new URL('./fixtures/product-ledger.md', import.meta.url), 'utf8');
    const row = source.split(/\r?\n/).find(line => line.startsWith('| N92 |'));
    const unrelated = source.split(/\r?\n/).find(line => line.startsWith('| N94 |'));
    assert.ok(row && unrelated);
    const ledger = path.join(temp, 'docs', 'PRODUCT_LEDGER.md');
    const closed = path.join(temp, 'docs', 'PRODUCT_LEDGER_CLOSED.md');
    await fs.writeFile(ledger, '# Product\n\n' + row + '\n' + unrelated + '\n');
    await fs.writeFile(closed, '# Closed\n');
    await fs.writeFile(path.join(temp, 'docs', 'PO_REVIEW_QUEUE.md'), '# Acceptance\n\nOriginal user note.\n');
    const task = { id:'delivery-n92', productId:'N92', objective:'Success copy only', candidateSha:'a'.repeat(40), status:'awaiting_po' };
    await assert.rejects(recordProductTransition({repoRoot:temp,task}), /PRODUCTION_RECEIPT_REQUIRED/);
    const receipt = { status:'deployed', taskId:task.id, candidateSha:task.candidateSha, publishedSha:'b'.repeat(40),
      provider:{headSha:'b'.repeat(40),conclusion:'success'}, evidence:{production:{passed:true},immutable:{passed:true}},
      productionUrl:'https://rakeezx.com',verifiedAt:'2026-10-12T09:00:00Z' };
    const result = await recordProductTransition({repoRoot:temp,task,receipt,at:receipt.verifiedAt});
    assert.equal(result.recorded,true);
    const updated = await fs.readFile(ledger,'utf8');
    const newRow=updated.split('\n').find(line=>line.startsWith('| N92 |'));
    const expectedCols=row.split('|'),actualCols=newRow.split('|');
    for(let i=0;i<expectedCols.length;i++) if(i!==3&&i!==7) assert.equal(actualCols[i],expectedCols[i]);
    assert.ok(updated.includes(unrelated));
    const again=await recordProductTransition({repoRoot:temp,task,receipt,at:receipt.verifiedAt});
    assert.equal(again.ledgerChanged,false); assert.equal(again.reviewChanged,false);
    const review=await fs.readFile(path.join(temp,'docs','PO_REVIEW_QUEUE.md'),'utf8');
    assert.equal(review.split('| N92 |').length-1,1);assert.ok(review.includes('Original user note.'));
    await fs.writeFile(closed,'# Closed\n'+row+'\n');
    assert.deepEqual(await inspectProductEligibility(temp,'N92'),{eligible:false,closed:true,reason:'CLOSED',status:'CLOSED'});
    task.status='running';
    assert.equal((await recordProductTransition({repoRoot:temp,task})).reason,'CLOSED');
    assert.equal(await fs.readFile(ledger,'utf8'),updated);
  } finally { await fs.rm(temp,{recursive:true,force:true}); }
});
