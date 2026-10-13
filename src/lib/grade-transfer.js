import { gradeNumber } from './grade-transfer-parsers.js';

export const gradeNameKey = value => String(value ?? '').normalize('NFC').replace(/[\s\u0640\u064B-\u065F\u0670]/g, '').toLowerCase();
export const isTransferItem = item => !item.deleted && !item.auto && (item.scoreMode ?? 'direct') === 'direct';

/** Explicit mappings only. Rejected rows block the entire review, never a partial batch. */
export function reviewGradeTransfer({ rows, nameColumn, idColumn = -1, mappings, roster, items, scores, teaching, term, ownerId, databaseName }) {
  if (!teaching || teaching.deleted || !term || term.deleted || teaching.termId !== term.id || term.status === 'closed' ||
      !rows?.length || rows.length > 301 || !Number.isInteger(nameColumn) || nameColumn < 0 || !(Number(teaching.serverRevision) > 0)) throw new Error('GRADE_CONTEXT_INVALID');
  const columns = rows[0].length;
  if (nameColumn >= columns || !Number.isInteger(idColumn) || idColumn < -1 || idColumn >= columns || nameColumn === idColumn || mappings.length !== columns) throw new Error('GRADE_MAPPING_INVALID');
  const selected = [], newItems = [], used = new Set();
  mappings.forEach((mapping, column) => {
    if (column === nameColumn || column === idColumn || mapping.kind === 'ignore') return;
    let item;
    if (mapping.kind === 'new') {
      const max = gradeNumber(mapping.max), name = String(mapping.name ?? '').trim();
      if (!mapping.confirmed || !max || !name || name.length > 50 || !mapping.id || items.some(i => i.id === mapping.id)) throw new Error('GRADE_NEW_ITEM_CONFIRM_REQUIRED');
      item = { id: mapping.id, name, max, teachingId: teaching.id, scoreMode: 'direct', auto: null };
      newItems.push({ id: item.id, name, max });
    } else if (mapping.kind === 'existing') {
      item = items.find(i => i.id === mapping.itemId && i.teachingId === teaching.id && isTransferItem(i));
      if (!item || !(Number(item.serverRevision) > 0)) throw new Error('GRADE_ITEM_UNAVAILABLE');
    } else throw new Error('GRADE_MAPPING_INVALID');
    if (used.has(item.id)) throw new Error('GRADE_DUPLICATE_ITEM');
    used.add(item.id); selected.push({ column, item });
  });
  if (!selected.length) throw new Error('GRADE_SELECT_COLUMN');
  const names = new Map(), ids = new Map();
  for (const student of roster.filter(s => !s.deleted)) {
    ids.set(student.id, student);
    const key = gradeNameKey(student.name); names.set(key, [...(names.get(key) ?? []), student]);
  }
  const resolved = rows.slice(1).map((row, index) => {
    const explicitId = idColumn < 0 ? '' : String(row[idColumn] ?? '').trim();
    const matches = explicitId ? [ids.get(explicitId)].filter(Boolean) : names.get(gradeNameKey(row[nameColumn])) ?? [];
    return { row, index: index + 2, student: matches.length === 1 ? matches[0] : null, reason: matches.length > 1 ? 'اسم ملتبس' : 'طالب غير معروف' };
  });
  const frequencies = new Map();
  for (const r of resolved) if (r.student) frequencies.set(r.student.id, (frequencies.get(r.student.id) ?? 0) + 1);
  const entries = [], cells = [], rejected = []; let unchanged = 0, additions = 0, overwrites = 0;
  for (const r of resolved) {
    if (!r.student || frequencies.get(r.student.id) !== 1) { rejected.push({ row: r.index, reason: r.student ? 'طالب مكرر في الملف' : r.reason }); continue; }
    for (const { column, item } of selected) {
      let value;
      try { value = gradeNumber(r.row[column]); if (value !== null && value > Number(item.max)) throw new Error(); }
      catch { rejected.push({ row: r.index, reason: 'درجة غير صالحة أو تتجاوز الحد: ' + item.name }); continue; }
      const previous = scores.find(s => s.studentId === r.student.id && s.itemId === item.id);
      if (previous?.deleted || previous && !(Number(previous.serverRevision) > 0)) { rejected.push({ row: r.index, reason: 'سجل درجة غير متاح' }); continue; }
      const old = previous?.value == null ? null : Number(previous.value);
      entries.push({ row: r.index, student: r.student.name, studentId: r.student.id, item: item.name, max: item.max, old, value });
      if (value === null || value === old) { unchanged++; continue; }
      if (old === null) additions++; else overwrites++;
      cells.push({ studentId: r.student.id, itemId: item.id, itemRevision: item.serverRevision ?? 0, max: Number(item.max),
        scoreId: previous?.id ?? null, scoreRevision: previous?.serverRevision ?? 0, old, value });
    }
  }
  return { ownerId, databaseName, teachingId: teaching.id, termId: term.id, teachingRevision: teaching.serverRevision,
    entries, rejected, unchanged, additions, overwrites, newItems: newItems.filter(i => cells.some(c => c.itemId === i.id)), cells };
}

export function gradeCommand(review, overwriteConfirmed) {
  if (review.rejected.length || !review.cells.length || review.overwrites && !overwriteConfirmed) throw new Error('GRADE_REVIEW_CONFIRM_REQUIRED');
  return { teachingId: review.teachingId, termId: review.termId, teachingRevision: review.teachingRevision,
    newItems: review.newItems, cells: review.cells, overwriteConfirmed: overwriteConfirmed === true };
}
