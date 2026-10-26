/**
 * RAKEEZ X — غلاف رقيق حول IndexedDB.
 *
 * كل مخزن يحفظ سجلات لها { id, updatedAt, deleted } — وهذا ما يجعل
 * المزامنة السحابية لاحقًا دمجًا سجلًا سجلًا لا استبدالًا للملف كله.
 */

export const DB_NAME = 'rakeezx';
// Additive V2 sidecars; legacy stores and keys remain unchanged.
export const DB_VERSION = 9;

let activeDatabaseName = DB_NAME;


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
  'sectionCurriculumScopes', // V2 curriculum context (additive, no cloud activation)
  'teachingCourseBindings', // V2 source-course binding (additive, no cloud activation)
  'students',      // هوية الطالب — بلا انتماء دائم
  'enrollments',   // انتساب الطالب لشعبة خلال مدة
  'items',         // بنود التقييم
  'scoreSubitems',
  'scoreSubitemCompletions',
  'scores',
  'slots',         // الجدول الأسبوعي المتكرر
  'sessions',      // الحصص
  'sessionRosterSnapshots', // كشف الحصة المثبّت عند أول رصد حضور
  'attendance',    // الحضور — مرتبط بالحصة لا باليوم
  'logs',          // الرصد السريع
  'calendars',
  'calendarDays',
  'units',         // وحدات المنهج
  'lessons',
  'notes',         // ملاحظات مؤرّخة — النموذج جاهز، بلا واجهة بعد
  'classRules',    // قوانين صفية مرتبطة بالإسناد — بلا واجهة في مرحلة الأساس
  'classGoals',    // هدف صف حالي واحد لكل إسناد
  'classCharterSelections', // اختيار بنود الميثاق المعروضة لكل إسناد
  'groupArrangements', // ترتيب مجموعات مخصص واحد متزامن لكل إسناد
  'closedTermReports', // حقيقة تقارير فصل مغلق — سجلات مكتملة غير قابلة للتعديل
  'assignments',   // الواجبات — النموذج جاهز، بلا واجهة بعد
  'submissions',   // التسليمات — النموذج جاهز، بلا واجهة بعد
  'outbox',        // تغييرات تنتظر المزامنة
];

let _db = null;
let onVersionChange = null;
let productWriteGuard = null;
export function setProductWriteGuard(guard) { productWriteGuard = guard; }
function checkProductWrite(device) { productWriteGuard?.(device); }

export function selectDatabase(databaseName) {
  const name = String(databaseName ?? '').trim();
  if (!/^(?:rakeezx|rakeezx-demo|rakeezx-user-[0-9a-f]{32})$/.test(name)) {
    throw Object.assign(new Error('Invalid resolved Product database name'), { code: 'INVALID_WORKSPACE_DATABASE' });
  }
  if (_db && _db.name !== name) {
    throw Object.assign(new Error('Cannot switch Product databases while one is mounted'), {
      code: 'WORKSPACE_DATABASE_ALREADY_OPEN',
    });
  }
  activeDatabaseName = name;
  return activeDatabaseName;
}

export const getActiveDatabaseName = () => activeDatabaseName;

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
    const r = indexedDB.open(activeDatabaseName, DB_VERSION);

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

export async function put(store, record, options = {}) {
  await applyBatch({ [store]: { put: [record] } }, options);
  return record;
}

export async function putMany(store, records, options = {}) {
  if (!records.length) return records;
  await applyBatch({ [store]: { put: records } }, options);
  return records;
}

/** كتابة ذرّية عبر عدة مخازن: { students: [...], scores: [...] } */
export async function putAcross(batch, { signal, productWrite = false } = {}) {
  const names = Object.keys(batch).filter((k) => batch[k]?.length);
  if (!names.length) return;
  await applyBatch(Object.fromEntries(names.map((name) => [name, { put: batch[name] }])), { signal, productWrite });
}

