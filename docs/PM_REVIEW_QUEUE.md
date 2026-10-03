# قائمة مراجعة PM — PM REVIEW QUEUE

هذه الصفحة للحالات التي لا يستطيع RAKEEZ Ops حسمها آليًا ولا تحتاج PO فورًا.
لا توقف المشروع كله؛ أوقف lane المتأثر فقط واستمر في المستقل.

## حاليًا
### N58 — PM DECIDED / GREEN TO RESUME: اختبار Home Mobile مشترك
- المشكلة: بعد تصحيح اختبار Email OTP محليًا، فشلت الحالات الثلاث في `home-mobile-account.e2e.mjs` لأنها تنتظر `.topbar__teacher-btn--home-account` غير الموجود؛ الكود الحالي يرسم `.topbar__teacher-btn.compact-identity`. لقطة الفشل تعرض Home في حالة إنشاء أول فصل.
- baseline/candidate: المرجع `430bc2e6d563924aeeeff37837f1732b2cde93eb` والمرشح `9edc41788ecb4952c798131ffd8aed634e45ed08` فشلا في الحالات الثلاث بالأسباب نفسها. Product-source في المرشح ثابت على `3248f7d3847be949c08139b1d630d13f7306e701`.
- الأدلة: قياسان معزولان في `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3\n58-otp-baseline` و`n58-otp-fix`؛ صور الفشل وtraces وسجلات runner محفوظة تحت `test-results` و`artifacts/n58-calendar-client-0457-3/verification` في نسخة المرشح.
- ما الذي جُرّب مرة واحدة: تصحيح اختبار Email OTP test-only ثم إثبات نجاحه 2/2 على baseline والمرشح؛ تشغيل suffix غير المنفذ حتى أول ملف فاشل؛ تشغيل Home Mobile مرة واحدة على baseline. ستة ملفات من suffix اجتازت قبل Home؛ بقيت 73 spec وStage E غير منفذة.
- ما الذي لم يُجرب: إعادة كتابة توقعات Home Mobile أو إعادة تشغيله بعد تعديل، وبقية suffix وStage E، وأي Preview/Production/live Supabase.
- قرار PM الأحدث: ابدأ بتدقيق source قراءة فقط: حدد assertion/الخطوة، وقارن Git blobs للاختبار ولكل ملف Product ذي صلة مباشرة على baseline والمرشح. إذا تطابقت البايتات والفشل نفسه على baseline وثبت أن التوقع قديم مقابل Product مغلق ومعتمد، نفذ تصحيح test-only ضيقًا يحفظ التغطية بلا تغيير `src/` أو behavior أو scope.
- الخيارات الآمنة: شغّل الملف المصحح مرة على baseline ومرة على المرشح بلا retry؛ إذا PASS/PASS أكمل 73 spec غير المنفذة ثم Stage E دون إعادة PASS gates. إذا baseline PASS/candidate FAIL أو تطلب الأمر Product change، أعد تصنيف lane YELLOW وسجل الأدلة ثم أعد قراءة هذه القائمة.
- المسارات الأخرى التي استمرت أثناء الانتظار: تجهيز Workflow V3 docs-only في نسخة معزولة.

### Workflow V3 docs — PM DECIDED / GREEN TO RESUME عبر Git CLI المحلي
- المشكلة السابقة: GitHub connector السحابي أعاد 404، لكن PM تحقق من Git CLI المحلي. فحص RAKEEZ Ops عبر CLI المحلي أعاد remote main `f712e01d1540660559aa574dc975fd8cc0235ef2`.
- ظهر عيب تحضير محلي قبل الدفع: clone أول استند إلى `origin/main` المحلي غير الصحيح وأظهر diff Product واسعًا؛ لم يُدفع شيء. أُنشئ worktree جديد مباشرة من SHA البعيد المؤكد وأعيدت مواءمة docs على ملفات main الحالية، مع حفظ الفرع الأول كدليل.
- baseline/candidate: remote main `f712e01d1540660559aa574dc975fd8cc0235ef2` → فرع `codex/workflow-v3-docs-0466-corrected` في `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3-corrected`.
- القرار: استخدم Git CLI من worktree نظيف معزول. أعد فحص diff والـremote قبل push؛ إذا فشل push بسبب auth/credential، أوقف docs lane YELLOW فقط دون تعديل root أو credentials، واستمر في المسارات المستقلة. لا يتطلب التشغيل مراسلة محادثات العمال القديمة.
- ما لم يكتمل: push/merge، تحقق skipped build، مزامنة canonical docs المحلية.
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
