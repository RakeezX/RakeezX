# N88 — حزمة تجربة استخدام فعلية محلية، للقراءة فقط

**جاهزة كمصدر معزول للمراجعة، وليست تفعيلًا حيًا. N88 يبقى OPEN.**

Task: `continuous-n88-real-use-readonly-pilot-preparation-20261017` · Run: `3c617c1e-b814-4bb3-beeb-df52b8f77490`.
Base: `7fb1bd31eab8f1838db71f16e37fc9a57aceae1b`.
السلطة: بطاقة PO17October2026 13:23 لتحضير مصدر قابل للعكس وبيانات مصطنعة فقط؛ عقد [الدعوة الحقيقي](../20261016/N88_SYNTHETIC_INVITE_UX_PILOT.md) وبوابة الخدمة والبيانات الخاصة ما زالا ملزمين. لم تتغير صفحة العرض العامة المعتمدة، ولا bootstrap/router/SW/index أو صفحات المعلم القائمة أو CSS المشترك.

## ما أصبح يعمل

المعلم يختار عضوية حالية من خدمة تتحقق من حسابه، يراجع الطالب ثم يصدر دعوة واحدة. يستطيع إلغاء المراجعة دون إصدار، ونسخ الرابط الكامل أو طباعته للتسليم الخاص؛ لا إرسال WhatsApp أو دعوات جماعية. إعادة الإصدار تلغي الدعوة والجلسات السابقة. رابط الدعوة يعرض سره مرة واحدة في واجهة المعلم؛ إغلاق البطاقة يمسحه من DOM. الطباعة والنسخ اعتمادات محقونة؛ الاختبار يثبت استدعاءهما، ولا يثبت طابعة أو clipboard نظام تشغيل.

الطالب يفتح الرابط مباشرة دون بريد أو هاتف أو تسجيل حساب أو مطابقة اسم. تُزال fragment وquery من سجل URL قبل المطالبة، بما يشمل فتح رابط جديد داخل الوثيقة نفسها. السر الكامل ينتقل في JSON POST عابر إلى المعالج؛ لا حفظ في localStorage/sessionStorage/IDB أو logs/telemetry أو query. البديل اليدوي يستخدم السر نفسه كاملًا، لا PIN أقصر. تظهر «ما المطلوب مني؟»، المهمة التالية، الحالة والموعد والتقدم؛ مع تحديث وإنهاء جلسة فقط. لا واجبات قابلة للإرسال أو اختبارات تفاعلية أو مرفقات أو دردشة أو أسماء زملاء.

المعالج ينشئ سرًا من `node:crypto.randomBytes(32)` بقوة 256bit، ويحفظ SHA-256 فقط. مقارنة hashes داخل الخدمة تستخدم `timingSafeEqual`؛ SQL المقترح يبحث بفهرس hash، ولا يقارن سرًا خامًا. المطالبة تستهلك الدعوة وتصدر جلسة في transaction واحدة. تستبدل مطالبة طالب جديد الجلسة السابقة، وحتى فشل الدعوة الجديدة يلغي القديمة؛ لا عودة صامتة لبيانات الطالب السابق. الجلسة في cookie `__Host-n88; Path=/; HttpOnly; Secure; SameSite=Strict` فقط، ولا bearer في JSON. النموذج اختبر cookie حقيقية على loopback داخل Chromium؛ هذا ليس دليل HTTPS/بوابة مستضافة.

كل قراءة تعيد التحقق من owner + class + student + enrollment + revision وحالة الطالب/الفصل والعضوية والإلغاء وانتهاء الجلسة، ثم تعيد إسقاط المنشورات الحالي. لا تُنقل حالة المعلم أو قاعدة بياناته إلى الطالب. يمسح العرض السابق قبل انتظار القراءة؛ الفشل يزيل المحتوى الخاص. foreground/reload يعيدان القراءة، وpagehide يمسح DOM للتخفيف من استرجاع محتوى قديم. الإلغاء وسحب النشر يمنعان **القراءة التالية**؛ لا ادعاء بمحو ما شاهده المستخدم أو بمنع screenshot أو بتحديث push فوري.

