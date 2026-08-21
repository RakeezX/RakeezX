/** RAKEEZ X — التصدير: ملفات CSV تفتح في إكسل بالعربية، ونسخة احتياطية JSON كاملة. */

import * as db from './db.js';


/** معرّف المنتج التقني — يُكتب في كل نسخة احتياطية. */
export const APP_ID = 'rakeezx';
export const BACKUP_VERSION = 3;

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

const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
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

export async function buildBackup() {
  const payload = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {},
  };
  for (const store of db.STORES) {
    if (DEVICE_ONLY_STORES.includes(store)) continue;
    payload.data[store] = await db.getAll(store);
  }
  return payload;
}

export async function downloadBackup() {
  const payload = await buildBackup();
  const stamp = payload.exportedAt.slice(0, 10);
  downloadBlob(
    `rakeezx-backup-${stamp}.json`,
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
    add('هذا الملف ليس نسخة احتياطية من RAKEEZ X.');
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
  return { ok: errors.length === 0, errors, counts, total };
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
  const check = validateBackup(payload);
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
