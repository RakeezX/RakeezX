// AI N143: local-only Teams report parsing. Never persist report identities.
import { normalizeSearchText } from '../models.js';
import { validDateTimeValue, normalizeDateTimeDigits } from './rakeez-datetime-values.js';

const MAX_BYTES = 1024 * 1024;
const invalid = () => new Error('تعذّر قراءة تقرير Teams. اختر تقرير الحضور الأصلي (حتى 1MB و300 صف).');

function tabRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const cell = () => { row.push(field.trim()); field = ''; closed = false; };
  const line = () => { cell(); rows.push(row); row = []; if (rows.length > 1000) throw invalid(); };
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

// Teams' documented M/D/Y report format and local wall-clock values only.
// Never let Date.parse or the machine timezone reinterpret a class/report time.
function reportTime(value, defaultDate = null) {
  let text = normalizeDateTimeDigits(value).trim(), date = defaultDate;
  const dated = /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}))(?:[,،]?\s+|T)(.*)$/.exec(text);
  if (dated) {
    const year = dated[1] || String(+dated[6] + (dated[6].length === 2 ? 2000 : 0));
    date = `${year}-${String(dated[2] || dated[4]).padStart(2, '0')}-${String(dated[3] || dated[5]).padStart(2, '0')}`;
    text = dated[7];
  }
  const clock = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM|ص|م)?$/i.exec(text);
  if (!date || !validDateTimeValue(date, 'date') || !clock) return null;
  let hour = +clock[1];
  if (clock[4]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (/^(PM|م)$/i.test(clock[4]) ? 12 : 0);
  }
  if (hour > 23) return null;
  return {date, seconds: hour * 3600 + +clock[2] * 60 + +(clock[3] || 0)};
}

export function durationSeconds(value) {
  const text = normalizeDateTimeDigits(value).toLowerCase().trim();
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text);
  if (clock) return +clock[2] < 60 && +clock[3] < 60 ? (+clock[1] || 0) * 3600 + +clock[2] * 60 + +clock[3] : null;
  const units = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|ساعة|ساعات|س|minutes?|mins?|m|دقائق|دقيقة|د|seconds?|secs?|s|ثواني|ثانية|ث)/gu;
  let total = 0, found = false;
  const remainder = text.replace(units, (_, n, unit) => {
    found = true;
    total += +n * (/^(h|ساعة|ساعات|س$)/u.test(unit) ? 3600 : /^(m|د)/u.test(unit) ? 60 : 1);
    return '';
  }).replace(/[\s,،]+/g, '');
  return found && !remainder ? total : null;
}

const aliases = {
  name: ['الاسم', 'Name', 'Full Name'], first: ['وقت الانضمام الأول', 'First Join', 'First join'],
  last: ['وقت المغادرة الأخير', 'Last Leave', 'Last leave'],
  duration: ['مدة الاجتماع', 'In-Meeting Duration', 'In-meeting duration'],
  role: ['الدور', 'Role'], email: ['البريد الإلكتروني', 'Email'],
  join: ['وقت الانضمام', 'Join Time', 'Join time'], leave: ['وقت المغادرة', 'Leave Time', 'Leave time'],
};
const column = (header, key) => header.findIndex(c => key === 'upn' ? /UPN/i.test(c) : aliases[key].some(a => a.toLowerCase() === c.toLowerCase()));
const organizer = value => /منظم|organizer/i.test(value || '');
const identityKeys = (row, header) => ['upn', 'email'].map(k => row[column(header, k)] || '').filter(Boolean).map(s => s.toLowerCase());
function interval(first, last, date) {
  const a = reportTime(first, date), b = reportTime(last, date);
  return a && b && a.date === date && b.date === date && b.seconds > a.seconds ? [a.seconds, b.seconds] : null;
}

