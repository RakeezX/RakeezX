# تسليم جولة دمج المناهج V2 — 26 أكتوبر 2026

## الحالة الواضحة
- **المنتج:** ركيز المعلم.
- **النتيجة:** مرشح دمج محلي مستقل مع اختبارات تخزين ونسخ احتياطي ومنع فقد البيانات؛ **ليس جاهزًا لتفعيل Cloud Sync أو Production**.
- **المصدر المعتمد للاستئناف:** `RAKEEZ_NEXT_CHAT_HANDOFF_20261026.md` وملاحظات `RakeezX-Research`، دون إعادة البحث.
- **فرع المرشح:** `research/v2-integration-candidate-20261026` في `D:\Abdullah Projects\RakeezX-Research\Rakeez-V2-Integration-Candidate-20261026`.
- **قاعدة المرشح:** `7d4b7db15278f04c1fd59414e4b42357fbb053ab` — كانت أحدث main عند إنشاء الفرع.
- **أحدث GitHub main أثناء التسليم:** `1686059e94c8b8b77fc9580a0c0fae0402a96e57`، يمثل خمس commits تخص N44 وبيانات build المولدة. يجب تطبيق Patch على SHA الأحدث بواسطة مسؤول الدمج لاحقًا بعد التحرير والتحقق.
- **المستودع التشغيلي:** `C:\Users\Abody\Projects\RakeezX` — لم تعدَّل ملفاته.
- **النشر:** لا يوجد Preview منشور لهذه الجولة؛ لا Production؛ لا migration حيّة؛ لا كتابة إلى بيانات المعلمين الحقيقية.

## ما كان منجزًا قبل الجولة وأعيد استخدامه
1. فهرس الإصدار السادس، محرك اختيار المواد بحسب المرحلة والمسار؛ 16 برنامجًا / 123 سياقًا / 1,211 ربط مادة، مع إسناد الصفحات إلى الدليل ذي 114 صفحة، لكن تطبيق الإصدار على عام 1448هـ لم يُعتمد نهائيًا.
2. `curriculum-context-v2.js` و`curriculum-v2-sync-contract.js` بحماية الهوية والمالك ومنع عودة السجلات المحذوفة.
3. SQL تجريبي PGlite وIndexedDB بحثي منفصل؛ ملف Patch القديم `RAKEEZ_V6_CURRICULUM_V2_CANDIDATE_20261025.patch`.
4. مجموعة البحث الأساسية: **115 اختبارًا**؛ أعيد تشغيلها كلها على فرع المرشح الجديد بنجاح.

## الشيفرة المضافة/المعدلة في هذه الجولة
- `src/lib/db.js`: **DB_VERSION=9**، مخزنان إضافيان `sectionCurriculumScopes` و`teachingCourseBindings`؛ ترقية إضافية لا تمس سجلات الطلاب أو الدرجات القديمة ولا تحوّلها.
- `src/lib/curriculum-v2-staging-bridge.js`: محول تخزين/حذف/استعادة/تسلسل V2، **مقصور على قاعدة البيانات الاصطناعية `rakeezx-demo` وبعلم تشغيل اختبار صريح**؛ يتحقق من المالك وروابط السنة والفصل والإسناد والمادة والفصل الدراسي، ويمنع تغيير العقد أو إحياء المحذوف، ويحترم حارس الكتابة في المعاملة نفسها.
- `src/lib/curriculum-v2-cloud-restore-gate.js`: منع Cloud Restore لمحتوى المناهج V2 الموجود في الملف أو محليًا قبل وجود بروتوكول خادمي معتمد.
- `src/lib/backup-v2.js`: تطبيق الحارس على الفحص المسبق، التخطيط الصافي، الاستعادة الجديدة، استئناف استعادة سابقة، والتسوية بعد الاستعادة. لا تفعيل لجداول Supabase الجديدة ولا Outbox حي.
- `src/lib/export.js` يضم مخازن V2 تلقائيًا إلى نسخة V5 المحلية عبر `db.STORES`؛ ثبتت البصمة والسلامة. **لا يَثبت بذلك أن بروتوكول N71 السحابي يعرف استعادتها**، ولهذا أُضيف الحارس.
- `tests/curriculum-v2-product-staging-safety.test.mjs`: 14 حالات فرعية + حالة رئيسية = **15 PASS**؛ كل المدخلات اصطناعية.
- `tests/score-foundation-db-upgrade.test.mjs`: تحديث توقع إصدار قاعدة البيانات إلى 9 وإضافة المخزنين إلى عقد الترقية، مع الإبقاء على فحص v7/إلغاء الترقية/سجلات الدرجات؛ **3 PASS**.
- `tests/stage-subject-v6-persistence.e2e.mjs`: تصحيح اختبار واجهة قديم ليستعلم عن رابط الفصل الظاهر لا محدد CSS متقاعد؛ لم يتغير المنتج من أجل الفحص.

