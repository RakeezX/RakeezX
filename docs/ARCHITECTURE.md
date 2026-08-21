# المعمارية — RAKEEZ X

آخر تحديث: 2026-08-16 · يصف **النموذج القائم فعلًا** بعد الموجة الأولى وإصلاحاتها.

---

## الفكرة المركزية: ثلاثة محاور منفصلة

الخلط بين هذه الثلاثة كان أصل كل مشكلة في النسخة الأولى، والفصل بينها أصل التصميم الحالي:

```
الشعبة   (section)  = مجموعة الطلاب «٤/أ»                      — تعيش سنة كاملة
الإسناد  (teaching) = «أُدرّس المهارات الرقمية لـ ٤/أ في الفصل الأول» — يعيش فصلًا دراسيًا
المنهج   (unit/lesson) = «مهارات رقمية · رابع · الفصل الأول»    — يعيش سنوات، بلا شعبة
```

- **الطالب يُسجَّل في شعبة** لا في إسناد، فكشف واحد يخدم كل ما تدرّسه لهم.
- **الدرجات والحصص تتبع الإسناد**، لأن لكل فصل دراسي ١٠٠ درجة وجدولًا مستقلين.
- **المنهج يتبع (مادة + صف + رقم الفصل)** — رقم الفصل لا معرّفه، فيُعاد استعماله كل عام.

---

## المخازن

٢٢ مخزنًا في IndexedDB، كل سجل يحمل `id` و `updatedAt` و `deleted`.

```js
/* الزمن */
years    { id:'y:1448-1449', label, hijriStart, hijriEnd, order, status:'active'|'archived' }
terms    { id:'tm:{yearId}:{index}', yearId, name, index, startDate, endDate,
           status:'upcoming'|'active'|'closed', calendarId }

/* البنية */
subjects { id:'sub:{slug}', name, slug }
sections { id:'sec:{yearId}:{grade}:{label}', yearId, grade, label, name, color, order }
teachings{ id:'tch:{sectionId}|{subjectId}|{termId}', sectionId, subjectId, termId, order }

/* الطلاب */
students    { id:uuid, name, note, status:'active'|'withdrawn' }
enrollments { id:'en:{studentId}:{sectionId}', studentId, sectionId,
              rollNo, startDate, endDate, status, transferNote }

/* الجدول والحصص */
timeProfiles { id:uuid, name, order, periods:[{period,start,end}],
               overrides:{ '3':[…] }, activeFrom, activeTo }
slots        { id:'sl:{teachingId}:{weekday}:{period}', teachingId, weekday, period }
sessions     { id:'se:{teachingId}:{date}:{period}', teachingId, date, period, slotId,
               startTime, endTime, timeProfileId, status, reason, makeupForId,
               lessonId, note, homework, covered }

/* التقويم */
calendars    { id:'cal:{yearId}:{source}', yearId, source:'moe'|'custom', label }
calendarDays { id:'cd:{calendarId}:{date}', calendarId, date, kind, label }

/* المنهج */
units   { id:uuid, subjectId, grade, termIndex, name, order, plannedSessions }
lessons { id:uuid, unitId, name, order, plannedSessions }

/* الرصد */
items      { id:uuid, teachingId, name, max, order, auto, perPoint, penalty, unitId, lessonId }
scores     { id:'sc:{studentId}:{itemId}', studentId, itemId, value }
attendance { id:'at:{studentId}:{sessionId}', studentId, sessionId, teachingId, date, status, note }
logs       { id:uuid, studentId, teachingId, sessionId, date, kind, delta, tag, note }

/* الإعدادات — مفصولة عمدًا */
profile { id:'profile', teacherName, schoolName, phone }          ← تُصدَّر وتُدمج
device  { id:'device', theme, activeYearId, activeTermId,          ← لا تغادر الجهاز
          activeTimeProfileId, lastSyncAt, schemaVersion }

/* جاهزة بلا واجهة */
notes · assignments · submissions

/* المزامنة */
outbox { id:'{store}:{recordId}', store, recordId, op, fields, updatedAt, queuedAt }
```

---

## قرارات ثابتة

### ١. المعرّفات المشتقة

حيث يوجد مفتاح طبيعي يُشتق المعرّف منه بدل توليده عشوائيًا:

```
sc:{studentId}:{itemId}          الدرجة
at:{studentId}:{sessionId}       الحضور
se:{teachingId}:{date}:{period}  الحصة
en:{studentId}:{sectionId}       الانتساب
```

جهازان يعملان دون إنترنت يولّدان **نفس المعرّف** لنفس الحقيقة، فيندمجان عند المزامنة
بدل أن يتضاعفا. أما **الرصد السريع فسجل أحداث بمعرّف عشوائي** — كل نقرة حدث مستقل
والتكرار مقصود.

### ٢. الكتابة تعديل حقول لا استبدال سجل

`patch()` يقرأ السجل **من القرص داخل المعاملة** ويدمج الحقول المطلوبة فوقه.
بلا هذا، نافذة تحمل نسخة قديمة تدهس حقلًا عدّلته نافذة أخرى.
`save()` للسجلات الجديدة فقط.

### ٣. «لم يُرصد» ليست صفرًا

البند غير المرصود يخرج من مقام النسبة لا أن يُحسب صفرًا، فلا يظهر الطالب ضعيفًا لأن
الاختبار النهائي لم يُصحَّح بعد. وبند المشاركة الآلي يبقى «لم يُرصد» ما دام الإسناد كله
بلا رصد مشاركة.

### ٤. الحضور يتفرّع عن الحصة

