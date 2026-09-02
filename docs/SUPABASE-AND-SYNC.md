# Supabase والمزامنة — القرارات والتصميم

آخر تحديث: 2026-08-16 · **لم تبدأ المزامنة. لم يُربط التطبيق بالقاعدة.**

المشروع: **Teacher Tools Project** · الإقليم: South Asia (Mumbai) `ap-south-1`

---

## ١. المخطط

`supabase/migrations/` — ملفان، والقاعدة قابلة لإعادة البناء منهما وحدهما:

| الملف | المحتوى |
|---|---|
| `0001_core_schema.sql` | ١٩ جدولًا · مفاتيح · علاقات · قيود فريدة · قيود تحقق |
| `0002_indexes_triggers_rls.sql` | فهارس · أختام الخادم · سياسات الوصول · صلاحيات الأدوار |

كل شيء في `schema rakeezx` لا في `public` — عزلًا عن جداول Supabase الداخلية.

### الجداول

```
profile · years · terms · subjects · sections · teachings
students · enrollments
units · lessons · items · scores
time_profiles · slots · sessions · attendance · logs
calendars · calendar_days
```

**لم تُنشأ:** `assignments` · `submissions` · `notes`. القرار D-12 مؤجل: قد تصبح الواجبات/المشاريع وحدة مستقلة لاحقًا. القرار D-13 محسوم: ستكون ملاحظات الطلاب سجلًا مؤرخًا متعدد الإدخالات، لا حقلًا واحدًا قابلًا للكتابة فوقه. لا يُنفّذ أي منهما الآن؛ وإنشاء جدول بشكل نصف محسوم أسوأ من تأجيله.

**ولم يُرفع `device`** — إعدادات الجهاز لا تغادره أصلًا.

### أعمدة ثابتة في كل جدول

| العمود | الغرض |
|---|---|
| `owner_id uuid` | مالك الصف، مربوط بـ `auth.users`، تحرسه RLS |
| `id text` | المعرّف المشتق نفسه المستعمل محليًا — لا تحويل عند المزامنة |
| `created_at` | أول إنشاء |
| `updated_at` | **ختم الخادم** — يضعه trigger، ولا يثق بساعة الجهاز |
| `client_updated_at bigint` | ساعة الجهاز — للتشخيص والعرض فقط، **لا للترتيب** |
| `deleted_at` | حذف ناعم |
| `device_id text` | الجهاز الذي كتب آخر تغيير |

**المفتاح الأساسي مركّب: `(owner_id, id)`** — والعلاقات كلها مركّبة كذلك. فمن المستحيل
بنيويًا أن يشير صف إلى صف يخص مالكًا آخر، بلا أي منطق إضافي.

---

## ٢. القيود الفريدة — ولماذا

| الجدول | القيد | السبب |
|---|---|---|
| `scores` | `(owner_id, student_id, item_id)` | **الأهم**: جهازان دون إنترنت يصطدمان في `ON CONFLICT` بدل أن يخلقا صفَّين — وهو ما أنتج في الاختبار درجةً معروضة تخالف المُدخلة |
| `attendance` | `(owner_id, student_id, session_id)` | سجل حضور واحد لكل طالب في الحصة |
| `sessions` | `(owner_id, teaching_id, date, period)` | يسمح بحصتين في يوم واحد ويمنع تكرار الحصة نفسها |
| `enrollments` | `(owner_id, student_id, section_id)` | انتساب واحد لكل (طالب، شعبة) — يطابق المعرّف المشتق |
| `enrollments` | فهرس جزئي `(owner_id, section_id, roll_no) where status='active'` | رقم الكشف فريد بين **النشطين** فقط؛ المنتقل يحتفظ برقمه في سجله التاريخي |
| `teachings` | `(owner_id, section_id, subject_id, term_id)` | إسناد واحد لنفس التركيبة |
| `sections` | `(owner_id, year_id, grade, label)` | «٤/أ» واحدة في السنة |
| `terms` | `(owner_id, year_id, index)` | لا «فصل دراسي أول» مكرر |
| `years` | `(owner_id, hijri_start)` | سنة هجرية واحدة |
| `subjects` | `(owner_id, slug)` | مادة واحدة بالرمز |
| `slots` | `(owner_id, teaching_id, weekday, period)` | خانة واحدة في الجدول |
| `calendars` | `(owner_id, year_id, source)` | تقويم وزاري واحد وتقويم مخصص واحد للسنة |
| `calendar_days` | `(owner_id, calendar_id, date)` | يوم واحد بتصنيف واحد |

**`logs` بلا قيد فريد عمدًا** — سجل أحداث، وكل `+1` حدث مستقل والتكرار مقصود.

---

## ٣. الفهارس

**فهرس المزامنة `(owner_id, updated_at)` على كل جدول** — وهو الأهم في المخطط كله، لأن
كل سحب تفاضلي يسأل «ما الذي تغيّر بعد هذه اللحظة؟» ويمر منه.

وفهارس العلاقات كثيرة القراءة:

```
sessions (owner_id, teaching_id, date)   ← «حصص هذا الفصل»
sessions (owner_id, date)                ← «حصص اليوم» في الرئيسية
attendance (owner_id, session_id)        ← شاشة الرصد
attendance (owner_id, student_id)        ← تقرير الطالب
attendance (owner_id, teaching_id, date) ← كشف الحضور
units (owner_id, subject_id, grade, term_index)  ← فلترة المنهج
```