// The device checkpoint and Product write share a transaction, so a stale tab
// cannot write between the lifecycle safety check and the actual disk commit.
function guardStudentLifecycle(tx, run, allow = false, productWrite = false) {
  const read = tx.objectStore('device').get('device');
  read.onsuccess = () => {
    try { if (productWrite) checkProductWrite(read.result); }
    catch (error) { tx.lifecycleError = error; tx.abort(); return; }
    if (!allow && read.result?.studentLifecycleResume) {
      tx.lifecycleError = Object.assign(new Error('Resume pending student lifecycle reconciliation first'), { code: 'LIFECYCLE_RESUME_REQUIRED' });
      tx.abort();
    } else if (!allow && read.result?.n77DeleteIntent) {
      tx.lifecycleError = Object.assign(new Error('Resume pending N77 Delete before writing Product data'), { code: 'N77_DELETE_RESUME_REQUIRED' });
      tx.abort();
    } else run(read.result);
  };
}

/* ---------- تعديل جزئي ذرّي ---------- */

/**
 * يقرأ السجل من القرص ويدمج التعديل فوقه ويكتبه — داخل معاملة واحدة.
 *
 * الفرق بين «عدّل الملاحظة» و«اكتب السجل كله بنسختي منه»: الثاني يدهس تعديلًا
 * كتبه تبويب آخر (أو جهاز آخر لاحقًا) بين قراءتنا وكتابتنا.
 */
export async function patchMany(store, edits, outboxFor = null, stamp = Date.now(), { productWrite = false } = {}) {
  if (!edits.length) return [];
  const db = await openDB();
  const scope = [...new Set(outboxFor ? [store, 'outbox', 'device'] : [store, 'device'])];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(scope, 'readwrite');
    const os = tx.objectStore(store);
    const ob = outboxFor ? tx.objectStore('outbox') : null;
    const results = [];
    let guardDevice;

    const write = () => { for (const edit of edits) {
      const getReq = os.get(edit.id);
      getReq.onsuccess = () => {
        try {
          if (productWrite) checkProductWrite(guardDevice);
          const current = getReq.result ?? edit.create ?? null;
          if (!current) return;
          const next = { ...current, ...edit.changes, id: edit.id, updatedAt: stamp };
          os.put(next);
          results.push(next);

          if (!ob) return;
          const entry = outboxFor(next, Object.keys(edit.changes));
          if (!entry) return;
          const obReq = ob.get(entry.id);
          obReq.onsuccess = () => ob.put(mergeOutbox(obReq.result, entry));
        } catch (error) { tx.lifecycleError = error; tx.abort(); }
      };
    } };
    if (store === 'device') write();
    else guardStudentLifecycle(tx, (device) => { guardDevice = device; write(); }, false, productWrite);

    tx.oncomplete = () => resolve(results);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.lifecycleError ?? tx.error ?? new Error('أُلغيت المعاملة'));
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
export async function markDeleted(predicates, stamp = Date.now(), outboxFor = null, { productWrite = false } = {}) {
  const names = Object.keys(predicates).filter((n) => STORES.includes(n));
  if (!names.length) return { count: 0, touched: {} };
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([...new Set([...names, 'device', ...(outboxFor ? ['outbox'] : [])])], 'readwrite');
    const outbox = outboxFor ? tx.objectStore('outbox') : null;
    const touched = {};
    let count = 0;

    guardStudentLifecycle(tx, (device) => { for (const name of names) {
      const os = tx.objectStore(name);
      const all = os.getAll();
      all.onsuccess = () => {
        try {
          if (productWrite) checkProductWrite(device);
          const hit = all.result.filter((r) => !r.deleted && predicates[name](r));
          touched[name] = hit.map((r) => r.id);
          for (const r of hit) {
            const next = { ...r, deleted: true, updatedAt: stamp };
            os.put(next);
            const entry = outboxFor?.(name, next);
            if (entry) {
              const previous = outbox.get(entry.id);
              previous.onsuccess = () => outbox.put(mergeOutbox(previous.result, entry));
            }
            count++;
          }
        } catch (error) { tx.lifecycleError = error; tx.abort(); }
      };
    } }, false, productWrite);

    tx.oncomplete = () => resolve({ count, touched });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.lifecycleError ?? tx.error ?? new Error('أُلغيت المعاملة'));
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

    guardStudentLifecycle(tx, (device) => { if (mode === 'replace') {
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
          try {
            checkProductWrite(device);
            const existing = new Map(all.result.map((r) => [r.id, r]));
            for (const r of data[name]) {
              const cur = existing.get(r.id);
              if (!cur || (r.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) {
                os.put(r);
                written++;
              }
            }
          } catch (error) { tx.lifecycleError = error; tx.abort(); }
        };
      }
    } }, false, true);

    tx.oncomplete = () => resolve(written);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.lifecycleError ?? tx.error ?? new Error('أُلغيت المعاملة'));
  });
}