export function parseTeamsAttendance(buffer) {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length || bytes.length > MAX_BYTES) throw invalid();
  let text;
  try { text = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : 'utf-8', { fatal: true }).decode(bytes); }
  catch { throw invalid(); }
  const rows = tabRows(text.replace(/^\uFEFF/, ''));
  const start = rows.findIndex(r => /^2\.\s*(المشاركون|Participants)$/i.test(r[0]));
  const summary = rows.findIndex(r => /^1\.\s*(الملخص|Summary)$/i.test(r[0]));
  const activity = rows.findIndex((r, i) => i > start && /^3\./.test(r[0]));
  if (start < 0 || summary < 0 || summary >= start) throw invalid();
  const starts = rows.slice(summary + 1, start).filter(r => /وقت البدء|وقت بدء|وقت بداية|تاريخ البدء|Start time|Meeting start time/i.test(r[0]));
  const stamp = starts.length === 1 ? reportTime(starts[0][1] || '') : null;
  const reportDate = stamp?.date || null;
  const header = rows[start + 1] || [];
  if (['name', 'duration', 'role', 'email', 'upn'].some(k => column(header, k) < 0)) throw invalid();
  const groups = [], identity = new Map(), organizerKeys = new Set(), organizerNames = new Set();
  let organizerIgnored = 0, duplicates = 0, dataRows = 0;
  const count = () => { if (++dataRows > 300) throw invalid(); };
  for (const row of rows.slice(start + 2, activity < 0 ? rows.length : activity)) {
    if (row.every(c => !c)) continue;
    count();
    if (row.length !== header.length || !row[column(header, 'name')]) throw invalid();
    const keys = identityKeys(row, header);
    if (organizer(row[column(header, 'role')])) {
      keys.forEach(k => organizerKeys.add(k)); organizerNames.add(normalizeSearchText(row[column(header, 'name')]));
      organizerIgnored++; continue;
    }
    const upn = (row[column(header, 'upn')] || '').toLowerCase();
    const found = [...new Set(keys.flatMap(k => [...(identity.get(k) || [])]))]
      .filter(g => !upn || !g.upns.size || g.upns.has(upn));
    let group = found.length === 1 ? found[0] : null;
    if (!group) {
      group = {names: new Set(), keys: new Set(), upns: new Set(), summaries: [], intervals: [], activity: false, invalid: found.length > 1};
      groups.push(group);
    } else duplicates++;
    if (upn) group.upns.add(upn);
    keys.forEach(k => { identity.set(k, new Set([...(identity.get(k) || []), group])); group.keys.add(k); });
    group.names.add(normalizeSearchText(row[column(header, 'name')]));
    const span = interval(row[column(header, 'first')] || '', row[column(header, 'last')] || '', reportDate);
    const seconds = durationSeconds(row[column(header, 'duration')]);
    // A first/last span is defensible only if total duration covers that span.
    // Otherwise unknown gaps must never be filled from a summary.
    group.summaries.push(span && seconds === span[1] - span[0] ? span : null);
  }
  if (activity >= 0) {
    const ah = rows[activity + 1] || [];
    if (['name', 'join', 'leave'].some(k => column(ah, k) < 0)) throw invalid();
    for (const row of rows.slice(activity + 2)) {
      if (row.every(c => !c)) continue;
      count();
      if (row.length !== ah.length) throw invalid();
      const keys = identityKeys(row, ah), name = normalizeSearchText(row[column(ah, 'name')] || '');
      if (organizer(row[column(ah, 'role')])) { keys.forEach(k => organizerKeys.add(k)); organizerNames.add(name); continue; }
      if (keys.some(k => organizerKeys.has(k))) continue;
      const upn = (row[column(ah, 'upn')] || '').toLowerCase();
      const candidates = keys.length ? [...new Set(keys.flatMap(k => [...(identity.get(k) || [])]))]
        .filter(g => !upn || !g.upns.size || g.upns.has(upn)) : groups.filter(g => g.names.has(name));
      if ((!keys.length && organizerNames.has(name)) || (keys.length && !candidates.length)) {
        for (const g of groups.filter(g => g.names.has(name))) { g.activity = true; g.invalid = true; }
        continue;
      }
      if (candidates.length !== 1) {
        // Ambiguous name-only evidence cannot justify a summary fallback either.
        for (const g of candidates) { g.activity = true; g.invalid = true; }
        continue;
      }
      const g = candidates[0];
      g.activity = true;
      const span = interval(row[column(ah, 'join')], row[column(ah, 'leave')], reportDate);
      if (!span || !g.names.has(name)) g.invalid = true;
      else g.intervals.push(span);
    }
  }
  // No raw email/UPN escapes parsing; grouping lives only in this invocation.
  const participants = groups.filter(g => ![...g.keys].some(k => organizerKeys.has(k))).map(g => ({
    name: [...g.names][0], ambiguous: g.names.size !== 1,
    intervals: g.invalid ? [] : g.activity ? g.intervals : g.summaries.every(Boolean) ? g.summaries : [],
  }));
  return {reportDate, participants, organizerIgnored, duplicates};
}

export function matchTeamsAttendance(report, roster, session) {
  if (!session?.date || !validDateTimeValue(session.date, 'date') || report.reportDate !== session.date ||
      !session.startTime || !session.endTime || !validDateTimeValue(session.startTime, 'time') ||
      !validDateTimeValue(session.endTime, 'time')) throw Error('TEAMS_CLASS_WINDOW_INVALID');
  const seconds = time => +time.slice(0, 2) * 3600 + +time.slice(3) * 60;
  const start = seconds(session.startTime), end = seconds(session.endTime);
  if (end <= start) throw Error('TEAMS_CLASS_WINDOW_INVALID');
  const byName = new Map(), reportNames = new Map();
  for (const student of new Map(roster.map(s => [s.id, s])).values()) {
    const key = normalizeSearchText(student.name);
    if (key) byName.set(key, [...(byName.get(key) || []), student.id]);
  }
  for (const p of report.participants) reportNames.set(p.name, (reportNames.get(p.name) || 0) + 1);
  return report.participants.map(p => {
    const matches = byName.get(p.name) || [];
    const ambiguous = p.ambiguous || matches.length > 1 || reportNames.get(p.name) > 1;
    if (ambiguous || matches.length !== 1) return {studentId: null, status: null, state: ambiguous ? 'ambiguous' : 'unmatched'};
    if (!p.intervals.length) return {studentId: null, status: null, state: 'invalid'};
    const clipped = p.intervals.map(([a,b]) => [Math.max(a,start), Math.min(b,end)]).filter(([a,b]) => b > a).sort((a,b) => a[0] - b[0]);
    let total = 0, until = start;
    for (const [a,b] of clipped) { total += Math.max(0, b - Math.max(a,until)); until = Math.max(until,b); }
    const first = Math.min(...p.intervals.map(([entry]) => entry));
    return {studentId: matches[0], status: total < (end - start) / 2 ? 'absent' : first > start + 300 ? 'late' : 'present', state: 'matched'};
  });
}