لم نفهرس ما تكفيه القيود الفريدة (كل قيد فريد فهرس ضمنًا).

---

## ٤. سياسات الوصول (RLS)

مفعّلة **ومفروضة** (`force row level security`) على كل جدول، وسياساتها موجّهة
`to authenticated` — فالمجهول لا يصل إلى شيء.

```sql
select : using (owner_id = auth.uid())
insert : with check (owner_id = auth.uid())
update : using (owner_id = auth.uid()) with check (owner_id = auth.uid())
delete : لا سياسة — الحذف الصلب ممنوع على الجميع
```

**`with check` على `insert` و `update` هي الحماية الحقيقية**: بدونها يستطيع مستخدم
كتابة صف باسم مالك آخر، ولا تكفي `using` وحدها.

و`owner_id` يُفرض من trigger على الخادم، فحتى لو أرسل العميل قيمة أخرى تُستبدل.

**الصلاحيات:**

```sql
revoke all    on all tables in schema rakeezx from anon;
grant  select, insert, update on all tables to authenticated;
revoke delete on all tables from authenticated, anon;
```

**لا `service_role` ولا أي مفتاح سري في التطبيق أو المتصفح إطلاقًا.** المفتاح العام
(anon/publishable) وحده هو ما يوضع في العميل، وحمايته RLS لا إخفاء الواجهة.

---

## ٥. تصميم المزامنة — الأسئلة الخمسة عشر

### ١. ما الذي يُعتبر create؟

سجل معرّفه غير موجود على الخادم. **ولا يهمّنا التمييز عمليًا**: كل رفع `upsert` على
`(owner_id, id)`، فالإنشاء والتحديث مسار واحد. هذا ما يجعل إعادة المحاولة آمنة.

### ٢. ما الذي يُعتبر update؟

تعديل حقول سجل موجود. الصادر يسجّل **الحقول المتغيّرة** (`fields`) لا السجل كله، فيُرفع
`update` بأعمدة محددة — ولا يدهس عمودًا عدّله جهاز آخر ولم نره.

### ٣. ما الذي يُعتبر delete؟

**لا حذف صلب إطلاقًا.** الحذف تعديل يضع `deleted_at`. والسبب: الجهاز الآخر لا يفرّق
بين «حُذف» و«لم يصل بعد» — فالحذف الصلب يعيد ظهور المحذوف عند أول مزامنة من جهاز قديم.

### ٤. كيف نمثل soft delete؟

محليًا `deleted: true`، وعلى الخادم `deleted_at timestamptz`. التحويل عند الرفع والسحب.
والاستعلامات كلها تصفّي المحذوف.

**سياسة التنظيف:** تبقى الشواهد لمنع الأجهزة القديمة من إعادة إحياء السجلات المحذوفة. التنظيف الآلي مؤجل؛ وقد تعتمد سياسة احتفاظ مستقبلية نحو 12 شهرًا أو سنة دراسية، بعملية دورية على الخادم لا من العميل.

### ٥. كيف نمنع التكرار؟

بثلاث طبقات متتابعة:

1. **المعرّف المشتق** — جهازان يولّدان نفس `id` لنفس الحقيقة.
2. **القيد الفريد على الخادم** — يمسك ما فات الطبقة الأولى.
3. **`upsert on conflict`** — يحوّل التصادم إلى دمج بدل خطأ.

### ٦. كيف نحل تعارض جهازين دون إنترنت؟

**آخر كتابة تفوز على مستوى الحقل، بترتيب ختم الخادم.**

- جهازان عدّلا **حقلين مختلفين** من نفس السجل → **الاثنان ينجوان**، لأن الرفع بأعمدة
  محددة. هذا مثبت محليًا بين تبويبين.
- جهازان عدّلا **نفس الحقل** → يفوز الأحدث بختم الخادم، والآخر يُستبدل صامتًا.

لا تظهر للمستخدم حوارات اختيار اعتيادية عند هذا النوع من التعارض.

### ٧. كيف نعرف الجهاز الذي كتب التغيير؟

`device_id` على كل صف — معرّف عشوائي يُولَّد مرة ويُحفظ في `device` المحلي.
استعمالان: تجاهل ما رفعه هذا الجهاز عند السحب، وتشخيص التعارضات.

### ٨. كيف نستخدم `updated_at`؟

**مؤشّر السحب التفاضلي.** كل مزامنة تحفظ `lastSyncAt` = أعلى `updated_at` رأته، ثم
تسأل `where updated_at > lastSyncAt`. ويُقرأ من الخادم بختم الخادم لا بختم الجهاز.

### ٩. ما الفرق بين وقت الجهاز ووقت الخادم؟

| | المصدر | الاستعمال |
|---|---|---|
| `updated_at` | `now()` في trigger على الخادم | **الترتيب وحسم التعارض** |
| `client_updated_at` | `Date.now()` على الجهاز | العرض والتشخيص فقط |

جوال بساعة متأخرة عشر دقائق لا يخسر تعديلاته، ولا يستطيع جهاز أن يزوّر أسبقيته.

### ١٠. متى نحذف عناصر outbox بعد نجاح الرفع؟

**بعد تأكيد الخادم لتلك الدفعة تحديدًا**، وبشرط ألا يكون السجل قد عُدّل بعد الرفع:

```
لكل قيد صادر: إن كان record.updatedAt > entry.updatedAt  → أبقِه (عُدّل أثناء الرفع)
              وإلا                                        → احذفه
```

