# N88 — تجربة تشغيلية محلية من التطبيق الحالي

AI-authored. Task `continuous-n88-current-functional-review-20261018`, run
`02c487b0-7239-4750-b293-5ce1e9c480c1`. Base and observed remote `origin/main`:
`522bc6d991aceb90cb2ff83982f6a26d0e75a002` (`git ls-remote origin refs/heads/main`).

النتيجة مصدر محلي قابل للتشغيل ببيانات مصطنعة فقط. لا نشر أو تفعيل مستضاف،
ولا قبول PO أو إغلاق N88. لا يترك العامل سيرفرًا يعمل بعد الفحص.

## التشغيل بعد تسليم المصدر من الناشر

من جذر checkout الذي يحتوي على المرشح المسلّم، على الجهاز الحالي:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 --help
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1
```

الأمر الثاني هو المشغّل الوحيد؛ يُرجع `review.url` لصفحة المعلم مباشرةً،
و`receiptPath` وPID/وقت الإنشاء الفعليين لـNode وPG و`expiresAt`.
يفتح المشغّل عملية Windows مخفية. لا رابط ثابت قد يشير لسيرفر متوقف.
افتح الرابط المرجع في سياق متصفح جديد مصطنع، دون حسابات أو ملف شخصي أو SW؛
لا تدخل بيانات حقيقية. لا يحتاج التشغيل عامل Product أو جلسة Codex جديدة.
المشغّل يستخدم Node وPG17.6 المثبتين؛ عند غياب تبعيات الخدمة يعيدها من
`package-lock.json` باستخدام `npm ci --offline --ignore-scripts --no-audit --no-fund`
في مجلد الخدمة فقط. لا تنزيل أو تغيير إعداد عالمي أو اعتماد مدفوع.
إن لم تتوفر الحزم في cache يتوقف قبل إنشاء السيرفر.

المهلة الافتراضية أربع ساعات؛ `-TtlSeconds 28800` هو الحد الأقصى،
ولا تقبل القيم فوق ثماني ساعات. الإيقاف المبكر بالإيصال نفسه:

```powershell
powershell -NoProfile -File drafts/n88-student-portal/current-review-launch.ps1 -Stop -Receipt '<receiptPath returned above>'
```

الإيقاف يطابق PID وbirth وexecutable وcommandLine قبل طلب إغلاق مملوك،
ولا يستعمل kill أو STOP/leases الخاصة بالمتحكم. تطابق ملكية PG ومساره وPID/birth
قبل pg_ctl؛ ثم يغلق HTTP/PG ويحذف مجلده المصطنع وحده. الإيصال يبقى بلا
PIN أو رابط طالب خاص أو cookie أو bearer أو كلمة مرور. المهلة وSIGINT/SIGTERM
تسلك finally نفسه. الإغلاق القسري من نظام التشغيل ليس إشارة graceful مضمونة.

## الرحلة وما استُخدم فعلاً

تظهر الإرشادات العربية والشريط «تجربة تشغيلية ببيانات مصطنعة؛ الخدمة الحية غير مفعلة.»
خارج مشاهد المنتج. معلم وعضوية وطالب ونشاط مصطنعون جاهزون. اختر الطالب ثم إدارة
الوصول وإنشاء الرمز؛ يظهر PIN1000..9999 ورابطه الخاص، ومعه رابط «فتح صفحة الطالب»
في تبويب مستقل. أدخل الرمز هناك. أغلق عرض الرمز عند المعلم، ثم اختر الطالب وانشر
النشاط واحفظ؛ حدّث الطالب. عدّل الحالة عند المعلم ثم حدّث الطالب، وأخيرًا ألغ الوصول
وتحقق من عودة الطالب لطلب الرمز. الطالب يقرأ فقط؛ التحديث عند المعلم.

التركيب هو `student-portal-runtime.js` و`teacherBinding` مع حارس أوامر المالك
الفعلي، ومشهدا المعلم/الطالب وCSS الحاليان، ثم client → Cloudflare signer →
Web entry → runtime/http adapter/service → repository المقيد بـ`n88_backend`
على PG17.6 أصلي محلي. تستخدم وثيقة الطالب ومدخله الفعليين؛ حقن readiness
المحلي فقط عند تقديم المدخل من السيرفر، دون تعديل ملفات الإنتاج. Auth ومعلومات
TLS/ingress وصفوف المصدر مصطنعة؛ لا اتصال بمزوّد أو Supabase مستضاف.
القاعدة تبدأ من canonical fixture المؤهل ثم **الهجرة المرحّلة الحالية
20261018034356 نفسها** تحت postgres غير superuser، ثم seed محلي بأبناء وآباء صالحين.
لا memory repository أو teacher-controller القديم أو invite-lab.

HTTP/PG مربوطان بـ127.0.0.1 ومنافذ منفصلة متاحة. قائمة الملفات من رسم وحدات
التطبيق المرحّل، بلا listing أو SQL/docs/config/server source/SW؛ رفض Origin
أجنبي والاستعلامات غير المحددة؛ CSP self-only وno-store/no-referrer. الرمز والرابط
والجلسة في الذاكرة/السياق المحلي فقط؛ لا تُطبع أو تدخل query أو لقطات الإثبات.

## دليل محدود

`node tests/n88-current-review.mjs` نجح: رحلة الواجهات الفعلية كاملة على390/1280
في fresh isolated contexts بواسطة helper المتحكم، تشمل إنشاء الرابط وفتحه فعليًا،
claim والنشر والقراءة وتعديل الحالة والإلغاء. لا أخطاء صفحة أو تسريب قيم خاصة
في console، ولا تجاوز عرض الشاشة. فُحصت لقطات المعلم والطالب بصريًا؛ كلها بعد
إزالة عرض الرمز والرابط. `tests/n88-current-review.result.json` يسجل الفحوص
وإغلاق السيرفر والمتصفح وPG وNode وحذف البيانات وإطلاق integration lease.
اختُبر --help وحدود المهلة، وطلب الإيقاف المملوك وانتهاء مهلة1ث مستقلاً.
بعد إضافة الاستعادة offline وتأخير import الخدمة، نجح
`node tests/n88-current-review-launcher.mjs` مع إخفاء manifest التبعية التي ثبتها
هذا العامل مؤقتًا: عمل --help، واستعاد المشغّل التبعية المقفلة من cache، ثم
انتهت المهلة وأُغلقت الموارد؛ النتيجة في `tests/n88-current-review-launcher.result.json`.
أُعيد استخدام دليل UI غير المتغير؛ syntax و`git diff --check` ناجحان.
لم نعد تأهيل SQL/crypto/PIN/owner أو suite عامة أو بناء Vite.

أُعيد استخدام نتائج client-binding/native-postgres/activation-postgres السابقة.
تطابق77 source hashes مع حزمة التفعيل؛ الفرق الوحيد في مصادرها هو إضافة N44
لمراقبي نجاح Sync في `f4a948b3410d416d81aae155527916eebfb8134e`، لا تستدعي
المراجعة syncAll، ولم يُدّعَ أن هذا الملف لم يتغير. يُقدَّم المصدر الحالي نفسه.
بقيت الإخفاقات الأولية في `tests/n88-current-review.initial-*.json`: assertion
واسع شمل Sync غير المتأثر؛ وراثة handles من تشغيل Windows مع stdio redirected
(صُححت بإطلاق shell مخفي)؛ ومراقب الشريط الذي افترض وجود جذر المعلم عند الطالب
(قُيّد بوجود الجذر). لم تتغير بوابة منتج أو دليل فاشل إلى PASS بلا تصحيح.

## التفعيل الحي المتبقي — نفس الحزمة، لا حزمة أخرى

المرجع التنفيذي الدقيق هو [N88_EXACT_ACTIVATION_CANDIDATE.md](N88_EXACT_ACTIVATION_CANDIDATE.md)
وحزمة `drafts/n88-student-portal/activation` المنشورة source-only في54722e0؛
والربط العميل المنشور a6a02a5. لم ينفذ هذا العامل أياً من الآتي:

1. fresh metadata/preflight للمشروع المحدد ومقارنة snapshots/privileges/history.
2. تطبيق الهجرة20261018034356 مرة واحدة تحت صلاحيتها الدقيقة، ثم readback
   للهويات وACL وعدم تعرض n88_private عبر Data API/GraphQL قبل LOGIN.
3. تحويل n88_backend وحده إلى LOGIN وحيازة DB URL/TLS وHMAC/ingress المنفصلين
   وحقن الأسرار خصوصيًا حسب وثيقة التفعيل.
4. التحقق من Auth/JWKS/session/getUser وTLS/CF ingress وسياسات logs/analytics.
5. نشر الدالة والبوابة والمسارين `/api/n88/*` و`/s/<private-entry>` والـassets
   المحددة على الأصل الموجود، مع البقاء disabled حتى اكتمال أدلة الخدمة.
6. fixture مستضاف جديد مأذون وفحوص المالك والجلسة وlifecycle وrevoke/rotation
   والصلاحيات السلبية والجهاز/المتصفح وprivate handoff/cache/SW، ثم تنظيفه المأذون.
7. بعد readbacks فقط، diff تفعيل N88_ENABLED على الطرفين وbrowser readiness المطابق.

هذه عمليات خدمة خارج نطاق الناشر العام وخارج هذا المشغّل المحلي؛ صلاحياتها
الدقيقة محفوظة في الوثيقة الأصلية. Production live student capability بقي OFF.
