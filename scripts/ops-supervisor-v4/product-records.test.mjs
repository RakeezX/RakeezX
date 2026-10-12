import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import childProcess from 'node:child_process';
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

test('N13 current status row is distinct from retained approval notes; real duplicates and CLOSED still refuse writes', async () => {
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/n13-ledger-mixed-tables.json', import.meta.url), 'utf8'));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-records-n13-'));
  try {
    await fs.mkdir(path.join(temp, 'docs'));
    const ledger = path.join(temp, 'docs', 'PRODUCT_LEDGER.md');
    const closed = path.join(temp, 'docs', 'PRODUCT_LEDGER_CLOSED.md');
    const source = ['# Product', '', fixture.activeHeader, fixture.activeRow, '', '# Retained approved contract',
      fixture.historicalHeader, fixture.historicalRow, ''].join('\n');
    const closedSource = ['# Closed', '', fixture.closedHeader, fixture.closedRow, '', fixture.closedCompactHeader,
      ...fixture.closedCompactRows, ''].join('\n');
    await fs.writeFile(ledger, source);
    await fs.writeFile(closed, closedSource);
    assert.deepEqual(await inspectProductEligibility(temp, 'N13'), {
      eligible: true, status: fixture.activeRow.split('|')[7].trim(),
    });

    const task = { id: 'fixture-n13-transition', productId: 'N13', status: 'running' };
    assert.equal((await recordProductTransition({ repoRoot: temp, task, at: '2026-10-12T10:30:00Z' })).recorded, true);
    const columns = fixture.activeRow.split('|');
    columns[3] = ' 2026-10-12 ';
    columns[7] = ' IN_PROGRESS - IMPLEMENTING ';
    const updatedRow = columns.join('|');
    const updated = source.replace(fixture.activeRow, updatedRow);
    assert.equal(await fs.readFile(ledger, 'utf8'), updated, 'Only current date/status may change; every Product note remains exact');
    assert.equal(await fs.readFile(closed, 'utf8'), closedSource);

    assert.deepEqual(await inspectProductEligibility(temp, 'N80'), { eligible: false, closed: true, reason: 'CLOSED', status: 'CLOSED' });
    assert.equal((await recordProductTransition({ repoRoot: temp, task: { ...task, productId: 'N80' } })).reason, 'CLOSED');
    assert.equal(await fs.readFile(ledger, 'utf8'), updated);
    assert.equal(await fs.readFile(closed, 'utf8'), closedSource);

    const duplicate = updated + '\n' + updatedRow + '\n';
    await fs.writeFile(ledger, duplicate);
    assert.deepEqual(await inspectProductEligibility(temp, 'N13'), { eligible: false, reason: 'AMBIGUOUS_PRODUCT_ROW' });
    assert.equal((await recordProductTransition({ repoRoot: temp, task })).reason, 'AMBIGUOUS_PRODUCT_ROW');
    assert.equal(await fs.readFile(ledger, 'utf8'), duplicate, 'Two genuine status rows must not be merged or rewritten');
    assert.equal(await fs.readFile(closed, 'utf8'), closedSource);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test('Windows EPERM uses a guarded existing-file replacement and refuses a concurrent Product edit', async t => {
  const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/n13-ledger-mixed-tables.json', import.meta.url), 'utf8'));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'rakeez-records-windows-'));
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const realRename = fs.rename;
  try {
    await fs.mkdir(path.join(temp, 'docs'));
    const ledger = path.join(temp, 'docs', 'PRODUCT_LEDGER.md');
    const source = ['# Product', fixture.activeHeader, fixture.activeRow, '',
      '# Retained approval', fixture.historicalHeader, fixture.historicalRow, ''].join('\n');
    await fs.writeFile(ledger, source);
    const task = { id: 'fixture-n13-windows', productId: 'N13', status: 'running' };
    let renameSource, renameTarget;
    const denied = () => Object.assign(new Error('Existing Windows destination is locked for rename'), { code: 'EPERM' });
    const rename = t.mock.method(fs, 'rename', async (from, to) => {
      renameSource = from; renameTarget = to; throw denied();
    });
    const native = t.mock.method(childProcess, 'execFile', (executable, args, options, callback) => {
      Promise.resolve().then(async () => {
        assert.match(executable, /WindowsPowerShell\\v1\.0\\powershell\.exe$/);
        assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-EncodedCommand']);
        const script = Buffer.from(args[3], 'base64').toString('utf16le');
        const expected = createHash('sha256').update(source, 'utf8').digest('hex');
        assert.ok(script.includes("$ErrorActionPreference = 'Stop'"));
        assert.ok(script.includes("if ($actual -cne '" + expected + "') { throw 'PRODUCT_RECORD_CHANGED_CONCURRENTLY:"));
        assert.ok(script.indexOf('if ($actual -cne') < script.indexOf('[IO.File]::Replace('));
        assert.ok(script.includes('[IO.File]::Replace($source, $target, [NullString]::Value)'));
        assert.ok(!/Set-Acl|Set-ExecutionPolicy|Bypass|Remove-Item/.test(script));
        assert.equal(options.timeout, 10000);
        // Simulate only the reviewed native replacement; no PowerShell runs in this fixture.
        await realRename(renameSource, renameTarget);
      }).then(() => callback(null), callback);
    });
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    assert.equal((await recordProductTransition({ repoRoot: temp, task, at: '2026-10-12T10:30:00Z' })).recorded, true);
    const columns = fixture.activeRow.split('|');
    columns[3] = ' 2026-10-12 '; columns[7] = ' IN_PROGRESS - IMPLEMENTING ';
    assert.equal(await fs.readFile(ledger, 'utf8'), source.replace(fixture.activeRow, columns.join('|')));
    assert.equal(native.mock.callCount(), 1);

    await fs.writeFile(ledger, source);
    const concurrent = source + '\nPO note saved while rename failed.\n';
    rename.mock.mockImplementation(async () => { await fs.writeFile(ledger, concurrent); throw denied(); });
    await assert.rejects(recordProductTransition({ repoRoot: temp, task }), /PRODUCT_RECORD_CHANGED_CONCURRENTLY/);
    assert.equal(await fs.readFile(ledger, 'utf8'), concurrent, 'A concurrent Product edit must never be overwritten');
    assert.equal(native.mock.callCount(), 1, 'A changed destination must not reach File.Replace');
    assert.deepEqual(await fs.readdir(path.join(temp, 'docs')), ['PRODUCT_LEDGER.md'], 'Temporary files are cleaned on success and refusal');
  } finally {
    Object.defineProperty(process, 'platform', platform);
    await fs.rm(temp, { recursive: true, force: true });
  }
});