هذا يمنع ضياع تعديل وقع بين إرسال الدفعة ووصول تأكيدها.

### ١١. ماذا يحدث إذا انقطع الإنترنت أثناء المزامنة؟

لا شيء يُفقد: الصادر لا يُمسح إلا بعد التأكيد، والمزامنة تُستأنف من `lastSyncAt`.
انقطاع أثناء السحب يعني أن `lastSyncAt` لا يتقدّم، فيُعاد السحب من النقطة نفسها.

### ١٢. ماذا يحدث إذا فشل جزء من batch؟

الدفعة **معاملة واحدة على الخادم**: إما تُقبل كلها أو تُرفض كلها. فلا حالة جزئية.
حجم الدفعة ٥٠٠ صف كحد أقصى — تُقسَّم إن زادت، وكل دفعة مستقلة.

### ١٣. كيف نعيد المحاولة بأمان؟

لأن كل رفع `upsert` بمعرّف مشتق، فهو **idempotent**: إعادة إرسال الدفعة نفسها مرتين
تعطي النتيجة نفسها. لا حاجة لمعرّف عملية ولا لسجل «أُرسلت من قبل».

تراجع أُسّي عند الفشل: ٢ ثانية، ٤، ٨، ١٦، ثم توقّف وانتظار مزامنة يدوية.

### ١٤. كيف نتعامل مع migrations وجهاز قديم دون إنترنت؟

**قاعدتان صارمتان:**

1. **الترحيلات على الخادم إضافية فقط** — أعمدة جديدة بقيم افتراضية، لا حذف ولا إعادة
   تسمية. فجهاز على مخطط قديم يواصل الرفع والسحب بلا كسر.
2. **`schemaVersion` يُرسل مع كل مزامنة.** إن كان الجهاز أقدم من الحد الأدنى المقبول،
   تُرفض المزامنة برسالة «حدّث التطبيق أولًا» — **ولا تُمسح بياناته المحلية**.

وهذا يعني عمليًا: **كل تغيير يمس مفتاحًا أساسيًا يجب أن يتم قبل تشغيل المزامنة**،
لا بعدها. وهو سبب تنفيذ الموجتين الأولى والثانية محليًا أولًا.

### ١٥. كيف نمنع جهازًا فارغًا من دفع بيانات ناقصة فوق بيانات الخادم؟

**بثلاث حواجز:**

1. **الترتيب إجباري: Pull → Merge → Push.** لا رفع قبل سحب مكتمل. (التفصيل أدناه.)
2. **الحذف لا يُرفع من جهاز لم يسحب بعد.** جهاز فارغ ليس لديه شواهد أصلًا، فلا يستطيع
   حذف شيء. وهذا وحده يمنع الكارثة: **المسح لا ينتقل إلا كـ `deleted_at` صريح**.
3. **حاجز الأمان:** إن كان الجهاز فارغًا (صفر سجل) والخادم فيه بيانات، تُفرض مزامنة
   سحب-فقط في المرة الأولى، ولا يُفتح الرفع إلا بعد نجاحها.

---

## ٦. استراتيجية أول مزامنة

### **Pull → Merge → Push** — وهذه هي الآمنة، ولهذا:

```
١. Pull   : اسحب كل ما على الخادم (updated_at > 0)
٢. Merge  : ادمج محليًا بقاعدة «الأحدث يفوز» — وهي نفس قاعدة استرجاع النسخ
            الاحتياطية المُختبرة أصلًا
٣. Push   : ارفع ما بقي في الصادر بعد الدمج
```

**لماذا ليس Push أولًا:** جهاز جديد صادره فارغ، فالدفع أولًا لا يفعل شيئًا — لكن أي
خطأ في تمثيل «الفارغ» (مثل رفع حذف لسجلات لم يرها) يمسح الخادم. والسحب أولًا يجعل
الجهاز يعرف الحقيقة **قبل** أن يتكلم.

**لماذا ليس Push-then-Pull:** لأن التعارض يُحسم على بيانات ناقصة.

**الحالة المعاكسة** (الخادم فارغ والجهاز مليء): السحب يعيد صفرًا، فيرفع الجهاز كل شيء.
سليم بلا معالجة خاصة.

**نقطة يجب الانتباه لها:** الدمج في الخطوة ٢ يستعمل ختم الخادم للمقارنة، بينما السجلات
المحلية تحمل ختم الجهاز. عند أول مزامنة **يُعتبر كل سجل محلي غير مرفوع «معلّقًا»**
ويُرفع في الخطوة ٣ بغض النظر عن الختم — فلا يُلغى عمل محلي لأن ساعة الجهاز متأخرة.

---

## ٧. آلية الصادر (outbox)

قائمة موجودة وتعمل، وينقصها الاستهلاك:

```js
outbox { id:'{store}:{recordId}', store, recordId,
         op:'put'|'patch'|'delete', fields:[…], updatedAt, queuedAt }
```

- **مفتاحه `{store}:{recordId}`** — فتعديلات متتالية لنفس السجل تنطوي في قيد واحد،
  ويُرفع آخر حال السجل لا كل خطوة.
- **`fields` يجمع الحقول** عبر التعديلات المتتالية.
- **المتبقي:** دالة إفراغ بعد الرفع · `deviceId` · وضع السجلات المستوردة من نسخة
  احتياطية في الصادر.

---

## ٨. القرارات المفتوحة والمحسومة

