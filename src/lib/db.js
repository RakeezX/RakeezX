/**
 * RAKEEZ X — غلاف رقيق حول IndexedDB.
 *
 * كل مخزن يحفظ سجلات لها { id, updatedAt, deleted } — وهذا ما يجعل
 * المزامنة السحابية لاحقًا دمجًا سجلًا سجلًا لا استبدالًا للملف كله.
 */

export const DB_NAME = 'rakeezx';
export const DB_VERSION = 2;


export const STORES = [
  'profile',       // بيانات المعلّم — تُصدَّر وتُدمج
  'device',        // إعدادات هذا الجهاز — لا تُصدَّر ولا تُستورد أبدًا
  'timeProfiles',  // ملفات توقيت الحصص
  'meta',          // مهجور: سجل الإعدادات القديم قبل الفصل — يُقرأ للترحيل ثم يُفرَّغ
  'years',         // السنوات الدراسية
  'terms',         // الفصول الدراسية
  'subjects',      // المواد
  'sections',      // الشعب (٤/أ) — تعيش السنة كاملة
  'teachings',     // الإسناد التدريسي: شعبة × مادة × فصل دراسي
  'students',      // هوية الطالب — بلا انتماء دائم
  'enrollments',   // انتساب الطالب لشعبة خلال مدة
  'items',         // بنود التقييم
  'scores',
  'slots',         // الجدول الأسبوعي المتكرر
  'sessions',      // الحصص
  'attendance',    // الحضور — مرتبط بالحصة لا باليوم
  'logs',          // الرصد السريع
  'calendars',
  'calendarDays',
  'units',         // وحدات المنهج
  'lessons',
  'notes',         // ملاحظات مؤرّخة — النموذج جاهز، بلا واجهة بعد
  'assignments',   // الواجبات — النموذج جاهز، بلا واجهة بعد
  'submissions',   // التسليمات — النموذج جاهز، بلا واجهة بعد
  'outbox',        // تغييرات تنتظر المزامنة
];

let _db = null;
let onVersionChange = null;

/** يُبلَّغ حين يطلب تبويب آخر ترقية القاعدة، فيعيد التطبيق تحميل نفسه. */
export const setVersionChangeHandler = (fn) => {
  onVersionChange = fn;
};

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function upgrade(db) {
  for (const name of STORES) {
    if (!db.objectStoreNames.contains(name)) {
      db.createObjectStore(name, { keyPath: 'id' });
    }
  }
}

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);

    r.onupgradeneeded = () => upgrade(r.result);

    r.onsuccess = () => {
      _db = r.result;
      // تبويب آخر يطلب ترقية: أغلق اتصالنا فورًا وإلا حُجبت الترقية عنده،
      // ثم أبلغ التطبيق ليعيد التحميل على المخطط الجديد.
      _db.onversionchange = () => {
        if (_db) _db.close();
        _db = null;
        onVersionChange?.();
      };
      resolve(_db);
    };

    r.onerror = () => reject(r.error);

    // نافذة قديمة تمسك القاعدة: لا نفشل صامتين — نخبر المستخدم بما يفعل.
    r.onblocked = () =>
      reject(new Error('التطبيق مفتوح في نافذة أخرى. أغلق بقية النوافذ ثم أعد التحميل.'));
  });
}

export async function getAll(store) {
  const db = await openDB();
  return req(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function get(store, id) {
  const db = await openDB();
  return req(db.transaction(store, 'readonly').objectStore(store).get(id));
}

export async function put(store, record) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(record);
  return txDone(tx).then(() => record);
}

export async function putMany(store, records) {
  if (!records.length) return records;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const r of records) os.put(r);
  return txDone(tx).then(() => records);
}

/** كتابة ذرّية عبر عدة مخازن: { students: [...], scores: [...] } */
export async function putAcross(batch) {
  const names = Object.keys(batch).filter((k) => batch[k]?.length);
  if (!names.length) return;
  const db = await openDB();
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) {
    const os = tx.objectStore(name);
    for (const r of batch[name]) os.put(r);
  }
  return txDone(tx);
}

/* ---------- تعديل جزئي ذرّي ---------- */

/**
 * يقرأ السجل من القرص ويدمج التعديل فوقه ويكتبه — داخل معاملة واحدة.
 *
 * الفرق بين «عدّل الملاحظة» و«اكتب السجل كله بنسختي منه»: الثاني يدهس تعديلًا
 * كتبه تبويب آخر (أو جهاز آخر لاحقًا) بين قراءتنا وكتابتنا.
 */
