# N131 — أسماء مختصرة لواجهات ركيز الضيقة (عرض فقط)

**قرار صاحب المنتج، 27 أكتوبر 2026:** اختصار أسماء المواد والصفوف في الجدول والمساحات الصغيرة، مع إبقاء الاسم الكامل في إنشاء الفصل وسجلاته الرسمية. المقررات V6 المرجعية موجودة على Production لكن **ليس هناك اعتماد نفاذ شامل لجميع مسارات 1448هـ**؛ ربط المعلم بالمقرر/وحداته/دروسه ومزامنة سياق المنهج V2 مشروع مستقل.

## نطاق العرض المحدود
- `src/lib/subject-catalog.js`: الدالة النقية `compactSubjectLabel(subject, nearbySubjects)` تستعمل قاموسًا صغيرًا من المسميات المعروفة مثل «المهارات الرقمية → رقمية» و«التربية البدنية والدفاع عن النفس → بدنية ودفاع» و«المهارات الحياتية والأسرية → حياتية وأسرية» و«اللغة الإنجليزية → إنجليزي». تحافظ على المادة المخصصة غير المعروفة بنصها الكامل، وإذا وجد اختصار مطابق بين هويتين مختلفتين تعود لأسماء المصدر لتمييزهما. **لا يُكتب اختصار في جدول subjects ولا تُعاد تسمية أي مادة.**
- `src/lib/class-order.js`: `compactSectionLabel(section)` للصفوف 1–12؛ «خامس/1»، «أول م/2»، «ثالث ث/1». تحافظ على رمز الشعبة وتزيل بادئة الصف القديمة من label لأغراض العرض فقط. المقارنة والعزل والمعرّفات لا تتأثر.
- `src/views/schedule.js`: جدول الحصص الأسبوعي وملخص الأحمال يظهران الاختصارات؛ تبقى `title` و`aria-label` بالنص الكامل. نموذج إضافة/تعديل حصة يظل يعرض `store.teachingLabel()` الكامل. التصدير إلى PNG/PDF يستخدم المصدر الكامل الموجود أصلًا؛ لم يُغيّر محرّكه.
- `src/views/teaching-hub.js` و`src/styles/components.css`: رأس الفصل يُظهر الاسم المختصر على عرض شاشة حتى 640px، والاسم الكامل فوق ذلك، مع تلميح بالاسم الكامل. زر «+ إضافة مادة أخرى» وعناصر التحكم تبقى نفسها.
- لا تعديل لـ`sw.js` أو إضافة dependency جديد غير مخزن: `class-order.js` و`subject-catalog.js` موجودان مسبقًا في SHELL، وكذلك `schedule.js` و`teaching-hub.js`. لا تغيير Store, Data, Scoring, Sync, Restore, Auth, RLS, SQL.

## فحوص القبول
- `tests/n131-compact-display.test.mjs`: **4/4 PASS**: المراحل الابتدائية والمتوسطة والثانوية، أسماء مواد مختلفة، الحفاظ على هوية المادة واسمها/رمز الشعبة، الأسماء المخصصة، منع تداخل الاختصارات.
- `tests/n131-compact-display.e2e.mjs`: **2/2 PASS**: تجربة حقيقية في Chromium ضمن Demo مصطنع؛ 390 و320 و1280px، إظهار اختصار رأس الفصل والجداول، الرجوع للاسم الكامل على سطح المكتب، عنوان/تلميح الاسم الأصلي، عدم ظهور تمرير أفقي، وبقاء الاسم المخزن كما هو.
- اختبار E2E أول تعثر بسبب **محدِّد Playwright خاطئ** داخل `filter({has: ...})` ربط عنصر `summary` بداخل نفسه؛ صححنا الاستعلام إلى عنصر صف واضح قبل إعادة الحالة كاملة؛ لم يجرِ تعديل Product لتحسين اختبار غير صحيح.
- `node --test tests/n131-compact-display.test.mjs tests/schedule-mobile-today.test.mjs tests/schedule-export-engine.test.mjs`: **14/14 PASS** لحماية العرض والتصدير.
- `npm run build`: PASS، وفيه N15 1/1 والتجميع Vite PASS. `git diff --check` PASS؛ مطابقة ملفات المصدر في SW مثبتة بالنص.
- العمل في Worktree نظيف من `origin/main=341ca9f1f336666e37c92a580ca5141e89436541` عند البناء: `D:\Abdullah Projects\RakeezX-Research\Rakeez-Compact-Labels-20261027`. لا دمج أو نشر Product حتى يتولى المتحكم والناشر الأصليان ذلك.

## متابعة
- PR Draft مستقل لـPreview؛ لا يعتبر التسليم إنتاجيًا حتى يثبت الناشر Commit Production وCloudflare والإصدار المنشور.
- إن لم تكن هناك نسخة PWA حديثة عند المستخدم، يحتاج فتح Rakeez مرة أثناء الاتصال حتى يتحدث مخزون الملفات التنفيذية وفق دورة Service Worker القائمة. الاختصار لا يحتاج Migration أو تغيير بيانات.
- الملخص المرجعي الرسمي لدليل الإصدار السادس يبقى في مصدر المنتج ولا يطبع في رأس اختيار المواد، تبعًا لقرار N129 السابق.

## Isolated controller candidate — 2026-10-27

- Task `continuous-n131-compact-class-subject-labels-20261027`, run `574767b0-5f0d-41f9-ab0d-dc25a8d0471f`.
- Base `341ca9f1f336666e37c92a580ca5141e89436541` matches observed remote main and the parent of the approved source `a8c57fe401485643837c378bfa1f924e63cbbc24`; no reconciliation was needed.
- Ported only the eight activated paths. All eight Git blob hashes matched the immutable source before this evidence addition; the complete staged tree matched source tree `a3267a396c85596c4f5e5e891dda239a77b603aa`. Runtime and test files remain byte-identical to the inspected Preview candidate.
- Reused the approved actual-app Chromium 2/2 (320/390/1280px) and Preview `38f8e0bc` five-runtime-asset evidence recorded in the activated card; no new browser, server, Preview, provider verification or live mutation was performed. Unchanged source build evidence is reused, not claimed as rerun.
- Current-worktree checks: `node --test tests/n131-compact-display.test.mjs tests/schedule-mobile-today.test.mjs tests/schedule-export-engine.test.mjs` **14/14 PASS**; `node --check` on four changed JS modules and two added test modules **PASS**; `git diff --cached --check` **PASS**.
- Read-only verification confirms existing `sw.js` SHELL entries for `class-order.js`, `subject-catalog.js`, `schedule.js`, and `teaching-hub.js`. No SW, store, export engine, report, N44, N88, N130 or N126 files changed. Full labels, identities and data behavior retain the approved source implementation.
- Local candidate only. Independent controller/publisher owns integration, build metadata and Production verification; Product acceptance is not asserted.