/**
 * Mixed writes/removals in one transaction. With `prepare`, the initial batch
 * declares the scope; the synchronous callback builds writes from records read
 * inside that same transaction, so another tab cannot invalidate the snapshot.
 */
export async function applyBatch(batch, { prepare, allowStudentLifecycle = false, signal, productWrite = false } = {}) {
  const names = Object.keys(batch).filter((n) => STORES.includes(n));
  if (!names.length) return;
  const db = await openDB();
  if (signal?.aborted) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...new Set([...names, 'device'])], 'readwrite');
    const abort = () => { try { tx.abort(); } catch { /* Transaction already settled. */ } };
    signal?.addEventListener('abort', abort, { once: true });
    let failure;
    let guardDevice;
    let writes = batch;
    tx.oncomplete = () => { signal?.removeEventListener('abort', abort); resolve(writes); };
    tx.onerror = (event) => { failure ??= event.target.error; };
    tx.onabort = () => {
      signal?.removeEventListener('abort', abort);
      reject(failure ?? tx.lifecycleError ?? tx.error ?? new Error('أُلغيت العملية'));
    };

    const write = (current) => {
      try {
        if (signal?.aborted) { tx.abort(); return; }
        writes = prepare ? prepare(current) : batch;
        if (!writes || typeof writes !== 'object' || typeof writes.then === 'function') {
          throw new TypeError('applyBatch prepare must return a batch synchronously');
        }
        // Dedicated online lifecycle creates a device checkpoint before its RPC.
        // Reconciliation of an existing checkpoint remains a separate operation.
        const priorCheckpoint = guardDevice?.studentLifecycleResume;
        const nextCheckpoint = writes.device?.put?.find((row) => row.id === 'device')?.studentLifecycleResume;
        if (nextCheckpoint && !priorCheckpoint) checkProductWrite(guardDevice);
        const newEnvelope = writes.outbox?.put?.some((row) => !current?.outbox?.some((prior) => prior.id === row.id));
        if (newEnvelope || productWrite) checkProductWrite(guardDevice);
        for (const [name, operations] of Object.entries(writes)) {
          if (!names.includes(name)) throw new Error(`applyBatch: store outside transaction scope: ${name}`);
          const os = tx.objectStore(name);
          for (const id of operations.remove ?? []) os.delete(id);
          for (const record of operations.put ?? []) os.put(record);
        }
      } catch (error) {
        // A synchronous DataCloneError/DataError does not automatically abort
        // earlier queued writes. Explicitly abort before reporting failure.
        failure = error;
        tx.abort();
      }
    };

    const start = (device) => {
      guardDevice = device;
      if (!prepare && !batch.outbox?.put?.length) return write();
      const current = {};
      let pending = names.length;
      for (const name of names) {
        const read = tx.objectStore(name).getAll();
        read.onsuccess = () => {
          current[name] = read.result;
          if (--pending === 0) write(current);
        };
      }
    };
    guardStudentLifecycle(tx, start, allowStudentLifecycle || names.every((name) => name === 'device'), productWrite);
  });
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
 * Installs a verified CORE_V1 or CORE_V2 snapshot and a local-only receipt atomically.
 * This is valid only for an unmounted deterministic account database.
 */
