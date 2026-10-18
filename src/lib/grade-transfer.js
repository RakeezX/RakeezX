import { previewStudentRows, validStudentImportName } from './student-import.js';
import { gradeNumber } from './grade-transfer-parsers.js';

export const gradeNameKey = value => String(value ?? '').normalize('NFC').replace(/[\s\u0640\u064B-\u065F\u0670]/g, '').toLowerCase();
// Canonical metadata refreshes do not change reviewed grade-preservation facts.
export const importScoreBinding = scores => JSON.stringify([...scores].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(s=>
  [s.id,s.itemId,s.studentId,s.value??null,s.manualValue??s.value??null,s.derivedValue??0,!!s.deleted,Number(s.serverRevision??0),s.ownerId??null,!!s.locked,s.syncConflicts??[]]));
export const importItemBinding = item => JSON.stringify(item,(key,value)=>['updatedAt','canonicalId','serverCanonical','fieldRevisions','importMaximumReceipt'].includes(key)?undefined:value);
export const isTransferItem = item => !item.deleted && !item.auto && !item.readOnly && !item.locked && !item.parentId && (item.scoreMode ?? 'direct') === 'direct';

// AI-authored N105: proposals only; no mutation or implicit confirmation.
export function suggestGradeMappings(headers, items, { teachingId, ownerId } = {}) {
  const key = value => gradeNameKey(value);
  const digits = value => value.replace(/[٠-٩۰-۹]/g, c => String('٠١٢٣٤٥٦٧٨٩'.includes(c) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(c) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  const parsed = headers.map(value => {
    const label = String(value ?? '').normalize('NFC').trim();
    const match = label.match(/^(.+?)\s*\(العظمى\s+([0-9٠-٩۰-۹]+(?:[.٫][0-9٠-٩۰-۹]{1,2})?)\)$/u);
    const max = match ? Number(digits(match[2]).replace('٫','.')) : null;
    return {label, name:match?.[1].trim(), max: max > 0 && max <= 9999.99 ? max : null, canonical:match && max > 0 && max <= 9999.99 ? key(match[1])+':'+max : key(label)};
  });
  const uniqueColumn = label => {
    const found = parsed.flatMap((h,c) => key(h.label) === key(label) ? [c] : []);
    return found.length === 1 ? found[0] : -1;
  };
  const nameColumn = uniqueColumn('اسم الطالب'), idColumn = uniqueColumn('معرف الطالب');
  const metadata = new Set(['الفصل', 'المادة', 'الفصل الدراسي', 'نوع الملف'].map(key));
  const reasons = [], targets = [];
  // Canonical Sync rows use the already owner-bound database; explicit foreign metadata still rejects.
  const live = items.filter(i => !i.deleted && (!teachingId || i.teachingId === teachingId) && (!ownerId || i.ownerId == null || i.ownerId === ownerId));
  const mappings = parsed.map((h,c) => {
    if (c === nameColumn || c === idColumn) { reasons[c] = 'identity'; return {kind:'ignore'}; }
    if (metadata.has(key(h.label))) { reasons[c] = 'metadata'; return {kind:'ignore'}; }
    const sameName = live.filter(i => key(i.name) === key(h.name ?? h.label));
    if (sameName.some(i => !isTransferItem(i)) || !sameName.length && ['المشاركة','المشاركة والتفاعل','الحضور','الغياب','المجموع','النسبة'].some(name => key(name) === key(h.name ?? h.label))) { reasons[c] = 'readonly'; return {kind:'ignore'}; }
    const unique = parsed.filter(other => other.canonical === h.canonical).length === 1 &&
      parsed.filter(other => key(other.name ?? other.label) === key(h.name ?? h.label)).length === 1;
    if (unique && sameName.length === 1 && Number(sameName[0].serverRevision) > 0 &&
        Number.isFinite(Number(sameName[0].max)) && Number(sameName[0].max) > 0) {
      targets[c] = sameName[0].id;
      return {kind:'existing',itemId:sameName[0].id,...(h.max !== null ? {fileMax:h.max} : {})};
    }
    if (unique && !sameName.length && h.name && h.name.length <= 50 && !/[()]/.test(h.name) && h.max > 0 && h.max <= 9999.99) {
      reasons[c] = 'proposal';
      return {kind:'new',name:h.name,max:h.max,confirmed:false};
    }
    reasons[c] = 'exception'; return {kind:'ignore'};
  });
  targets.forEach((id,c) => {
    if (targets.filter(t => t === id).length > 1) { mappings[c] = {kind:'ignore'}; reasons[c] = 'exception'; }
  });
  return {nameColumn,idColumn,mappings,reasons};
}

// AI-authored N106: an explicit choice is valid only for the exact reviewed owned roster.
export function rosterChoiceBinding({roster, teaching, ownerId, databaseName}) {
  return JSON.stringify([ownerId,databaseName,teaching.id,teaching.sectionId,teaching.termId,teaching.serverRevision,
    roster.map(s => [s.id,s.name,s.displayNo,s.rollNo,s.enrollmentId,s.sectionId,s.serverRevision,s.ownerId,s.deleted]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}

/** Explicit mappings only. Rejected rows block the entire review, never a partial batch. */
export function reviewGradeTransfer({ rows, nameColumn, idColumn = -1, mappings, roster, items, scores, teaching, term, ownerId, databaseName, allowNewStudents = false, newStudentIds = {}, studentChoices = {} }) {
  if (!teaching || teaching.deleted || teaching.ownerId && teaching.ownerId !== ownerId || !term || term.deleted || teaching.termId !== term.id || term.status === 'closed' ||
      !rows?.length || rows.length > 301 || !Number.isInteger(nameColumn) || nameColumn < 0 || !(Number(teaching.serverRevision) > 0)) throw new Error('GRADE_CONTEXT_INVALID');
  const columns = rows[0].length;
  if (nameColumn >= columns || !Number.isInteger(idColumn) || idColumn < -1 || idColumn >= columns || nameColumn === idColumn || mappings.length !== columns) throw new Error('GRADE_MAPPING_INVALID');
  if (Object.keys(studentChoices).some(row => !/^[1-9]\d*$/.test(row) || Number(row) < 2 || Number(row) > rows.length)) throw new Error('GRADE_STUDENT_CHOICE_STALE');
  const selected = [], newItems = [], maxChanges = [], used = new Set();
  mappings.forEach((mapping, column) => {
    if (column === nameColumn || column === idColumn || mapping.kind === 'ignore') return;
    let item;
    if (mapping.kind === 'new') {
      const max = gradeNumber(mapping.max), name = String(mapping.name ?? '').trim();
      if (!mapping.confirmed || !max || max > 9999.99 || !name || name.length > 50 || !mapping.id || items.some(i => i.id === mapping.id)) throw new Error('GRADE_NEW_ITEM_CONFIRM_REQUIRED');
      item = { id: mapping.id, name, max, teachingId: teaching.id, scoreMode: 'direct', auto: null };
      newItems.push({ id: item.id, name, max });
    } else if (mapping.kind === 'existing') {
      item = items.find(i => i.id === mapping.itemId && i.teachingId === teaching.id && isTransferItem(i));
      if (!item || item.ownerId && item.ownerId !== ownerId || !(Number(item.serverRevision) > 0) || !Number.isFinite(Number(item.max)) || Number(item.max) <= 0) throw new Error('GRADE_ITEM_UNAVAILABLE');
      if (mapping.fileMax != null) {
        const max = gradeNumber(mapping.fileMax);
        if (!(max > 0) || max > 9999.99) throw Error('GRADE_MAPPING_INVALID');
        if (max !== Number(item.max)) {
          const existing = scores.filter(s => s.itemId === item.id);
          // Separate transactions: even a reviewed overwrite cannot make an unsafe lower max atomic.
          if (existing.some(s => s.ownerId && s.ownerId !== ownerId || s.locked || s.syncCreatePending || s.syncConflicts?.length || !s.deleted && !(Number(s.serverRevision)>0) ||
              !s.deleted && (s.value != null && (!Number.isFinite(Number(s.value)) || Number(s.value) > max))))
            throw Error('لا يمكن خفض العظمى: توجد درجات محفوظة تتجاوز حد الملف أو سجلات مقفلة؛ عالج التعارض ثم راجع الملف.');
          maxChanges.push({itemId:item.id,oldMax:Number(item.max),max,revision:item.serverRevision,
            item:JSON.stringify(item),scores:importScoreBinding(existing)});
          item = {...item,max};
        }
      }
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
  const namePreview = previewStudentRows(rows, nameColumn, true, roster);
  const newStudents = [];
  const resolved = rows.slice(1).map((row, index) => {
    const choice = studentChoices[index + 2];
    const legacyId = idColumn < 0 ? '' : String(row[idColumn] ?? '').trim();
    const candidates = names.get(gradeNameKey(row[nameColumn])) ?? [];
    if (choice && (!choice.confirmed || candidates.length < 2 || choice.binding !== rosterChoiceBinding({roster,teaching,ownerId,databaseName}) ||
        !candidates.some(s => s.id === choice.studentId && Number(s.serverRevision) > 0 && (!s.ownerId || s.ownerId === ownerId)) || legacyId && legacyId !== choice.studentId)) throw new Error('GRADE_STUDENT_CHOICE_STALE');
    const explicitId = choice?.studentId || legacyId;
    const matches = (explicitId ? [ids.get(explicitId)].filter(Boolean) : names.get(gradeNameKey(row[nameColumn])) ?? [])
      .filter(s => gradeNameKey(s.name) === gradeNameKey(row[nameColumn]) && (!s.ownerId || s.ownerId === ownerId) && (!s.sectionId || s.sectionId === teaching.sectionId));
    const name = String(row[nameColumn] ?? '').replace(/\s+/g, ' ').trim();
    const candidate = namePreview.entries.find(e => e.row === index + 2);
    if (allowNewStudents && !explicitId && !matches.length && candidate?.status === 'new' && validStudentImportName(name)) {
      const identity = newStudentIds[index + 2];
      if (!identity?.id || !identity?.enrollmentId) throw new Error('GRADE_NEW_STUDENT_REVIEW_REQUIRED');
      const student = { ...identity, name }; newStudents.push(student); matches.push(student);
    }
    return { row, index: index + 2, student: matches.length === 1 ? matches[0] : null, reason: matches.length > 1 ? 'اسم ملتبس' : 'طالب غير معروف' };
  });
  const frequencies = new Map();
  for (const r of resolved) if (r.student) frequencies.set(r.student.id, (frequencies.get(r.student.id) ?? 0) + 1);
  const entries = [], cells = [], rejected = []; let unchanged = 0, additions = 0, overwrites = 0, capped = 0;
  for (const r of resolved) {
    if (!r.student || frequencies.get(r.student.id) !== 1) { rejected.push({ row: r.index, student: String(r.row[nameColumn] ?? ''), reason: r.student ? 'طالب مكرر في الملف' : r.reason }); continue; }
    for (const { column, item } of selected) {
      let value, original;
      try { original = gradeNumber(r.row[column]); value = original === null ? null : Math.min(original, Number(item.max)); if (original !== value) capped++; }
      catch { rejected.push({ row: r.index, student: r.student.name, item: item.name, value: String(r.row[column] ?? ''), max: item.max, reason: 'درجة غير صالحة؛ استخدم رقمًا غير سالب' }); continue; }
      const previous = scores.find(s => s.studentId === r.student.id && s.itemId === item.id);
      if (previous?.deleted || previous && !(Number(previous.serverRevision) > 0)) { rejected.push({ row: r.index, student: r.student.name, reason: 'سجل درجة غير متاح: ' + item.name }); continue; }
      const old = previous?.value == null ? null : Number(previous.value);
      entries.push({ row: r.index, student: r.student.name, studentId: r.student.id, item: item.name, max: item.max, old, original, capped: original !== value, value });
      if (value === null || value === old) { unchanged++; continue; }
      if (old === null) additions++; else overwrites++;
      cells.push({ studentId: r.student.id, itemId: item.id, itemRevision: item.serverRevision ?? 0, max: Number(item.max),
        scoreId: previous?.id ?? null, scoreRevision: previous?.serverRevision ?? 0, old, value });
    }
  }
  return { ownerId, databaseName, rosterBinding:rosterChoiceBinding({roster,teaching,ownerId,databaseName}), teachingId: teaching.id, termId: term.id, teachingRevision: teaching.serverRevision,
    maxChanges, entries, rejected, unchanged, additions, overwrites, capped, newStudents, sectionId: teaching.sectionId, newItems: newItems.filter(i => cells.some(c => c.itemId === i.id)), cells };
}

export function gradeCommand(review, overwriteConfirmed, enrollmentConfirmed = false) {
  if (review.newStudents?.length && !enrollmentConfirmed || review.rejected.length || !review.cells.length && !review.newStudents?.length || review.overwrites && !overwriteConfirmed) throw new Error('GRADE_REVIEW_CONFIRM_REQUIRED');
  return { teachingId: review.teachingId, termId: review.termId, teachingRevision: review.teachingRevision,
    newItems: review.newItems, cells: review.cells, ...(review.newStudents?.length ? { newStudents: review.newStudents.map(({ id, enrollmentId, name }) => ({ id, enrollmentId, name })), sectionId: review.sectionId, enrollmentConfirmed: true } : {}), overwriteConfirmed: overwriteConfirmed === true };
}
