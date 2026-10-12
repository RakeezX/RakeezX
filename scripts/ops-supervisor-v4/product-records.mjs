/** Product records are receipts of a transition, never another execution gate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const BEGIN = '<!-- BEGIN RAKEEZ CONTINUOUS DELIVERY -->';
const END = '<!-- END RAKEEZ CONTINUOUS DELIVERY -->';
const SHA = /^[a-f0-9]{40}$/i;
const states = {
  pending: 'PLANNED - CONTINUOUS DELIVERY ACTIVATED',
  running: 'IN_PROGRESS - IMPLEMENTING',
  delivery: 'IN_PROGRESS - PUBLISHING',
  awaiting_po: 'WAITING_PO - PRODUCTION VERIFIED',
  blocked: 'BLOCKED - SEE CURRENT CONTROLLER RECEIPT',
  retry_wait: 'IN_PROGRESS - AUTOMATIC RETRY SCHEDULED',
};
const cell = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replaceAll('|', '&#124;').slice(0,420);
const linesOf = text => text.split(/\r?\n/);

async function read(file, optional = false) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (optional && error.code === 'ENOENT') return ''; throw error; }
}
function rowsFor(text, productId) {
  const expression = new RegExp('^\\|\\s*' + productId + '\\s*\\|');
  return linesOf(text).filter(line => expression.test(line));
}
export async function inspectProductEligibility(repoRoot, productId) {
  if (!/^N\d+$/.test(productId)) return { eligible: false, reason: 'INVALID_PRODUCT_ID' };
  const closed = await read(path.join(repoRoot, 'docs', 'PRODUCT_LEDGER_CLOSED.md'), true);
  if (rowsFor(closed, productId).length) return { eligible: false, closed: true, reason: 'CLOSED', status: 'CLOSED' };
  const open = await read(path.join(repoRoot, 'docs', 'PRODUCT_LEDGER.md'));
  const rows = rowsFor(open, productId);
  if (rows.length !== 1) return { eligible: false, reason: rows.length ? 'AMBIGUOUS_PRODUCT_ROW' : 'PRODUCT_NOT_IN_ACTIVE_LEDGER' };
  const status = rows[0].split('|')[7]?.trim() ?? '';
  if (/\b(?:CLOSED|DEFERRED|REJECTED|SUPERSEDED)\b/i.test(status)) return { eligible: false, reason: status, status };
  return { eligible: true, status };
}

async function compareAndWrite(file, before, after) {
  if (before === after) return false;
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, after, { flag: 'wx' });
    if (await read(file, true) !== before) throw new Error('PRODUCT_RECORD_CHANGED_CONCURRENTLY: ' + path.basename(file));
    await fs.rename(temporary, file);
    return true;
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function recordProductTransition({ repoRoot, task, receipt = task.deliveryReceipt, at = new Date().toISOString() }) {
  if (!states[task.status]) return { recorded: false, reason: 'NO_PRODUCT_TRANSITION' };
  const eligibility = await inspectProductEligibility(repoRoot, task.productId);
  if (!eligibility.eligible) return { recorded: false, reason: eligibility.reason };
  if (task.status === 'awaiting_po' && (receipt?.status !== 'deployed' || receipt.taskId !== task.id
      || receipt.candidateSha !== task.candidateSha || !SHA.test(receipt.publishedSha ?? '')
      || receipt.provider?.headSha !== receipt.publishedSha || receipt.provider?.conclusion !== 'success'
      || !receipt.evidence?.production?.passed || !receipt.evidence?.immutable?.passed)) {
    throw new Error('PRODUCTION_RECEIPT_REQUIRED');
  }
  const ledgerPath = path.join(repoRoot, 'docs', 'PRODUCT_LEDGER.md');
  const before = await read(ledgerPath);
  const rows = rowsFor(before, task.productId);
  if (rows.length !== 1) throw new Error('PRODUCT_ROW_CHANGED');
  const row = rows[0], columns = row.split('|');
  if (columns.length < 13) throw new Error('PRODUCT_TABLE_SCHEMA_CHANGED');
  // Preserve the original title, added date, lineage and every byte of PO notes.
  columns[3] = ' ' + new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }) + ' ';
  columns[7] = ' ' + states[task.status] + ' ';
  const ledgerChanged = await compareAndWrite(ledgerPath, before, before.replace(row, columns.join('|')));

  let reviewChanged = false;
  if (task.status === 'awaiting_po') {
    const reviewPath = path.join(repoRoot, 'docs', 'PO_REVIEW_QUEUE.md');
    const current = await read(reviewPath, true);
    const start = current.indexOf(BEGIN), finish = current.indexOf(END);
    if ((start < 0) !== (finish < 0) || (start >= 0 && finish < start)) throw new Error('REVIEW_BLOCK_MARKERS_INVALID');
    const oldBlock = start < 0 ? '' : current.slice(start, finish + END.length);
    const items = linesOf(oldBlock).filter(line => /^\| N\d+ \|/.test(line));
    const key = '| ' + task.productId + ' |';
    const kept = items.filter(line => !line.startsWith(key));
    const url = new URL(receipt.productionUrl ?? 'https://rakeezx.com');
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('UNSAFE_PRODUCTION_URL');
    kept.push(`| ${task.productId} | ${cell(task.validationReceipt?.summary ?? task.objective)} | [Production](${url.origin}/) | ${receipt.publishedSha} | ${cell(receipt.verifiedAt ?? at)} | ${cell(task.id)} |`);
    const nextBlock = [BEGIN, '', '| التذكرة | النتيجة المنشورة | الموقع | Git SHA | التحقق UTC | بطاقة التنفيذ |',
      '| --- | --- | --- | --- | --- | --- |', ...kept, '', END].join('\n');
    const next = start < 0 ? current.trimEnd() + '\n\n' + nextBlock + '\n' : current.slice(0, start) + nextBlock + current.slice(finish + END.length);
    reviewChanged = await compareAndWrite(reviewPath, current, next);
  }
  return { recorded: true, ledgerChanged, reviewChanged };
}