| # | القرار | الحالة |
|---|---|---|
| **D-16** | طريقة الدخول (Email + Password) | ✅ **مُتخذ** — بانتظار التنفيذ في الواجهة. |
| **D-17** | إقليم Supabase لبيانات الطلاب | ✅ **مغلق** — يبقى المشروع والإقليم الحاليان؛ يعاد النظر فقط عند توسع أو تنظيم أو إقليم أنسب. |
| **D-18** | تعارض نفس الحقل | ✅ **مغلق** — Last-Write-Wins على مستوى الحقل؛ تعديلات الحقول المختلفة تبقى؛ لا حوارات اختيار اعتيادية. |
| **D-20** | حذف الشواهد (Hard-delete/Tombstone) | ✅ **مغلق** — تستخدم tombstones؛ التنظيف الآلي مؤجل وسياسة الاحتفاظ المستقبلية نحو 12 شهرًا أو سنة دراسية. |
| **D-11** | المشاركة | ✅ **مغلق** — مكوّن تراكمي يبدأ من 0 لكل طالب ويدخل الدرجة النهائية منذ البداية، وليس null. |
| **D-12** | الواجبات/المشاريع | ⏳ **مؤجل** — وحدة مستقبلية محتملة للتعليمات والرابط والإرسال/التسليم. |
| **D-13** | ملاحظات الطلاب | ✅ **مغلق** — سجل مؤرخ متعدد الإدخالات، لا حقل واحد قابل للكتابة فوقه. |

---

## ٩. تاريخ التنفيذ وحالة الربط

| | |
|---|---|
| التنفيذ على القاعدة | ✅ **تم تنفيذ 0001 و 0002 بنجاح** (مخطط `rakeezx` الحي) |
| إحصائيات القاعدة الحيّة | 19 جدول، 19 RLS (enabled & forced)، 57 سياسة، 38 محفز، 69 فهرس |
| ربط التطبيق محليًا | ✅ **تأسيس عميل السحابة والمصادقة (Phase 4)** — (لم تُبنَ المزامنة الكاملة بعد) |

### حالة الترحيل السحابي (Cloud Schema Migration)
- تم التنفيذ والترحيل الكامل إلى `rakeezx` كالمخطط الحي الوحيد.
- اجتاز المخطط كافة الفحوصات التشغيلية (RLS / Spoofing) بنجاح عبر مستخدمين معتمدين.
- تم حذف مخطط `madarz` القديم نهائياً من الخادم.

### ملاحظات تاريخية هامة (History & Caveats)
1. **أزمة Deadlock في 0002:** تسببت المعاملة الواحدة DO block بقفل (ACCESS EXCLUSIVE) على 19 جدولاً مما أدى إلى Deadlock. تم الإصلاح عبر تقسيم 0002 إلى 4 معاملات رئيسية وتنفيذ سياسات RLS لكل جدول في معاملة مستقلة. يجب عدم دمج هذه المعاملات مستقبلاً.
2. **شرط PostgreSQL 15+:** مطلوب لدعم ON DELETE SET NULL (column).
3. **اختبارات RLS:** تم اجتياز كافة اختبارات RLS (باستخدام مستخدمين) بنجاح، بما فيها اختبارات PATCH لمنع تخطي owner_id.
4. **اختبار منع الحذف (DELETE Denial):** تم التحقق التشغيلي من منع الحذف (DELETE Denial) بنجاح، وجميع السجلات محمية من الحذف الصلب.

### المرحلة ٤: تأسيس العميل السحابي والمصادقة (Phase 4)
- تم بناء `src/lib/cloud.js` للتواصل المباشر مع REST/Auth لـ Supabase بدون أدوات بناء (Zero-build).
- المصادقة بالبريد الإلكتروني وكلمة المرور تعمل، واستعادة الجلسة تعمل.
- عملية جلب/تحديث الملف الشخصي (Profile) تعمل بامتياز تحت مظلة RLS عبر `PATCH`.
- التطبيق لا يزال يدعم العمل بالكامل محليًا ودون إنترنت لمن لم يسجل دخوله.

### المرحلة ٥أ: محرك المزامنة الآمن (Phase 5A)
- تم بناء محرك المزامنة `src/lib/sync.js` لتطبيق استراتيجية (Pull → Merge → Push).
- حماية (First-Device / Empty-Remote): التطبيق يقرأ السحابة دائمًا أولاً، ولا يرفع الملف الشخصي المحلي المبدئي إلى السحابة الفارغة إلا إذا احتوى على بيانات حقيقية (Meaningful Profile).
- توحيد الأختام الزمنية (Timestamp Normalization) لضمان دقة مقارنة `client_updated_at` مع `updatedAt` المحلي دون أخطاء تحويل JS.
- المزامنة تعمل بالطلب اليدوي فقط (Manual-only sync) في هذه المرحلة لأغراض الاختبار، والمزامنة التلقائية معطلة حاليًا.
- لا تزال بقية الجداول (الطلاب، الحصص، إلخ) غير مشمولة في المزامنة.