## الملفات الدقيقة

| المسار | الدور |
| --- | --- |
| `src/lib/student-portal-client.js` | عميل same-origin محقون، مسح fragment، دون آثار عند import |
| `src/views/student-portal.js` | DOM ومعالجات واجهة الطالب الفعلية؛ غير مسجل في التطبيق |
| `drafts/n88-student-portal/teacher-controller.js` | اختيار/مراجعة/إصدار/إلغاء ونسخ/طباعة، محقون خارج toolbar المعلم |
| `drafts/n88-student-portal/portal.css` | أنماط محصورة تستخدم tokens من `src/styles/app.css` الفعلي |
| `drafts/n88-student-portal/service.mjs` | معالجات issue/claim/read/revoke/logout، الحراسة والإسقاط والحدود |
| `drafts/n88-student-portal/memory-repository.mjs` | repository مصطنع، mutex ونسخة transaction مع rollback؛ ليس adapter مستضافًا |
| `drafts/n88-student-portal/schema-proposal.sql` | مسودة جداول/فهارس/قيود/RLS default-deny ومطالبة ذرية، خارج migrations/functions |
| `drafts/n88-student-portal/local-preview.mjs` | تشغيل loopback صريح ببيانات مصطنعة فقط |
| `tests/fixtures/n88-real-pilot/{fixture.mjs,server.mjs,index.html,entry.js}` | بيانات وauth وساعة مصطنعة وHTTP يركّب الوحدات الفعلية؛ لا HTML بديل للواجهة |
| `tests/fixtures/n88-real-pilot/student-{320-light,1280-dark}.png` | لقطتان فعليتان راجعهما العامل بصريًا، دون أسرار أو بيانات حقيقية |
| `tests/n88-real-pilot.test.mjs` | 12 اختبار خدمة/خصوصية/تزامن/حدود مصدر |
| `tests/n88-real-pilot-browser.{mjs,json}` | 4 حالات UI + دخول محقون بالتطبيق الحقيقي ودليلها |
| هذه الوثيقة | حزمة مراجعة التفعيل وحدوده |

لا import لهذه الوحدات من graph الإنتاج، ولا تسجيل طريق أو Service Worker أو اتصال شبكة عند استيرادها. لا ملفات في auto-deploy functions/migrations. لا مكتبة أو اشتراك جديد، ولا قراءة env/config/secrets أو استعلام hosted أو إنشاء دعوة/حساب حقيقي. الناشر المستقل يستطيع نشر **المصدر الخامل** فقط وفق البطاقة؛ لا يفعّل هذه الحزمة أو يطبّق SQL.

## عقد الخدمة والبيانات

واجهة المستقبل: `GET /api/n88/teacher/students`، `POST /teacher/issue` و`/teacher/revoke` باستخدام enrollmentId+revision؛ الطالب `POST /claim`، `GET /read`، `POST /logout`. لا endpoint تعديل بيانات الطالب. قائمة المعلم تعرض label العضوية المتحقق منها؛ label لا يثبت الهوية ولا يختار العلاقة. endpoint الطالب يتجاهل أي owner/student supplied IDs؛ الهوية تأتي من الجلسة فقط.

`verifyTeacher(request)` اعتماد **إلزامي بلا default**: يتحقق مستقلًا من المصادقة الحالية ورفض الجلسة القديمة/المحذوفة ويرجع ownerId+sessionId؛ ممنوع الوثوق بـuser_metadata أو body/header يحدده المستخدم. `X-Fixture-Teacher` موجود في fixtures فقط وهو هوية مصطنعة قابلة للتزوير عمدًا؛ لا يجوز نشره كحارس حساب. `sourceKey` يأتي مستقبلًا من ingress موثوق، وليس X-Forwarded-For غير موثوق. لا يوجد adapter مصادقة مستضاف بعد.

