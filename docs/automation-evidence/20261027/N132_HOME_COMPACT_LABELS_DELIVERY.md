# N132 — اختصارات الفصول والمواد في الرئيسية على الجوال

قرار PO بتاريخ 27 أكتوبر 2026: تطبيق اختصارات عرض الفصول والمواد في الرئيسية على الجوال والشاشات الصغيرة، استمرارًا لقرار N131 المنشور على الجدول ورأس الفصل.

## النطاق
- `src/views/home.js`: الاستفادة من الدالتين الموجودتين والمنشورتين مسبقًا `compactSectionLabel` و`compactSubjectLabel`. تعرض بطاقة تركيز اليوم وحصص اليوم المتبقية أسماء مختصرة عند 640px فأقل، مع الاسم الكامل في `title` و`aria-label` ومسارات الروابط الأصلية. لا تغيير في اختيار الحصة، ترتيبها، بيانات الحضور، أو تفاعل زر الرصد.
- `src/styles/components.css`: CSS محصور بـHome، عرض كامل فوق 640px، ومختصر حتى 640px، مع احترام عرض 320px وتفادي التمرير الأفقي.
- `tests/n132-home-compact-labels.test.mjs`: اختبار قاموس N131 نفسه، المواد المخصصة لا تُختصر، التضارب يرجع للاسم الكامل، وهوية المصدر لا تتغير.
- `tests/n132-home-compact-labels.e2e.mjs`: بيانات Demo اصطناعية فقط، فصلان ومادتان وحصتان؛ تركيز اليوم وبقية حصص اليوم عند 320 و390 و640 و768 و1280 بكسل؛ الاسم الكامل متاح لقارئ الشاشة وفي التلميح، وروابط الفصل والحضور والهويات سليمة؛ لا تمرير أفقي.
- `tests/home-onboarding.e2e.mjs`: تحديث توقعات قديمة إلى عقد الرئيسية المنشور فعلًا: عنوان البدء الحالي وعدم تكرار حالة رصد مكتملة داخل بطاقة التركيز، والتحقق من الاسم الكامل في التلميح مع المختصر للجوال. لم نعدل Product لملاءمة فحص متقادم.

## الفحوص المثبتة
- Chromium 6/6 PASS (2 N132 + 4 Home existing); `RAKEEZ_N132_HOME_COMPACT_BROWSER_20261027.log`.
- Node focused Home unit 17/17 PASS، ومنها 4/4 خاص بالاختصارات.
- `npm run build` PASS بما فيه N15 1/1، Vite PASS في 2.08s.
- `node --check` للواجهة والاختبارات و`git diff --check` PASS.
- تبعيات PWA محفوظة مسبقًا: `src/lib/class-order.js` و`src/lib/subject-catalog.js` و`src/views/home.js` كلها في `sw.js` الحالية. لا حاجة لتعديلها.
- خارج النطاق: مصادر الأسماء، Store, Sync, Backup/Restore, Auth, RLS, Schema, scores, real student records, PDF, calendars, notifications.

## الإتاحة
مرشح معزول يبدأ من `origin/main=c49b1a2eb77df6291af12eec133c412bb2eb8ae2`، `D:\Abdullah Projects\RakeezX-Research\Rakeez-Home-Compact-20261027`.
هذه شريحة Frontend صغيرة. Preview لا يساوي Production، ولا ينشر إلا عبر المتحكم والناشر الوحيدين وبعد تحقق بصمة الملفات المنشورة. `awaiting_po` تسليم تقني ينتظر مراجعة المالك، وليس CLOSED.