export async function importInitialRestoreSnapshot(snapshot, device, { assertAccess = () => {} } = {}) {
  const coreStores = Object.keys(snapshot ?? {});
  if (!coreStores.length || coreStores.some((name) => !STORES.includes(name) || !Array.isArray(snapshot[name])) ||
      !device?.initialRestoreReceipt ||
      !['CORE_V1', 'CORE_V2'].includes(device.initialRestoreReceipt.protocol)) {
    throw new Error('Invalid Initial Restore atomic import');
  }
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES, 'readwrite');
    let failure = null;
    let remaining = STORES.length;
    // Initial Restore creates an absent/empty workspace. Recheck inside the
    // import transaction so another tab cannot turn preparation into replacement.
    for (const name of STORES) {
      const count = tx.objectStore(name).count();
      count.onsuccess = () => {
        if (failure) return;
        try {
          assertAccess();
          if (count.result !== 0) throw Object.assign(new Error('Initial Restore cannot replace existing local rows'), {
            code: 'RESTORE_DATABASE_CONFLICT',
          });
          if (--remaining) return;
          for (const store of coreStores) {
            for (const record of snapshot[store]) tx.objectStore(store).put(record);
          }
          tx.objectStore('device').put(device);
        } catch (error) { failure = error; tx.abort(); }
      };
    }
    tx.oncomplete = () => resolve(device.initialRestoreReceipt);
    tx.onerror = (event) => { failure ??= event.target.error; };
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Initial Restore transaction aborted'));
  });
}

export async function readInitialRestoreReceipt() {
  const device = await get('device', 'device');
  return device?.initialRestoreReceipt ?? null;
}

/** Atomically install a server-verified fresh-account foundation, never replacing existing Product rows. */
export async function importAccountProvisioningSnapshot(snapshot, device, { assertAccess = () => {} } = {}) {
  const stores = Object.keys(snapshot ?? {});
  const receipt = device?.accountProvisioningReceipt;
  if (!receipt?.ownerId || receipt.contractVersion !== 1 || !receipt.foundationHash ||
      !stores.includes('profile') || stores.some((name) => !STORES.includes(name) || !Array.isArray(snapshot[name]))) {
    throw Object.assign(new Error('Invalid account provisioning snapshot'), { code: 'ACCOUNT_PROVISIONING_SNAPSHOT_INVALID' });
  }
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES, 'readwrite');
    let failure = null;
    const abort = (code) => {
      failure = Object.assign(new Error(code), { code });
      tx.abort();
    };
    const request = tx.objectStore('device').get('device');
    request.onsuccess = () => {
      try { assertAccess(); } catch (error) { failure = error; tx.abort(); return; }
      const existing = request.result;
      if (existing?.accountProvisioningReceipt) {
        const previous = existing.accountProvisioningReceipt;
        if (previous.ownerId !== receipt.ownerId || previous.contractVersion !== receipt.contractVersion ||
            previous.foundationHash !== receipt.foundationHash) abort('ACCOUNT_PROVISIONING_RECEIPT_MISMATCH');
        return;
      }
      if (existing) { abort('ACCOUNT_PROVISIONING_DATABASE_CONFLICT'); return; }
      let remaining = STORES.length - 1;
      for (const name of STORES) {
        if (name === 'device') continue;
        const count = tx.objectStore(name).count();
        count.onsuccess = () => {
          if (count.result !== 0) { abort('ACCOUNT_PROVISIONING_DATABASE_CONFLICT'); return; }
          remaining -= 1;
          if (remaining !== 0) return;
          try {
            assertAccess();
            for (const store of stores) for (const record of snapshot[store]) tx.objectStore(store).put(record);
            tx.objectStore('device').put(device);
          } catch (error) { failure = error; tx.abort(); }
        };
      }
    };
    tx.oncomplete = () => resolve(receipt);
    tx.onerror = (event) => { failure ??= event.target.error; };
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Account provisioning import aborted'));
  });
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