لا تُستنتج علاقة من الاسم/رقم التواصل. قرأنا `student-lifecycle.js` وحراسة `sync-ownership.js` و`store.studentContext/studentHistory` و`student-achievements.js`: تحفظ السجلات الأصلية studentId/sessionId/teachingId/sectionId والمالك والمراجعة، والسجل المستمر يحتوي أيضًا حضورًا وملاحظات ودرجات **لا تصلح للتصدير الكامل للطالب**. الربط المستقبلي يثبت `enrollmentId = enrollments.id` و`studentId = students.id` و`classId = section.id` (اسم داخلي في المسودة)، ومراجعة الخادم، وsource teaching/item/session الأصليين عند الحاجة؛ لا نسخ أو إعادة ترقيم التاريخ. لم نستدعِ هذه الواجهات الخاصة من واجهة الطالب. جدول membership المقترح يمثل العقد، **ليس إذنًا بإنشاء mirror يمكن أن تتقادم عضويته**؛ يلزم adapter يقرأ الحالة المرجعية الحالية تحت transaction قبل التفعيل.

الإسقاط الوحيد المنشور: `tasks[{id,title,instruction,status,deadline,result?}]` و`progress{completed,total}`. العنوان 160 حرفًا والتعليمات 500؛ status محصور، الموعد ISO اختياري معروض فقط (لا date/time input جديد). التقدم عدد المهام المكتملة من المنشورة لهذا الطالب نفسه، لا درجات أو attendance-derived achievements. **الدرجات OFF افتراضيًا**؛ result لا يظهر إلا عند `resultPublished === true` وقيمة صحيحة بين صفر والحد الأعلى ضمن مهمة منشورة لذلك الطالب. لا الحضور أو ملاحظات المعلم أو بيانات الزملاء أو معرّفات المالك/الطالب/الفصل الداخلية في الإسقاط. لا يوفّر هذا النطاق واجهة نشر نتائج حقيقية؛ تلك تحتاج قرار نشر مناسب للعمر والخصوصية.

السياسات المحلية المقترحة: صلاحية دعوة 15 دقيقة؛ جلسة 8 ساعات دون تجديد تلقائي. عضوية انتهت أو تغيّرت مراجعتها، حذف/تعطيل الطالب أو الفصل، revoke/reissue/unpublish يطبق عند القراءة. الجلسات الملغاة/المنتهية تُحذف عند الطلب التالي؛ الدعوات تحتفظ بـhash والحالة حتى يوم بعد expiry، مع إبقاء دعوة مرتبطة بجلسة صالحة. production يحتاج scheduled purge موثوقًا للحذف خلال المدة، لا الاعتماد على وصول طلب جديد. rate windows دقيقة واحدة؛ 30 طلبًا لكل مصدر و30 لكل مالك/محاولة hash، وبحد 10,000 مفتاح، TTL وحجب fail-closed عند امتلاء السعة. الذاكرة مصطنعة؛ التنفيذ المستضاف يحتاج rate limit موزعًا ذريًا، ingress موثوقًا وسياسة لا تسهّل حجب شبكة مدرسة مشتركة. لا IP خام محفوظ في المستودع، ولا سجل طلب يحتوي السر/cookie/body/link.

حماية HTTP منفذة في المعالج المحلي: no-store/private، no-referrer، noindex/nofollow/noarchive، nosniff، لا CORS؛ كل POST يتطلب Origin مطابقًا وJSON وheader غير بسيط `X-N88-CSRF: 1`، مع رفض Sec-Fetch-Site غير same-origin إن وجد. الحماية هي Origin+header/preflight، وليست ادعاء بوجود CSRF secret. تكامل HTTPS النهائي يجب أن يحافظ عليها، ويمنع analytics وSW/private offline cache وإعادة توجيه/تسجيل أسرار المطالبة، ويوفر CSP ضيقة بلا inline/untrusted scripts. خصائص cache/headers يجب أن تُثبت في ingress وCDN أيضًا؛ لا يكفي وجودها في المصدر.

## التحقق الفعلي وحدوده