### المرحلة ٥ب: مزامنة البيانات الهيكلية (Phase 5B)
- تم تعميم محرك المزامنة (Generalized Sync) ليشمل البيانات الهيكلية منخفضة المخاطر (`years`, `terms`, `subjects`, `sections`) بترتيب صارم يحفظ العلاقات.
- تطبيق قاعدة الترقية الاعتمادية (Dependency Promotion): لا تُرفع السجلات الافتراضية (Defaults) المنشأة آليًا وحدها، ولكن يتم ترقيتها ورفعها إجباريًا إذا ارتبط بها سجل فرعي أنشأه المستخدم (مثل: `section` يتبع `year` افتراضي).
- استقرار أختام الحذف الناعم (Stable Soft-Delete Timestamps) لمنع تغيير الأختام بشكل عشوائي بمجرد وجود السجل في وضع الحذف.
- تطبيق التكرار الآمن التام (Idempotency / Equal-Timestamp No-op): عند تطابق أختام الوقت بين المحلي والسحابة تمامًا، لا يحدث أي رفع أو سحب، مما يمنع حلقات التحديث اللانهائية (Infinite Update Loops).
- واجهة حالة المزامنة الدائمة (Persistent Sync Result UI) في شاشة الإعدادات، مع عرض إحصاءات السحب والرفع لكل كيان على حدة.
- تم اجتياز الفحص اليدوي (Manual Verification PASS) وتأكيد الاستقرار.

### المرحلة ٥ج: مزامنة الطلاب والانتساب (Phase 5C)
- شمول المزامنة لجدولي `students` و `enrollments` مع إضافة `teachings` ضمن المزامنة الهيكلية الأساسية.
- ترتيب التبعية (Dependency Order): `years` ← `terms` ← `subjects` ← `sections` ← `teachings` ← `students` ← `enrollments`.
- حل معضلة تزامن البيانات الافتراضية (Generated-Default Convergence): أصبحت السجلات المبدئية التي يولدها النظام تكتسب هويتها (ID) من السحابة إذا وُجدت لمنع ازدواجية السجلات في الأجهزة الجديدة.
- تحقيق الاستقرار الحتمي في استعادة البيانات (Deterministic Fresh-Device Convergence) دون تضارب أو فقدان للانتساب.
- تحصين أمان الإقلاع (PWA Service-Worker Reliability): عزل تحميل أداة المزامنة وجعلها اختيارية (Dynamic Import) لمنع انهيار إقلاع التطبيق في حال تعطل ملفات المزامنة.
- اجتياز اختبار القبول النهائي النظيف (Clean Acceptance Scenario PASS) واستقرار كافة الشاشات مع الاعتماد الحصري على المعرّفات القادمة من السحابة.

## Recovery B Batch 2.1-D — teaching identity audit (2026-09-02, NOT DEPLOYED)

This current-workspace audit supersedes older implementation-status descriptions
above for this incident only. It is a safety design, not an approved history-merge
policy. All earlier uncommitted Batch 2.1 work remains. Migration 0007 has only
been exercised in an in-memory PostgreSQL test database; no live schema/data was
accessed or changed. No commit, push, or deployment is authorized in this ticket.

### Confirmed identity and normal creation

`0001_core_schema.sql` defines `teachings_natural_uniq` as
`UNIQUE (owner_id, section_id, subject_id, term_id)`, with no partial predicate.
Both active and tombstoned teachings participate. Primary identity is
`(owner_id, id)`. Year context is indirect through section/term; it is not an
additional key column. No later checked-in migration replaces this constraint.

The normal Classes action in `src/views/teachings.js` calls `createSection()` then
`createTeaching()`. The latter atomically saves the teaching and five grading
items. Teaching IDs are `tch:${sectionId}|${subjectId}|${termId}`; section IDs are
random. Thus two independently created copies of the same logical class normally
produce different A/TA and B/TB IDs plus different grading-item IDs. Adopting
section B changes TA.sectionId, not TA.id, and exposes the teaching collision.

`MAPPERS.teachings` maps `sectionId/subjectId/termId` to
`section_id/subject_id/term_id`, keeps `id/order`, maps `updatedAt` to
`client_updated_at`, adds `device_id`, and maps `deleted/deletedAt` to `deleted_at`.
The owner is enforced/scoped by cloud requests and schema policy, not editable
teaching metadata. Tombstones must never be interpreted as absent.

### Exact dependency map

