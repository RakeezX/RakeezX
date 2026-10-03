# قائمة مراجعة PM — PM REVIEW QUEUE

هذه الصفحة للحالات التي لا يستطيع RAKEEZ Ops حسمها آليًا ولا تحتاج PO فورًا.
لا توقف المشروع كله؛ أوقف lane المتأثر فقط واستمر في المستقل.

## حاليًا
### N58 — YELLOW: اختبار Home Mobile قديم مقابل الواجهة الحالية
- المشكلة: بعد تصحيح اختبار Email OTP محليًا، فشلت الحالات الثلاث في `home-mobile-account.e2e.mjs` لأنها تنتظر `.topbar__teacher-btn--home-account` غير الموجود؛ الكود الحالي يرسم `.topbar__teacher-btn.compact-identity`. لقطة الفشل تعرض Home في حالة إنشاء أول فصل.
- baseline/candidate: المرجع `430bc2e6d563924aeeeff37837f1732b2cde93eb` والمرشح `9edc41788ecb4952c798131ffd8aed634e45ed08` فشلا في الحالات الثلاث بالأسباب نفسها. Product-source في المرشح ثابت على `3248f7d3847be949c08139b1d630d13f7306e701`.
- الأدلة: قياسان معزولان في `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3\n58-otp-baseline` و`n58-otp-fix`؛ صور الفشل وtraces وسجلات runner محفوظة تحت `test-results` و`artifacts/n58-calendar-client-0457-3/verification` في نسخة المرشح.
- ما الذي جُرّب مرة واحدة: تصحيح اختبار Email OTP test-only ثم إثبات نجاحه 2/2 على baseline والمرشح؛ تشغيل suffix غير المنفذ حتى أول ملف فاشل؛ تشغيل Home Mobile مرة واحدة على baseline. ستة ملفات من suffix اجتازت قبل Home؛ بقيت 73 spec وStage E غير منفذة.
- ما الذي لم يُجرب: إعادة كتابة توقعات Home Mobile أو إعادة تشغيله بعد تعديل، وبقية suffix وStage E، وأي Preview/Production/live Supabase.
- سبب عدم إمكانية الحسم الآلي: الاختبار يثبت Presentation/geometry/shortcuts لحالة Home قديمة؛ تحديثه يتطلب مطابقة عقد N41/الواجهة الحالية وتغطية مكافئة، لا مجرد إصلاح محدد. لا يُنسب الفشل إلى N58، لكنه يمنع شهادة browser الكاملة.
- الخيارات الآمنة: يراجع PM نطاق التغطية الحالية ويحدد تصحيحًا test-only يحفظ العقد المرئي؛ بعدها قياس baseline/candidate مرة واحدة للملف المصحح، ثم إكمال 73 spec وStage E إن PASS. توقف lane N58 فقط.
- المسارات الأخرى التي استمرت أثناء الانتظار: تجهيز Workflow V3 docs-only في نسخة معزولة.

### Workflow V3 docs — YELLOW: تعذر التحقق من main البعيد والدمج
- المشكلة: commit محلي docs-only `56f5876` جاهز على فرع `codex/workflow-v3-docs-0466`، لكن GitHub connector أعاد 404 و`git ls-remote` فشل الاتصال بمنفذ 443. لا يحق للنسخة المعزولة الكتابة إلى جذر `D:\Abdullah Projects\RakeezX` المتسخ.
- baseline/candidate: `origin/main` المحلي `f712e01d1540660559aa574dc975fd8cc0235ef2` → `56f5876`؛ current remote main غير مؤكد.
- الأدلة: branch وcommit في `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3`؛ `git show --check` ناجح، التغيير عشرة ملفات docs فقط وعنوانه `[CF-Pages-Skip]`.
- ما الذي جُرّب مرة واحدة: موصل GitHub، وقراءة Git البعيد عبر HTTPS.
- ما الذي لم يُجرب: push/merge، تحقق skipped build، مزامنة canonical docs المحلية.
- سبب عدم إمكانية الحسم الآلي: لا يمكن إثبات remote main أو تشغيل provider ضمن الوصول الحالي؛ الجذر المحلي يحوي تعديلات مستقلة لا يجوز الكتابة فوقها.
- الخيارات الآمنة: عند عودة قناة Git المصرح بها، أعد التحقق من main، انقل docs commit إذا بقيت مطابقته آمنة، ثم تحقق provider وملفات docs المحلية byte-by-byte قبل مزامنة الملفات الخمسة والجداول المحدثة فقط. لا تفترض اكتمال التفعيل قبل ذلك.
- المسارات الأخرى التي استمرت أثناء الانتظار: N58 local verification المعزول حتى أول إخفاق جديد.

## قالب
### [Ticket] — YELLOW
- المشكلة:
- baseline/candidate:
- الأدلة:
- ما الذي جُرّب مرة واحدة:
- ما الذي لم يُجرب:
- سبب عدم إمكانية الحسم الآلي:
- الخيارات الآمنة:
- المسارات الأخرى التي استمرت أثناء الانتظار:

## متى تتحول إلى RED؟
إذا كشف التحليل قرار Product جديدًا، فرقًا بصريًا ماديًا، أو خطر data/security/live high-risk.