- `node --test tests/n88-real-pilot.test.mjs`: **12/12 PASS**. حساب حالي/مرفوض/مالك آخر ومراجعة قديمة، انتحال metadata/owner، hash-only/cookie headers، 20 مطالبة متزامنة = جلسة واحدة، إعادة إصدار متزامنة وإلغاء أثناء مطالبة، انتهاء/إلغاء/إعادة استخدام، فصل/طالب/عضوية/مالك تغير، عرض أدنى ونتيجة صريحة وسحب نشر، تبديل طالب ناجح وفاشل/logout، CSRF/طرق غير مصرح بها، حدود rate/retention/rollback وفشل repository عام، fragment/inert import graph.
- `node tests/n88-real-pilot-browser.mjs`: **5/5 PASS** في الدليل JSON؛ 320 light و390 dark و1280 light/dark. الواجهات والمعالجات وCSS من الملفات الفعلية، عبر HTTP في سياقات جديدة باستخدام `withIsolatedLocalBrowser` المعتمد. إصدار/إلغاء/copy/print injection، رابط ومطالبة وcookie وإعادة تحميل، default-off ثم نشر نتيجة وسحب مهمة وإلغاء وصول وإعادة استعمال، fallback كامل ورفض PIN، تبديل بدعوة فاشلة دون استعادة الطالب السابق ثم logout، RTL/عدم overflow/44px/focus وعدم حفظ السر أو إرساله في URL. راجعنا اللقطتين بصريًا.
- استخدم فحص الدخول `openReadyServedDemo` الفعلي، ثم ركّب controller محقونًا داخل وثيقة التطبيق: كل مخازن IndexedDB وlocalStorage/sessionStorage بقيت متطابقة قبل/بعد المراجعة والإلغاء ورفض auth الحالي وdispose. لا حراسة قائمة أُعطلت ولا تغيير في toolbar الحقيقي. هذا لا يثبت حساب معلم حي أو تكامل frontend account entry مستضاف لم يُوصل أصلًا.
- `node --check` للوحدات الجديدة و`git diff --cached --check`: syntax/نطاق المصدر فقط. لا حاجة build شامل؛ لا startup dependency جديد ولا تغيير shell/SW؛ import-graph assertion وفروق Git يثبتان خمول الحزمة وبقاء العرض المعتمد.
- العزل: canonical helper يملك السياقات والمحرك ويغلقها في finally، SW محجوب والطلبات محصورة بالـloopback المحدد؛ server يختار منفذًا فريدًا ويغلق اتصالاته في finally. لا lease متصفح حي مشترك لهذه المرحلة المصرح بها ولا موارد متبقية.

الفشل الأصلي محفوظ نصًا بلا أسرار: أول فحص replay داخل الوثيقة وجد fragment لم يُمسح؛ أصلحنا hashchange وأعدنا الفحص المتأثر. فحص التطبيق العادي فشل بـ`400 /src/lib/score-distribution-copy.js` لأن harness منع query إصدار ملف ثابت؛ سمحنا queries للملفات الثابتة فقط مع استمرار منعها في API، وأعدنا **فحص الدخول وحده** بعد حفظ نجاح حالات UI. تحسين تبديل الطالب الفاشل/logout أعقبه آخر فحص محلي متأثر ناجح. لا فشل خدمة حي أو إنفاق fixture حي حدث.

المستودع يستخدم mutex عالميًا وtransaction بنسخة مع rollback في **عملية Node واحدة**. اختبارات التزامن تستدعي المعالج فعلًا وتختبر هذا التنفيذ، لكن ضمان transaction جزء من عقد adapter المستقبلي: أقفال membership → invite → session بترتيب موحد، فحص المالك والمراجعة داخلها، read snapshot واحدة للنشر، قيود unique للـhash ولجلسة الدعوة، وربط المفاتيح الرباعي. لا شبكة أثناء قفل DB. SQL يحتوي هذه القيود ومطالبة `FOR UPDATE` بدالة غير PUBLIC، `search_path=''` وأسماء مؤهلة وRLS default-deny بلا grants. ليس adapter مكتملًا، ولا إثبات تنفيذ كل العمليات في PostgreSQL.

## بوابات التفعيل وخطوة تالية قابلة للتنفيذ