| Store/state | Teaching dependency | Identity/secondary consequences |
|---|---|---|
| teachings | `id`, section/subject/term natural key | TA retirement needs exact remote absence; retain canonical TB |
| items | direct `teachingId` / `teaching_id` | Random item IDs; linked by scores and optional assignments. No template identity marker or natural item uniqueness |
| slots | direct `teachingId` | Random IDs; SQL unique owner/teaching/weekday/period; sessions.slotId references them |
| sessions | direct `teachingId` | ID embeds teaching/date/period; SQL natural unique same tuple; `makeupForId` self-reference; slotId, lessonId, timeProfileId |
| attendance | direct `teachingId` AND `sessionId` | ID embeds student/session; SQL unique owner/student/session; historical status must survive |
| logs | direct `teachingId`, optional `sessionId` | Random event IDs; independent events must not be guessed duplicates; affect participation/behavior totals |
| notes | direct optional `teachingId`, optional `sessionId` | Random dated-entry IDs; retain text, dates and student references; SQL 0004 |
| assignments | direct `teachingId`; optional itemId/lessonId | Existing local/deferred model and backup store; no current cloud mapper/table; still cannot lose existing records |
| scores | indirect through `itemId` | ID embeds student/item; SQL unique owner/student/item; changing item identity needs a separate score-collision policy |
| submissions | indirect through `assignmentId` | ID embeds student/assignment; local/deferred, no current cloud mapper |
| enrollments | no teaching reference; direct `sectionId` | ID embeds student/section; section A→B can collide with cloud enrollment for same student/B; SQL unique owner/student/section |
| students | no teaching field | Shared identity reached through enrollments; do not merge students by name |
| units/lessons | no direct teaching reference | Curriculum is subject/grade/termIndex; items/session/assignments point to unit/lesson IDs; preserve those links |
| device | `groupArrangements[teachingId]` | Device-local saved membership; TA and TB keys can both contain valid different arrangements; no approved overwrite rule |
| outbox | `id=store:recordId`, `store`, `recordId`, field-name list, operation, timestamps | No stored payload snapshot. Remove only obsolete TA work after approved atomic adoption; dependent serialization must read TB; retain delete intent |
| IndexedDB indexes | Every current store uses only `keyPath: id` | No secondary indexes to rebuild; sessions/attendance composite strings still affect application lookups |
| BroadcastChannel | `{from, changes:[{store,id}]}` invalidations | Publish old/new teaching IDs, all changed dependent IDs, and device only after commit; peers reload disk values |
| routes/transient state | `/teaching/:id/*`, student `cls`/`teaching` query, Picker.currentClassId, Groups drag selection, Sessions.lastGeneration, execution-report teaching filter | Existing router has no identity alias. Open tabs/bookmarks would reference retired TA; post-commit route handling needs explicit coverage |
| reports/archive/backup | Derived, not independent report-record IDs | Reports/Home/Board read teachingContext and historical stores. Archive shell uses year/term. Backup includes all data stores except device/meta/outbox; old backups can reintroduce retired technical IDs |

All direct collections above must be inspected including deleted records, not
only live selectors. No direct teaching references were found in profile,
years, terms, subjects, sections, calendars, calendarDays, timeProfiles or meta's
implemented legacy migration path. Legacy `classId` records are converted by
`src/lib/migrate.js`; arbitrary backup extension fields are not a safe basis for
invented relinking rules.

### Proven blockers to a reference-only rekey

The focused diagnostics use the actual current schema in PGlite and the actual
store methods in isolated fake IndexedDB. They intentionally prove unsafe
counterexamples, not successful graph convergence:

1. Two normal class creations yield two sets of five independently identified
   grading items. Union changes `studentTotal().outOfAll` from 100 to 200.
   Matching names/max/order does not prove identity: either teacher could have
   intentionally created or edited similar items. Dropping either set can lose
   valid scores; automatic item/score merging needs an approved policy.
2. Keeping a historical session ID while changing teachingId leaves the old TA
   inside its composite ID. `ensureSession(TB,date,period)` then creates a second
   session. `generateSessionsForRange` uses the same regenerated-ID existence
   check. Both readers need natural-position awareness or an approved identity
   mapping, not a blind teaching-field replacement.
3. Overlapping TA/TB sessions and slots hit `sessions_natural_uniq` and
   `slots_natural_uniq`. Preserving both histories under TB is impossible under
   those constraints without resolving the conflicting semantic records.
4. Shared-student enrollment IDs can separately collide after section adoption
   (`enrollments_natural_uniq`). This is not fixed by teaching rekey.
5. The realistic two-device graph still fails on `teachings_natural_uniq` after
   successful section adoption. SQL cloud records and local attendance, scores,
   notes, logs, sessions, items and saved Groups remain unchanged on repeated
   attempts. TA's pending writes remain; there is no fabricated TA tombstone.

### Presence evidence implemented; adoption deliberately not implemented

`cloud.fetchTeachingPresence(teachingId)` performs only an authenticated-owner
exact-ID GET against `/rest/v1/teachings`, selecting
`id,owner_id,section_id,subject_id,term_id,deleted_at` with `limit=1` and
`Accept-Profile: rakeezx`. Owner and full composite ID are URI encoded. An empty
successful array proves absence only in that owner's scope. A valid row is
present, including tombstones. Network/HTTP errors, missing authentication,
changed authentication, malformed or wrong-owner/ID rows are unknown and expose
no row. No broad fetch, pagination, adoption, sync invocation or writes occur.

### Proposed safe sequence — requires Product Owner review

1. Plan A→B and the resulting teaching natural keys before preparing teaching
   uploads. Existing persisted TB may be canonical only with exact TA-absent,
   TB-present/active evidence in the same authenticated owner and exact key.
2. If both IDs are remotely present, return proposed structured
   `TEACHING_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES`; do not choose a winner.
   Unknown/tombstoned candidates also block. This is a design contract; automatic
   teaching ambiguity handling is not wired into sync yet.
3. Validate the complete local and relevant cloud child graph and all pending
   operations. Parent presence alone does not prove that merging child histories
   is safe. Stop on overlapping session/slot/enrollment identities, unresolved
   grading items/scores, or competing saved Groups arrangements. Do not erase
   either graph to pass uniqueness checks.
4. Only after an approved plan exists, use one `db.applyBatch(...,{prepare})`
   read/write transaction over teachings, every affected direct/indirect store,
   device and outbox. Recheck local versions inside the transaction. Retire TA
   locally without DELETE; keep TB; preserve history IDs where current readers
   support them. Any sync write error must abort the whole local transaction.
5. Resolve in the same structural execution before building teaching payloads;
   never send abandoned TA. If section adoption previously committed, retain it
   and retry the teaching plan idempotently rather than reversing section B.
   Network proof cannot be part of an IDB transaction: revalidate auth/evidence,
   preserve work on races/failure, and publish invalidations only after commit.
