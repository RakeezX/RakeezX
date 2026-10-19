# N44 — مصدر إصلاح ACK المؤهل للناشر

- AI task: `continuous-n44-publish-qualified-delayed-ack-20261019`
- Run: `7042de33-02fa-4d9b-a5a8-10bce51f4c0c`
- Current-main base: `3b217095b6a17808d1905b9fd717028b05676c3a`
- Qualified source candidate: `11696a34dbc1dca8ff92e15a1b7b65c1408f6b3d`
- Original evidence task/run: `continuous-n44-one-approved-closed-page-push-20261019` / `a5bafe17-2400-4454-8f07-c0076fd18e0a`.

**LOCAL_READY للنشر بواسطة الناشر المستقل فقط.** نُقلت الملفات السبعة أدناه ببايتات Git الأصلية نفسها، دون cherry-pick للتاريخ أو نقل runtime/config أو أي ملف خاص. المقارنة مع قاعدة current-main أظهرت أن التغيير في gateway هو مهلة15 ثانية المؤهلة، وأن امتداد الحاضن الأصلي هو المصدر المحفوظ نفسه؛ لم يلزم تعديل تكاملي جديد.

الإصلاح ينتظر رد ingress المحدود12 ثانية بدل قطع العميل بعد10 ثوانٍ وفقد ACK موافقة وصل فعليًا قرب10002ms. تبقى حواجز المالك قبل الطلب وبعده، وCAS والإذن الصريح وعدم إعادة التسجيل/الإرسال تلقائيًا كما هي. كود حاضن المحاولة الواحدة منقول كمصدر فقط؛ لم يُستدعَ ولم تُقرأ مادته الخاصة. لا تعديل app/SW أو startup dependency، ولا حاجة إلى إعادة فحص offline أو build في هذا النقل المحدود.

## تحقق المصدر والأدلة

`n44_exact_qualified_delayed_ack_source_provenance_reused`: **PASS** — تطابق بايتات الملفات السبعة مع المرشح المؤهل، وصحة syntax للملفات التنفيذية الخمسة، وصحة JSON وحالة PASS الأصلية للإيصالين، و`git diff --check`. لم يُعد تشغيل أي اختبار UI/11s/journal أو خدمة/PG/crypto.

أُعيد استخدام `tests/n44-device-1019-delayed-ack.json`: مسار الإعدادات الفعلي وDOM/handler/CSS ومساحة حساب مصطنعة بحارس ملكية حقيقي عبر HTTP؛ ACK متأخر11 ثانية أكمل تسجيلًا مصطنعًا واحدًا وربط SW واحدًا، وبقي رد المالك غير الصالح مرفوضًا. وأُعيد استخدام `tests/n44-device-1019-attempt-journal.json`: حجز متزامن بفائز واحد، ACK الكتابة قبل sender، وعدم استبدال العلامة بعد نتيجة مجهولة أو run مختلف. تبقى هوية المهمة والتشغيل الأصليين داخل الأدلة دون إعادة تسميتها أو ادعاء تنفيذها في هذا التشغيل.

| الملف المنقول من المرشح المؤهل | SHA256 للبايتات الأصلية |
| --- | --- |
| `src/lib/notification-push-gateway.js` | `76bbef85a8db000cfbb01dc826cf1978808639ab0f3442618460d4b6178817b1` |
| `drafts/n44-push/activation/device-custodian.mjs` | `f1d3882c01a5eedf1e0d08b4fa703139837ba101bb71262ab917a7910d7ff143` |
| `drafts/n44-push/activation/device-attempt-journal.mjs` | `9cb75226246e8929081792098220f1dfba19b3a35b7d56a2af7b5242f1cc58e2` |
| `tests/n44-device-1019-delayed-ack.mjs` | `f29dbd6aee4d0c04c275ad1d6f73bde1fdf640767cd2525e0d8f7102921d9d5c` |
| `tests/n44-device-1019-delayed-ack.json` | `e205da156816dfb20bb1b136787d2a0b8657e063c3250afd47e872089375dcaf` |
| `tests/n44-device-1019-attempt-journal.mjs` | `f0864a1b67072a577971296753ba67f3c7893e8bbc925507d333a92f6404bb74` |
| `tests/n44-device-1019-attempt-journal.json` | `ddd92cc48e9effec9f7149545b65915f79f47dfa20a4d65c9349be6f236b2cd0` |

## حدود النتيجة

لم يحدث نشر أو تعديل خدمة/Edge/ingress/config أو تسجيل جهاز أو طلب إذن أو إرسال أو عملية SQL/Auth/fixture. لا مفاتيح أو tokens أو ملفات custody خاصة ضمن النقل. لم تُحجز موارد متصفح أو خادم أو live-mutation، ولا توجد موارد مملوكة تحتاج تنظيفًا. يبقى فشل التسجيل وغياب إثبات الإرسال/OS والتنظيف النهائي في المهمة الأصلية محفوظًا؛ لا يتحول أي منها إلى PASS بهذا النقل، ولا تتجدد ميزانية المحاولة الواحدة.

الناشر وحده يثبت المصدر المخدوم على HTTPS. بعدها تستأنف المهمة التابعة الجلسة الأصلية نفسها، وتُصالح الموافقة/ACK والتسجيل الموجود قبل استكمال محاولة الإرسال الوحيدة والتنظيف. هذه نتيجة جاهزية مصدر الإصلاح، وليست إثبات نشر أو وصول إشعار أو إغلاق N44؛ يبقى N78 مؤجلًا.
