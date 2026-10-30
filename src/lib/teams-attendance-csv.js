// AI N143: local-only Teams report parsing. Never persist report identities.
import { normalizeSearchText } from '../models.js';

const MAX_BYTES = 1024 * 1024;
const invalid = () => new Error('تعذّر قراءة تقرير Teams. اختر تقرير الحضور الأصلي (حتى 1MB و300 صف).');

function tabRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const cell = () => { row.push(field.trim()); field = ''; closed = false; };
  const line = () => { cell(); rows.push(row); row = []; if (rows.length > 300) throw invalid(); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '\t') cell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; line(); }
    else if (c === '"' && !field && !closed) quoted = true;
    else { if (closed || c === '"') throw invalid(); field += c; }
  }
  if (quoted) throw invalid();
  if (field || row.length || closed) line();
  return rows;
}

function summaryDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\D|$)/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[3]) + (m[3].length === 2 ? 2000 : 0), month = +m[1], day = +m[2];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

export function durationSeconds(value) {
  const text = value.toLowerCase().trim();
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text);
  if (clock) return (+clock[1] || 0) * 3600 + +clock[2] * 60 + +clock[3];
  const units = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|ساعة|ساعات|س|minutes?|mins?|m|دقائق|دقيقة|د|seconds?|secs?|s|ثواني|ثانية|ث)/gu;
  let total = 0, found = false;
  const remainder = text.replace(units, (_, n, unit) => {
    found = true;
    total += +n * (/^(h|ساعة|ساعات|س$)/u.test(unit) ? 3600 : /^(m|د)/u.test(unit) ? 60 : 1);
    return '';
  }).replace(/[\s,،]+/g, '');
  return found && !remainder ? total : null;
}

export function parseTeamsAttendance(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length || bytes.length > MAX_BYTES) throw invalid();
  let text;
  try { text = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : 'utf-8', { fatal: true }).decode(bytes); }
  catch { throw invalid(); }
  const rows = tabRows(text.replace(/^\uFEFF/, ''));
  const start = rows.findIndex(r => /^2\.\s*المشاركون$/.test(r[0]));
  const summary = rows.findIndex(r => /^1\.\s*الملخص$/.test(r[0]));
  if (start < 0 || summary < 0 || summary >= start) throw invalid();
  const dates = rows.slice(summary + 1, start).filter(r => /وقت البدء|وقت بدء|وقت بداية|تاريخ البدء/.test(r[0])).map(r => summaryDate(r[1] || ''));
  const reportDate = dates.length === 1 ? dates[0] : null;
  const headerIndex = rows.findIndex((r, i) => i > start && r[0] === 'الاسم');
  const header = rows[headerIndex] || [];
  const col = name => header.indexOf(name);
  const name = col('الاسم'), duration = col('مدة الاجتماع'), role = col('الدور'), email = col('البريد الإلكتروني');
  const upn = header.findIndex(c => /UPN/i.test(c));
  if (headerIndex !== start + 1 || [name, duration, role, email, upn].some(i => i < 0)) throw invalid();
  let organizerIgnored = 0, duplicates = 0;
  const participants = [], identities = new Set();
  for (const row of rows.slice(headerIndex + 1)) {
    if (/^3\./.test(row[0])) break;
    if (row.every(c => !c)) continue;
    if (row.length !== header.length || !row[name]) throw invalid();
    if (/منظم|organizer/i.test(row[role])) { organizerIgnored++; continue; }
    const keys = [row[upn], row[email]].filter(Boolean).map(s => s.trim().toLowerCase());
    const repeated = keys.some(k => identities.has(k));
    keys.forEach(k => identities.add(k));
    if (repeated) { duplicates++; continue; }
    // Drop email/UPN immediately after ephemeral deduplication.
    participants.push({ name: row[name], seconds: durationSeconds(row[duration]) });
  }
  return { reportDate, participants, organizerIgnored, duplicates };
}

export function matchTeamsAttendance(report, roster, shortMinutes = 5) {
  const byName = new Map();
  for (const student of new Map(roster.map(s => [s.id, s])).values()) {
    const key = normalizeSearchText(student.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) || []), student.id]);
  }
  const assigned = new Set();
  return report.participants.map(participant => {
    const matches = byName.get(normalizeSearchText(participant.name)) || [];
    const id = matches.length === 1 ? matches[0] : null;
    const duplicate = id && assigned.has(id);
    if (id) assigned.add(id);
    return { ...participant, studentId: duplicate ? null : id,
      state: duplicate ? 'duplicate' : matches.length > 1 ? 'ambiguous' : id ? 'matched' : 'unmatched',
      short: participant.seconds !== null && participant.seconds < shortMinutes * 60 };
  });
}