6. A safe narrower automatic case could adopt a genuinely empty local teaching
   graph. That does NOT solve normal Create Class, which always creates items.

**Decision:** NO-GO for an unconditional generic TA→TB rekey or Production
promotion under current rules. Need approval for dependent identity/collision
policies (especially grading templates/scores and overlapping dated history),
plus old-route/session-idempotency behavior. Section code, teaching/section ID
generators, constraints and all existing histories remain unchanged by this
audit. Lifecycle: RECOVERY B BATCH 2.1-D — TEACHING IDENTITY REVIEW REQUIRED.

## Batch 2.1-D1 — approved pristine-only teaching convergence (not deployed)

This narrowly supersedes the preceding audit's **empty/fresh teaching** blocker,
not its historical-merge warnings. No generic teaching/history/enrollment merge
is implemented. No live SQL migration, cloud repair or deployment was performed.

### Evidence and pristine definition

Before a conflicting teaching upload, structural sync discovers TB with the same
section/subject/term and calls `cloud.fetchTeachingPresence` separately for TA and
TB. TA must be authoritatively absent; TB must be authoritatively present, active,
and owned by the unchanged authenticated owner with the same exact natural key.
Both-present (including a TA tombstone) is ambiguity; unknown/auth changes,
inactive/missing/changed TB all block. Broad fetch is discovery, never absence
proof. No cloud row or constraint is deleted or weakened.

`createTeaching()` now atomically attaches a private local creation receipt to
its existing teaching outbox entry, containing its original teaching and five
generated item records. There is no new store, schema, cloud field or backup
format. Cloud mappers serialize records, not this outbox metadata. Normal edits
replace/invalidate this evidence; matching names or timestamps alone never
establish provenance. Legacy/imported records with no receipt deliberately fail
closed, even if their five items happen to look identical.

`inspectPristineTeaching()` requires the exact original teaching (allowing only
the approved section-reference adoption) and precisely the five canonical
`DEFAULT_ITEMS`/`makeItem` records, with their original IDs and every field intact:
participation 10, homework 10, activities/projects 20, short tests 20, final test
40; canonical order, auto/perPoint/penalty/curriculum fields also match. All six
pending outbox entries must be untouched full creations. Missing entries,
patch/delete intent, extra fields/items, modified items or tombstones block.

The predicate scans every current IndexedDB store including deleted records,
outbox record IDs and nested device keys/values. Any TA/default-item reference
outside those six permitted records blocks: scores, slots, sessions, attendance,
notes, logs, assignments/submissions, Groups arrangements, unknown extension
references or orphan pending work. Conservative false negatives are intentional.

### Local transaction and sync boundary

`store.adoptPristineTeachingIdentity({fromTeachingId, canonicalTeaching,
expectedSource?, validateEvidence?})` is a pure local helper. The sync caller owns
the exact cloud evidence; the synchronous validator checks that auth still
matches inside `db.applyBatch(..., {prepare})`. All `db.STORES` participate in one
read/write transaction so concurrent meaningful writes are seen before mutation.
Only **teachings, items and outbox** receive writes:

- Preserve/materialize TB, remove local-only TA (no tombstone).
- Remove only TA's proven untouched five defaults, never union them with TB's.
- Remove only the corresponding six obsolete creation outbox entries. No cloud
  DELETE is queued; unrelated work and canonical TB metadata/outbox survive.
- Publish committed invalidations through the existing BroadcastChannel path;
  an open matching `/teaching/:id/*` or student teaching-context URL redirects to
  TB. No durable alias/bookmark rewriting or meaningful device-state rekey.

All historical stores are checked but not rewritten. A failed transaction rolls
back TA, items and outbox together and leaves memory unchanged. Repeat adoption
is a write-free no-op that also refreshes stale tab memory. Teaching/item uploads
read persisted snapshots, so a delayed peer invalidation cannot resurrect retired
IDs from memory. Structural sync refreshes its local snapshot after adoption;
the same `syncAll` run downloads TB's canonical items through existing scoring
sync and never uploads the abandoned TA/items. Existing scoring rules are unchanged.

Non-pristine data returns `TEACHING_IDENTITY_CONFLICT_REQUIRES_RESOLUTION`;
both-remote returns `TEACHING_IDENTITY_AMBIGUOUS_REMOTE_DUPLICATES`; unknown
presence returns `TEACHING_IDENTITY_PRESENCE_UNKNOWN`. Diagnostics retain TA,
candidate IDs and the refusal reason. These conflicts preserve pending data and
disable automatic conflict retry loops, while manual retry remains available.

### Focused evidence and remaining boundary

New tests: `pristine-teaching.test.mjs` and `pristine-teaching-sync.test.mjs`.
They exercise actual store/IndexedDB transactions and the sync orchestrator with
an isolated PGlite instance running the unchanged prepared SQL migrations.
PostgreSQL `row_to_json` matches PostgREST numeric JSON serialization. The fresh
duplicate-class case has no student enrollment: section and teaching converge,
exactly TB's five defaults remain, `studentTotal().outOfAll === 100` (not 200),
zero abandoned uploads, repeat/reload convergence and clean outbox. Separate
cases cover meaningful data, modified defaults, Groups, unknown/ambiguous cloud
presence, auth/local-write races, rollback, offline recovery and peer invalidation.