## أدلة التنفيذ والفحص (كلها على Abdullah-MSI)
| الفحص | النتيجة | الدليل |
|---|---|---|
| فهرس V6 + V2 Research (Node/PGlite/IndexedDB) | **115/115 PASS** | `D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_RESEARCH_115_20261026.log` |
| ترقية V8→V9 وحراسة المالك/الحذف/الدرجات/النسخ التجريبي وحجب Cloud Restore | **15/15 PASS** | `node --test tests/curriculum-v2-product-staging-safety.test.mjs` |
| ترقية v7/سجل الدرجات إلى v9 وإلغاء ترقية غير مكتملة | **3/3 PASS** | `node --test tests/score-foundation-db-upgrade.test.mjs` |
| بناء التطبيق | **PASS — vite built** | `npm run build` داخل فرع البحث |
| واجهة Chromium | **7/8 في التشغيل الجماعي؛ الحالة الثامنة نجحت منفردة 1/1** بعد انهيار Chromium عند إنشاء context؛ لا يُعلن 8/8 في تشغيل موحد | `D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_ISOLATED_BROWSER_20261026.log` و`D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_ISOLATED_BROWSER_GRADE12_20261026.log` |
| رجوع التخزين/النسخ/Sync الواسع على المرشح قبل تعديل اختبارات v9 | **93/110 PASS، 17 FAIL** | `D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_PRODUCT_STORAGE_BACKUP_REGRESSION_20261026.log` |
| المقارنة العادلة على main نظيفة من نفس SHA | **54/68 PASS، 14 FAIL موجودة في الأساس** | `D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_CLEAN_MAIN_BASELINE_GATES_20261026.log` |
| الاختبارات الثلاثة الإضافية بسبب DB_VERSION8 القديم | **صححت توقعاتها إلى 9 ثم PASS 3/3** | `tests/score-foundation-db-upgrade.test.mjs` |

### تفسير حواجز الرجوع الموجودة مسبقًا
- `backup.test.mjs`: يتوقع Restore محليًا بينما مسار `restoreBackup()` أصبح يرفضه عمدًا `LOCAL_RESTORE_DISABLED`.
- `core-v2-restore-reload.test.mjs`: فشل خط الأساس `RESTORE_DATABASE_CONFLICT`.
- `n77-restore-boundary.test.mjs`: أربع توقعات مختلفة عن عقد حذف/استعادة current.
- `sync-v2-client.test.mjs`: ست حالات يحظرها حارس checksum/ACL `N100 provider source/ACL changed` في PGlite. **لم تُخفض حماية SQL، ولم تُزيف نتيجة PASS**.
- لا تستنتج من هذه المقارنة اجتياز الحزمة الكاملة؛ فهي **غير خضراء في main كذلك**. ينبغي معالجة كل سبب ضمن بطاقته المختصة دون تزاحم مع Codex.

## حالة المشغّل والتذاكر
- **مصدر لقطة المشغّل:** `artifacts/ops-supervisor-v4/ACTIVE_TASKS.json` في المستودع التشغيلي.
- **الوقت:** `2026-10-26T04:38:51.448Z` (07:38:51 بتوقيت الرياض).
- **الحالة:** المتحكم PID 4640 يعمل، عامل واحد Running على `continuous-n44-one-approved-closed-page-push-20261019`، الناشر لا يحمل `deliveryInFlight` عند اللقطة؛ وُجدت blocked أخرى. هذه ليست شهادة إغلاق N44.
- **GitHub:** خمس Issues مفتوحة في فحص الجولة (N36 وN88 وN44 وتشغيل)؛ صفر Pull Requests مفتوحة في نتيجة الفحص.
- لم أشغّل supervisor/worker بديلًا أو أغير queue أو STOP أو ملفات المشغّل.

## ما بقي ولا يجوز تقديمه كمنشور
1. إنشاء migration مرشح **Staging فقط** للجداول الجديدة بعزل `owner_id` وRLS وروابط FK وفحوص تبادل مالكين ونقل فصل دون فقد بيانات.
2. إكمال مسار Outbox/Sync V2 الحقيقي مع التحقق من Auth والـlease وrevision، والعزل بين الأجهزة، ومنع resurrection. لا تكتفِ بتمرير JSON تجريبي.
3. إضافة **إصدار جديد متوافق** من N71 Cloud Backup/Restore manifest/receipts للمخازن الجديدة، واختبار فشل جزئي واستئناف ونسخة قديمة ومستخدم آخر.
4. مراجعة تطابق الإصدار السادس مع عام 1448هـ رسميًا، وحسم تعارض المراحل/المسارات من مصدر معتمد قبل التفعيل الافتراضي.
5. بعد اختبارات Staging، تقديم Preview معزول واختباره وظيفيًا، ثم تسليم التغيير إلى مشغّل المنتج المعتمد كي يتولى الدمج/النشر بالتسلسل ضمن التفويض والصلاحيات الفعلية، دون موازاته. **لا نشر Production في هذه الجولة.**

## الملفات والإعادة
- المسار المحلي: `D:\Abdullah Projects\RakeezX-Research\Rakeez-V2-Integration-Candidate-20261026`.
- ملف Patch التسليمي المتوقع: `D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_INTEGRATION_CANDIDATE_20261026.patch` (المرفق المحلي بعد هذه الجولة، مع SHA-256 منفصل).
- هذا التقرير نفسه محفوظ أيضًا باسم `D:\Abdullah Projects\RakeezX-Research\RAKEEZ_V2_INTEGRATION_HANDOFF_20261026.md`.
- للاستئناف: افتح هذا التقرير والـPatch وسجلاته أولًا، ثم طابق آخر main والطابور. لا تعِد 115 اختبارًا أو قراءة أرشيف أبحاث كامل دون تغيّر مؤثر.
