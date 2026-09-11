/** RAKEEZ X — التصدير: ملفات CSV تفتح في إكسل بالعربية، ونسخة احتياطية JSON كاملة. */

import * as db from './db.js';
import * as cloud from './cloud.js';
import { todayISO } from '../models.js';


/** معرّف المنتج التقني — يُكتب في كل نسخة احتياطية. */
export const APP_ID = 'rakeezx';
export const BACKUP_VERSION = 4;
export const LEGACY_BACKUP_VERSION = 3;

/**
 * مخازن **لا تدخل النسخة الاحتياطية ولا تُستورد منها إطلاقًا**.
 *
 * `device` إعدادات هذا الجهاز: المظهر، والسنة والفصل النشطان، وملف التوقيت النشط.
 * إدخالها في النسخ يجعل ملفًا من جهاز آخر — أو نسخة قديمة من نفس الجهاز — يقفز
 * بالمعلّم إلى فصل دراسي غير الذي يعمل عليه، ويغيّر مظهره بلا سبب.
 * `meta` سجل مهجور بقي للترحيل فقط.
 */
export const DEVICE_ONLY_STORES = ['device', 'meta', 'outbox'];

/* ---------- تنزيل ---------- */

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- CSV ---------- */

/**
 * CSV is plain semantic text, unlike the RTL DOM where directional isolates
 * are useful for visual ordering. Keep Arabic Unicode intact, but never leak
 * presentation controls into a spreadsheet cell.
 */
export const sanitizeExportText = (value) => String(value ?? '').replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '');