Prior audit/migration diagnostic fixtures still preserve legacy and historical
graphs. Only their final collision expectation changes: D1 now refuses before
upload instead of deliberately reaching `teachings_natural_uniq`; the migration
SQL and its safety/parity tests are unchanged. The affected focused regression
gate passed 198 tests. Existing older suites still log their known closed-channel
teardown warnings; the D1 cross-tab test itself passes and releases its channel.

No enrollment blocker occurs in the approved pristine/no-enrollment path.
`enrollments_natural_uniq` and generic historical teaching conflicts remain
separate unresolved boundaries. Legacy records without creation proof are not
automatically repaired. GO to return to the Batch 2.1 final migration **gate**;
this is not permission to apply a live migration or deploy.

Lifecycle: RECOVERY B BATCH 2.1-D1 — PRISTINE TEACHING CONVERGENCE PASS / NOT DEPLOYED.

## Batch 2.1 — final pre-production gate (2026-09-03)

Base: `1678d0e4b14d1e6df6c2a869429582f333329ecd`; branch:
`codex/recovery-b-batch-2-1-section-sync`. The accumulated diff was reviewed
file-by-file: approved product changes, required sync/DB hardening, and required
tests/dependency/documentation only. No unrelated visual/runtime work was imported.

Selective Visual source: `f615c0a66dee0d8ba538ae7fe4b0f621d5d716db`.
New Class defaults to `1`; active normalized duplicates are rejected without
closing the edit sheet. Students, Attendance and Quick Log share conservative
search normalization; names, focus, filters and scoring remain unchanged.
Production `deleteClass()`, ID generators, Groups implementation, PWA and routes
were not replaced with Visual versions.

### Migration and identity evidence

Prepared migration 0007 executes one transaction: immutable normalization helper,
new active-only normalized unique index, then removal of the old raw constraint.
Old: `UNIQUE(owner_id, year_id, grade, label)` including tombstones.
New: `UNIQUE(owner_id, year_id, grade, rakeezx.normalize_section_label(label))`
with `WHERE deleted_at IS NULL`. Teaching uniqueness is unchanged.

Isolated PGlite fixtures prove SQL/JS parity (including exact ECMAScript
whitespace), preserved original labels, active/tombstone coexistence and
tombstone/recreate convergence. Active normalized duplicates deliberately abort
the migration; rollback preserves every row and the old enforcing constraint,
with no partially installed helper/index. No migration was applied live.

Ordinary section adoption, exact presence, atomic rollback, dependent references,
23505 discovery/race/ambiguity and bounded retry all pass. The generic equivalent
Product Owner conflict converges to canonical section B and, only when proven
pristine, teaching TB with its five canonical items totaling 100. Non-pristine,
legacy, unknown and both-remote teaching cases preserve data and refuse adoption.
There is no enrollment blocker in these tested intended scenarios; overlapping
independent enrollment identities remain a separate, unresolved boundary.

### Gate results and test-only corrections

- Focused matrix: 198 unit/integration tests and 7 product/delete browser tests
  passed; affected follow-ups added 22 unit test executions and 5 browser checks
  (Groups 2, manual acceptance 3). Counts include overlapping rerun coverage.
- Full unit/sync gate: 237 passed, zero failed, including 62,337-record stress.
- Complete serial browser gate: 120 passed, zero failed. It covers DB reload,
  multi-tab propagation, offline recovery, backup, reports, section/slot editing,
  route crawl, mobile navigation, raw static production boot and PWA update.
- Product browser coverage: desktop 1440, mobile 390 and 320; screenshots inspected,
  Arabic RTL, no overflow, normalized search, continuous Attendance focus and
  Quick Log filters/scoring preserved. Product/boot error assertions passed.
- `npx vite build` passed. No production implementation changes were needed
  during this final gate; only the following test defects were corrected.

The first full attempt exposed a fuzz fixture generating duplicate cloud teaching
natural keys, impossible under the existing SQL constraint. The fixture now
generates unique section/subject/term tuples and asserts structural sync success;
the ambiguity safeguard was not weakened. A later browser attempt exposed a UTC
date fixture used against device-local Groups attendance just after Riyadh
midnight. It now seeds the local date and pins that boundary in both tabs. The
section-edit browser expectation was also updated from the old Arabic diacritic
spelling to the approved duplicate message, retaining unchanged-ID/data checks
and explicitly checking that the sheet stays open. All affected focused tests
passed before restarting the required gate; no failed test was waived.

The last full `test:all` attempt completed its 237 unit tests before encountering
the stale browser text assertion. After that browser-only correction, the entire
`npm run test:e2e` gate completed successfully; the already-passing unit/stress
phase was not repeated again. Both phases used serial, non-overlapping runners.

### Remaining operational boundaries

Existing suites emit closed-BroadcastChannel teardown and color-environment
warnings. The existing XSS fixture supplies an invalid `fake` JWT and mocks only
GETs; automatic write attempts are rejected with JWT errors. No authenticated
Production data writes/repairs were performed. Test-harness isolation can be
improved separately; these warnings are not a claim of a successful live sync.

Live active normalized duplicates require a separate read-only preflight and
explicit resolution, not automatic SQL merging. Legacy/non-pristine teachings
and overlapping independent enrollments remain intentionally conservative
conflicts. This gate uses fictional data and does not claim that a particular
live user dataset has been repaired. No live migration, push, merge or deployment
was performed. Promotion and live migration remain subject to user authorization.

Lifecycle: RECOVERY B BATCH 2.1 — READY FOR PRODUCTION PROMOTION.