export async function patchMany(store, edits, outboxFor = null, stamp = Date.now()) {
  if (!edits.length) return [];
  const db = await openDB();
  const scope = outboxFor ? [store, 'outbox'] : [store];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(scope, 'readwrite');
    const os = tx.objectStore(store);
    const ob = outboxFor ? tx.objectStore('outbox') : null;
    const results = [];

    for (const edit of edits) {
      const getReq = os.get(edit.id);
      getReq.onsuccess = () => {
        const current = getReq.result ?? edit.create ?? null;
        if (!current) return;
        const next = { ...current, ...edit.changes, id: edit.id, updatedAt: stamp };
        os.put(next);
        results.push(next);

        if (!ob) return;
        const entry = outboxFor(next, Object.keys(edit.changes));
        const obReq = ob.get(entry.id);
        obReq.onsuccess = () => ob.put(mergeOutbox(obReq.result, entry));
      };
    }

    tx.oncomplete = () => resolve(results);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('أُلغيت المعاملة'));
  });
}

function mergeOutbox(prev, next) {
  if (!prev) return next;
  return {
    ...next,
    fields: [...new Set([...(prev.fields ?? []), ...(next.fields ?? [])])],
    op: prev.op === 'delete' || next.op === 'delete' ? 'delete' : next.op,
    queuedAt: prev.queuedAt ?? next.queuedAt,
  };
}

/**
 * حذف ناعم متتالٍ: يقرأ السجلات من القرص (لا من الذاكرة) ويعلّمها محذوفة،
 * في معاملة واحدة.
 */
export async function markDeleted(predicates, stamp = Date.now()) {
  const names = Object.keys(predicates).filter((n) => STORES.includes(n));
  if (!names.length) return { count: 0, touched: {} };
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    const touched = {};
    let count = 0;

    for (const name of names) {
      const os = tx.objectStore(name);
      const all = os.getAll();
      all.onsuccess = () => {
        const hit = all.result.filter((r) => !r.deleted && predicates[name](r));
        touched[name] = hit.map((r) => r.id);
        for (const r of hit) {
          os.put({ ...r, deleted: true, updatedAt: stamp });
          count++;
        }
      };
    }

    tx.oncomplete = () => resolve({ count, touched });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('أُلغيت المعاملة'));
  });
}

/**
 * كتابة النسخة الاحتياطية كلها في معاملة واحدة.
 * في وضع الاستبدال يقع المسح والكتابة معًا: إن فشل أي سجل تراجعت المعاملة
 * كاملة وبقيت البيانات كما كانت — لا حالة جزئية.
 */
export async function writeAll(data, mode = 'merge', { keep = [] } = {}) {
  const names = STORES.filter((s) => Array.isArray(data[s]));
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    let written = 0;

    if (mode === 'replace') {
      // `keep` تُستثنى من المسح: إعدادات الجهاز تبقى ملك الجهاز حتى في الاستبدال
      for (const name of STORES) {
        if (keep.includes(name)) continue;
        tx.objectStore(name).clear();
      }
      for (const name of names) {
        const os = tx.objectStore(name);
        for (const r of data[name]) {
          os.put(r);
          written++;
        }
      }
    } else {
      for (const name of names) {
        const os = tx.objectStore(name);
        const all = os.getAll();
        all.onsuccess = () => {
          const existing = new Map(all.result.map((r) => [r.id, r]));
          for (const r of data[name]) {
            const cur = existing.get(r.id);
            if (!cur || (r.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) {
              os.put(r);
              written++;
            }
          }
        };
      }
    }

    tx.oncomplete = () => resolve(written);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('أُلغيت المعاملة'));
  });
}

/** كتابة وحذف مختلطان عبر مخازن، في معاملة واحدة. يستعملها الترحيل. */
export async function applyBatch(batch) {
  const names = Object.keys(batch).filter((n) => STORES.includes(n));
  if (!names.length) return;
  const db = await openDB();
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) {
    const os = tx.objectStore(name);
    for (const id of batch[name].remove ?? []) os.delete(id);
    for (const r of batch[name].put ?? []) os.put(r);
  }
  return txDone(tx);
}

export async function remove(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  return txDone(tx);
}

export async function clearStore(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  return txDone(tx);
}

export async function clearAll() {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) tx.objectStore(name).clear();
  return txDone(tx);
}

/**
 * يُغلق اتصال قاعدة البيانات تمامًا.
 * يُستدعى من بيئة الاختبار فقط بعد انتهاء جميع الاختبارات لمنع تسرّب الموارد
 * وإبقاء Node.js حيًّا بعد انتهاء مجموعة الاختبارات.
 */
export function closeDB() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('أُلغيت العملية'));
  });
}

/* ---------- المساحة ---------- */

export async function usage() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage: used, quota } = await navigator.storage.estimate();
    return { used, quota };
  } catch {
    return null;
  }
}

export async function persist() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