`at:{studentId}:{sessionId}` — فحصتان لنفس الفصل في يوم واحد سجلان مستقلان.
**والحصة غير المنفّذة لا تولّد سجلات حضور أصلًا**، فلا تُسجَّل غيابًا على أحد ولا
تدخل في نسبة التنفيذ. قاعدة بنيوية لا شرط في الشيفرة.

### ٥. الحصة تحمل وقتها مطبوعًا فيها

`startTime` و `endTime` و `timeProfileId` تُختم عند الإنشاء من ملف التوقيت النشط.
تغيير الملف من صيفي إلى شتوي **لا يعيد كتابة حصة ماضية**.

### ٦. عدد الحصص الأسبوعية مشتق

من عدد `slots` لكل إسناد، لا رقم ثابت في الشيفرة. حصتان أسبوعيًا = سطران في الجدول.

### ٧. الحذف ناعم دائمًا

كل سجل محذوف يبقى بعلامة `deleted` وختم وقت. الحذف الصلب لا يمكن مزامنته: الجهاز
الآخر لا يفرّق بين «حُذف» و«لم يصل بعد».

### ٨. حذف الشعبة لا يحذف الطالب

هوية الطالب مستقلة. حذف الشعبة ينهي **الانتساب**، والخروج من المدرسة `status='withdrawn'`
لا حذفًا — فيبقى السجل التاريخي كاملًا.

### ٩. عدد الفصول الدراسية إعداد لا افتراض

`TERMS_PER_YEAR = 2` ثابت واحد، والواجهة تقرأ الفصول الموجودة فعلًا في السنة النشطة.
رفعه إلى ٣ يُظهر الثالث في كل الواجهات بلا ترحيل.

### ١٠. الحدود في طبقة البيانات لا الشاشة

تقييد الدرجة، ومنع الاسم الفارغ، ومنع تكرار رقم الكشف، وسقف الاستيراد — كلها في
`store.js`. الشاشة وحدها لا تكفي حارسًا: ملف النسخة والمزامنة يدخلان من تحتها.

---

## طبقة العرض

بلا أدوات بناء ولا حزم خارجية: HTML و CSS و ESM خالصة.

```
index.html
sw.js                    عامل الخدمة — العمل دون إنترنت
src/
  app.js                 الغلاف: الإقلاع، الهيكل، إعادة الرسم
  router.js              موجّه على الـ hash
  store.js               الحالة + الحفظ + المحدِّدات + العمليات
  models.js              نموذج البيانات ومنطق الحساب
  repaint.js             جسر إعادة الرسم للشاشات
  lib/
    dom.js               قوالب آمنة + تفويض أحداث + أيقونات
    db.js                غلاف IndexedDB
    export.js            CSV والنسخ الاحتياطي
    migrate.js           ترحيل المخطط القديم
  styles/
    app.css              الرموز والهيكل
    components.css       مكوّنات الشاشات والطباعة
  views/                 شاشة لكل ملف (٢١ شاشة)
```

### عقد الشاشة

```js
export default {
  title: (params) => 'العنوان',
  subtitle: (params) => '…',            // اختياري
  back: (params) => '#/…',              // اختياري
  topActions: (params) => html`…`,      // اختياري
  wide: false,
  render(params) { return html`…` },
  actions: { اسم(el, ev, params) {} },  // data-act / data-change / data-input / data-keydown
  onMount(root, params) {},
  afterPaint(root, params) {},
  onUnmount() {},
};
```

النصوص القادمة من المستخدم تُهرَّب تلقائيًا داخل قالب `` html`` ``، والألوان تمر بـ
`safeColor()` لأن تهريب HTML لا يحمي من حقن CSS.

### التنقل

**سطح المكتب:** شريط جانبي بسبعة عناصر — الرئيسية · الفصول · الجدول · المنهج ·
التقارير · التقويم الدراسي · الإعدادات.

**الجوال:** خمسة أساسية + «المزيد». و**داخل الإسناد** يتحوّل الشريط السفلي إلى تنقّل
سياقي (الفصل · الحضور · الرصد · الدرجات · الطلاب) لأن هذه تُستعمل بيد واحدة أثناء الحصة.

---

## الأداء المقيس

على ٦١٬٠٧١ سجلًا (٥ فصول × ٣٠ طالبًا × سنتين):

| القياس | النتيجة |
|---|---|
| قراءة كل المخازن عند الإقلاع | ٣٨٦ مللي |
| بناء سياق إسناد (كل رسمة) | ٥٫٨ مللي |
| نقرة حضور ← رسم كامل | ١٢ مللي |
| المساحة على القرص | ٢٣ م.ب |

السقف العملي يبدأ عند ~٢٥٠ ألف سجل (خمس سنوات) حيث يصير الإقلاع ~١٫٥ ثانية. الحل
حينها **تحميل السنة النشطة وحدها**، لا إعادة بناء.

---

## ما لم يُبنَ عمدًا

| الميزة | الحالة |
|---|---|
| مولّد حصص الفصل الدراسي من الجدول | النموذج جاهز؛ الحصص تُنشأ عند فتح الحضور |
| استيراد تقويم وزارة التعليم آليًا | الإدخال يدوي، والجداول تستوعبه |
| واجهة الملاحظات المؤرّخة | المخزن جاهز — القرار D-13 مفتوح |
| واجهة الواجبات والتسليمات | المخزنان جاهزان — القرار D-12 مفتوح |
| واجهة تحضير الدرس | حقول الحصة جاهزة (`lessonId`, `homework`, `covered`) |
| تقارير إتقان المفاهيم | `items.unitId` و `items.lessonId` موجودان — الواجهة مؤجلة |
| فهارس IndexedDB | الأداء الحالي يكفي |