| البوابة | الحالة الحالية / المطلوب |
| --- | --- |
| تشغيل schema/runtime/RLS فعلي | **NOT_RUN**؛ لا `psql/postgres/initdb` متاحًا في PATH ولا local instance مملوكة مثبتة. لم نثبت بنية تحتية أو نقرأ config أو نجرب instance غير معروف. SQL مقترح فقط؛ embedded/memory ليس شهادة hosted SQL. |
| Auth/service/source adapter | **NOT_RUN**؛ يحتاج إذنًا دقيقًا، canonical membership/publication mapping وcurrent server auth، أدوار least-privilege دون frontend service-role وgrants عامة. فحص auth/RLS/owner والمصدر المرجعي تحت السباقات قبل توصيل frontend. |
| خدمة مستضافة وتزامن حقيقي | **NOT_RUN**؛ transactions متعددة الاتصالات، claim/reissue/revoke/enrollment-end/unpublish، قيود/RLS سلبية، فشل الشبكة وrollback، rate موزع/purge، readback هوية الخدمة والمخطط بعد تفعيل مصرح به. الناشر العادي لا يطبق هذه الخدمة. |
| HTTPS/privacy/cache | **NOT_RUN**؛ cookie/Origin/CSRF/headers/CSP/noanalytics وCDN/proxy/log redaction/referrer/URL-history/عدم تخزين خاص أو teacher-state mixing على الهدف الحقيقي. لا تمرير source PASS كإثبات لهذه البوابة. |
| قرار النشر/العمر/التسليم الخاص | **NOT_RUN**؛ PO يحدد نطاق بيانات فردي وموافقة ولي الأمر والمتطلبات العمرية والاحتفاظ والتسليم للشخص الصحيح. لا real invites أو قراءة بيانات حقيقية في هذه البطاقة. |
| أجهزة فعلية | **NOT_RUN**؛ iOS Safari/Android، لصق الرابط ومسح fragment/history، لوحة المفاتيح، BFCache/foreground، جهاز مشترك، revoke/reissue/expiry، clipboard والطباعة وحجم الخط/قارئ شاشة. Desktop Chromium emulation لا يحل محلها. |
| rollout/rollback وتكلفة | يظل الاستيراد OFF. بعد إذن مستقل: حصر صغير محدد المعلم/الطلاب، أقل منشورات ومراقبة عدادات منقحة، ثم قبول البوابات قبل توسيع العدد. rollback يوقف الإصدار/القراءة ويُلغي الجلسات ويمسح cache ضمن سلطة مستقلة؛ إخفاء الواجهة وحده غير كاف. الدعوات يدوية بلا إرسال/تخزين مرفقات/اشتراك جديد؛ حدود قراءة/rate وسقف عدد pilot مع قياس التشغيل قبل التوسع. |

للمراجعة الآن فقط: من جذر worktree شغّل `node drafts/n88-student-portal/local-preview.mjs --synthetic`، وافتح عنوان `/teacher` المطبوع، ثم افتح الرابط الفردي الناتج في `/student`. Ctrl+C يغلق الخادم المملوك. هذه عناوين loopback مؤقتة وبيانات افتراضية؛ لا تشاركها كدعوات حقيقية ولا ترفع هذا الخادم كخدمة عامة.

تحسينات مقترحة للمرحلة المأذونة التالية: معاينة المعلم لنفس إسقاط الطالب قبل النشر، اختيار مدة أقصر للتسليم الفوري، ورقة فردية بخيار QR يستخدم **نفس السر الكامل** بعد قرار تسليم خاص، وتوضيح الحالة الخالية دون ترتيب أو مقارنة زملاء. لا تبدأ هذه الإضافات أو submissions أو marketing أو Admin framework من هذه الحزمة.

مراجع Supabase الأولية التي قُرئت قبل صياغة المقترح: [Changelog](https://supabase.com/changelog)، [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)، [Database functions](https://supabase.com/docs/guides/database/functions). اعتمد المقترح schema خاصة وdefault-deny ومنع PUBLIC execute وsearch_path مقيدًا؛ القراءة لم تشمل حسابًا أو مشروعًا أو secret/config. تظل مراجعة الـgrants وتكامل canonical source واختبار RLS الفعلي بوابات مستقلة.