const cell = (v) => {
  const s = sanitizeExportText(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (rows) => rows.map((r) => r.map(cell).join(',')).join('\r\n');

/**
 * إكسل لا يقرأ العربية إلا بعلامة ترتيب البايتات في أول الملف — فنضعها.
 *
 * ولا نضع سطر `sep=,`: إكسل يفهمه، لكن Google Sheets و Numbers و LibreOffice
 * تقرؤه **صفًا أول من البيانات** فيفسد الملف عندها. والفاصلة مع علامة البايتات
 * تكفي إكسل في الإعداد العربي.
 */
export function downloadCSV(filename, rows) {
  const body = '﻿' + toCSV(rows);
  downloadBlob(filename, new Blob([body], { type: 'text/csv;charset=utf-8' }));
}

/* ---------- نسخة احتياطية ---------- */

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function stableBackupJSON(value) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : stableBackupJSON(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function backupHashInput(payload) {
  const copy = structuredClone(payload);
  delete copy.backupHash;
  return copy;
}

function baselineFor(record) {
  const canonical = record.serverCanonical && typeof record.serverCanonical === 'object'
    ? record.serverCanonical : null;
  return {
    id: record.id,
    revision: Number(record.serverRevision ?? canonical?.serverRevision ?? 0),
    fieldRevisions: structuredClone(record.fieldRevisions ?? canonical?.fieldRevisions ?? {}),
    deleted: canonical?.deleted === true || record.deleted === true,
    value: canonical ? structuredClone(canonical) : null,
  };
}

export async function buildBackup({ sourceOwnerId = cloud.user?.id ?? null, backupId = globalThis.crypto.randomUUID() } = {}) {
  const payload = {
    app: APP_ID,
    version: BACKUP_VERSION,
    backupId,
    sourceOwnerId,
    exportedAt: new Date().toISOString(),
    data: {},
    baselines: {},
  };
  for (const store of db.STORES) {
    if (DEVICE_ONLY_STORES.includes(store)) continue;
    payload.data[store] = (await db.getAll(store)).filter((record) => !String(record.id ?? '').startsWith('demo:'));
    payload.baselines[store] = payload.data[store].map(baselineFor);
  }
  payload.backupHash = await sha256Hex(backupHashInput(payload));
  return payload;
}

export const backupFilenameForDate = (date = new Date()) => `rakeezx-backup-${todayISO(date)}.json`;

export async function downloadBackup() {
  const payload = await buildBackup();
  downloadBlob(
    backupFilenameForDate(),
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  );
  return payload;
}

/* ---------- التحقق ---------- */

const MAX_ERRORS = 8;

/**
 * يفحص ملف النسخة كاملًا **قبل** أن تُمسّ أي بيانات.
 *
 * يقبل مصدرين: نسخة RAKEEZ X، ونسخة النسخة السابقة من التطبيق — والثانية
 * تُرحَّل إلى الشكل الجديد عند الاستيراد ولا تُكتب أبدًا بشكلها القديم.
 */
export function validateBackup(payload) {
  const errors = [];
  const counts = {};
  const add = (msg) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['الملف ليس نسخة احتياطية صالحة.'], counts, total: 0, legacy: false };
  }

  if (payload.app !== APP_ID) {
    add('هذا الملف ليس نسخة احتياطية من رَكيز المعلم.');
  }
  if (!Number.isInteger(payload.version)) add('إصدار النسخة غير معروف.');
  else if (payload.version > BACKUP_VERSION) {
    add('النسخة أحدث من التطبيق. حدّث التطبيق أولًا.');
  }

  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    add('الملف لا يحوي بيانات.');
    return { ok: false, errors, counts, total: 0 };
  }

  // المخازن المسموحة
  const allowed = new Set(db.STORES);

  let total = 0;
  for (const [storeName, records] of Object.entries(payload.data)) {
    if (!allowed.has(storeName)) {
      add(`مخزن غير معروف في الملف: ${storeName}`);
      continue;
    }
    if (!Array.isArray(records)) {
      add(`«${storeName}» ليس قائمة سجلات.`);
      continue;
    }

    const seen = new Set();
    records.forEach((rec, i) => {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
        add(`${storeName}[${i}]: ليس سجلًا.`);
        return;
      }
      if (typeof rec.id !== 'string' || !rec.id) {
        add(`${storeName}[${i}]: سجل بلا معرّف نصي.`);
        return;
      }
      if (seen.has(rec.id)) {
        add(`${storeName}: معرّف مكرر داخل الملف (${rec.id.slice(0, 24)}).`);
        return;
      }
      seen.add(rec.id);
      if (rec.updatedAt !== undefined && !Number.isFinite(rec.updatedAt)) {
        add(`${storeName}[${i}]: ختم وقت غير صالح.`);
      }
      if (rec.deleted !== undefined && typeof rec.deleted !== 'boolean') {
        add(`${storeName}[${i}]: قيمة الحذف غير منطقية.`);
      }
    });

    counts[storeName] = records.length;
    total += records.length;
  }

  if (!total) add('الملف لا يحوي أي سجل.');
  if (payload.version >= 4) {
    if (typeof payload.backupId !== 'string' || !payload.backupId || payload.backupId.length > 200) add('معرّف النسخة الاحتياطية مفقود.');
    if (!(payload.sourceOwnerId === null || (typeof payload.sourceOwnerId === 'string' && payload.sourceOwnerId.length <= 200))) {
      add('هوية مالك النسخة غير صالحة.');
    }
    if (typeof payload.backupHash !== 'string' || !/^[a-f0-9]{64}$/.test(payload.backupHash)) add('بصمة النسخة الاحتياطية غير صالحة.');
    if (!payload.baselines || typeof payload.baselines !== 'object' || Array.isArray(payload.baselines)) {
      add('دليل خط الأساس السحابي مفقود.');
    } else {
      for (const [storeName, baselines] of Object.entries(payload.baselines)) {
        if (!allowed.has(storeName) || !Array.isArray(baselines)) {
          add(`خط أساس غير صالح: ${storeName}`);
          continue;
        }
        const dataIds = new Set(Array.isArray(payload.data[storeName]) ? payload.data[storeName].map((row) => row.id) : []);
        const seen = new Set();
        for (const baseline of baselines) {
          if (!baseline || typeof baseline.id !== 'string' || !dataIds.has(baseline.id) || seen.has(baseline.id) ||
              !Number.isSafeInteger(baseline.revision) || baseline.revision < 0 ||
              (baseline.value !== null && (typeof baseline.value !== 'object' || Array.isArray(baseline.value))) ||
              (baseline.fieldRevisions !== undefined && (!baseline.fieldRevisions || typeof baseline.fieldRevisions !== 'object' || Array.isArray(baseline.fieldRevisions)))) {
            add(`خط أساس غير صالح في ${storeName}.`);
            break;
          }
          seen.add(baseline.id);
        }
        for (const record of payload.data[storeName] ?? []) {
          if (Number(record.serverRevision ?? 0) > 0 && !baselines.some((baseline) => baseline.id === record.id && baseline.value)) {
            add(`سجل سحابي بلا خط أساس في ${storeName}.`);
            break;
          }
        }
      }
      for (const [storeName, records] of Object.entries(payload.data)) {
        const baselines = Array.isArray(payload.baselines[storeName]) ? payload.baselines[storeName] : [];
        if (records.some((record) => Number(record.serverRevision ?? 0) > 0 &&
            !baselines.some((baseline) => baseline.id === record.id && baseline.value))) {
          add(`سجل سحابي بلا خط أساس في ${storeName}.`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors, counts, total };
}

/** Full integrity verification for V4. V3 remains structurally readable. */
export async function validateBackupIntegrity(payload) {
  const structural = validateBackup(payload);
  if (!structural.ok || payload.version < 4) return { ...structural, integrity: payload?.version === 3 ? 'legacy' : 'invalid' };
  const actualHash = await sha256Hex(backupHashInput(payload));
  if (actualHash !== payload.backupHash) {
    return { ...structural, ok: false, integrity: 'invalid', errors: [...structural.errors, 'بصمة النسخة الاحتياطية لا تطابق محتواها.'] };
  }
  return { ...structural, integrity: 'verified' };
}

/**
 * يستورد نسخة احتياطية.
 * mode='merge'   يبقي ما عندك ويأخذ الأحدث لكل سجل (الآمن).
 * mode='replace' يمسح كل شيء ويضع النسخة مكانه.
 *
 * لا يُمسّ شيء قبل اجتياز التحقق، والكتابة كلها معاملة واحدة: إن فشل أي سجل
 * تراجعت المعاملة وبقيت البيانات كما كانت تمامًا.
 *
 * النسخ القديمة تُرحَّل إلى الشكل الجديد قبل الكتابة — فلا تدخل القاعدة
 * سجلات بشكل قديم ولا يعمل التطبيق بأسماء مخفية.
 */
export async function restoreBackup(payload, mode = 'merge') {
  const check = await validateBackupIntegrity(payload);
  if (!check.ok) {
    const err = new Error(check.errors.join('\n'));
    err.name = 'BackupValidationError';
    err.details = check;
    throw err;
  }

  let source = payload.data;
  const data = {};
  const skipped = [];

  for (const name of db.STORES) {
    if (!Array.isArray(source[name])) continue;
    // إعدادات الجهاز تُتجاهل مهما كان الوضع — الاستبدال يستبدل السجلات لا الجهاز
    if (DEVICE_ONLY_STORES.includes(name)) {
      if (source[name].length) skipped.push(name);
      continue;
    }
    data[name] = source[name];
  }

  const written = await db.writeAll(data, mode === 'replace' ? 'replace' : 'merge', {
    keep: DEVICE_ONLY_STORES,
  });
  return { written, migration: null, skipped };
}

/** يقرأ ملفًا اختاره المستخدم ويحوّله كائنًا. */
export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        resolve(JSON.parse(String(fr.result)));
      } catch {
        reject(new Error('تعذّرت قراءة الملف — تأكد أنه ملف نسخة احتياطية صالح.'));
      }
    };
    fr.onerror = () => reject(new Error('تعذّر فتح الملف.'));
    fr.readAsText(file);
  });
}
