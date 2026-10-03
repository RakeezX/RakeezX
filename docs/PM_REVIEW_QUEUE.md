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

### Workflow V3 docs — دمج مكتمل / skipped build غير متحقق
- المشكلة السابقة: GitHub connector السحابي أعاد 404، لكن PM تحقق من Git CLI المحلي. فحص RAKEEZ Ops عبر CLI المحلي أعاد remote main `f712e01d1540660559aa574dc975fd8cc0235ef2`.
- ظهر عيب تحضير محلي قبل الدفع: clone أول استند إلى `origin/main` المحلي غير الصحيح وأظهر diff Product واسعًا؛ لم يُدفع شيء. أُنشئ worktree جديد مباشرة من SHA البعيد المؤكد وأعيدت مواءمة docs على ملفات main الحالية، مع حفظ الفرع الأول كدليل.
- baseline/candidate: remote main `f712e01d1540660559aa574dc975fd8cc0235ef2` → `ed75e941b6ffef397af455d29ddf90136bb0100c` عبر فرع معزول `codex/workflow-v3-docs-0466-corrected`. GitHub أعلن نقل المستودع إلى `https://github.com/RakeezX/RakeezX.git`، وتأكد SHA الجديد في الموقع الجديد.
- القرار: استخدم Git CLI من worktree نظيف معزول. أعد فحص diff والـremote قبل push؛ إذا فشل push بسبب auth/credential، أوقف docs lane YELLOW فقط دون تعديل root أو credentials، واستمر في المسارات المستقلة. لا يتطلب التشغيل مراسلة محادثات العمال القديمة.
- المكتمل: push سريع غير قسري إلى main، ومزامنة الملفات الكانونية العشرة بعد مطابقة بايتات الملفات المحلية القديمة مع f712؛ hash كل ملف بعد النسخ طابق blob commit الجديد.
- المتبقي YELLOW: إثبات Cloudflare Pages skipped build للـSHA الجديد؛ GitHub statuses/check-runs/deployments خالية ولم تُنتج دليل مزود. لا تعتبر docs commit Product release. لا توقف N58/N53 المستقلين.
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

### N58 — فشل CORE_V2 عند فتح ملف متصفح دائم — YELLOW / ينتظر PM
- الحالة: مرشح N58 لم يعتمد؛ أوقف المسار الثقيل وحرر نافذة Heavy.
- baseline/candidate: baseline 430bc2e6d563924aeeeff37837f1732b2cde93eb نجح initial-restore.e2e.mjs ‏5/5 في تشغيل واحد؛ candidate 9edc41788ecb4952c798131ffd8aed634e45ed08 مع test-only e97b567 فشل 1/5 في تشغيل واحد، والباقي 4/5 ناجح.
- الدليل: tests/initial-restore.e2e.mjs blob 67eef655a23ca9d98ed4a9a3e2909f3415b9f3ec مطابق. في المرشح ظهر UnknownError: Internal error عند فتح قاعدة البيانات قبل ظهور .topbar__title في حالة CORE_V2 receipt survives a disposable browser-profile restart، line 130. سجلات وصورة وtrace محفوظة تحت artifacts/n58-calendar-client-0457-3/verification/2026-10-03T02-48-17-883Z-2532c19f-f583-48f0-bf79-1d5020c254c8/initial-restore.e2e.mjs في worktree المرشح؛ تشغيل baseline محفوظ في worktree n58-ia-corrected-baseline-0466.
- ما لم يحدث: لا retry للمرشح، لا تعديل Product، لا Stage E ولا Preview/Production. المواصفات اللاحقة لم تنفذ.
- قرار مطلوب من PM: تصنيف فشل قاعدة البيانات الخاص بالمرشح وخطة فحص/تصحيح محدودة قبل استئناف N58؛ لا يمد قرار Home السابق إذنا تلقائيا لتعديل اختبار الاستعادة أو Product. لا يتطلب قرار PO حاليا ما لم يفرض التحقيق تغييرا في السلوك أو النطاق أو البيانات.

### N53 MB01 — تعارض مصدر التفويض قبل Product promotion — YELLOW
- فرع النقل الانتقائي 6fe3de7 وPreview الفني نجحا؛ لم يتحرك main Product. Work Freeze 0462.1 و0464 يقول PO WORK-LOCAL APPROVED وREADY FOR SELECTIVE PRODUCT TRANSPORT، بينما canonical WORK_APPROVAL_LEDGER وWA-N53-N54-0434 يقولان N53 NOT_AUTHORIZED دون Product ticket مستقل.
- المطلوب من PM: تحديد التذكرة/القرار الأحدث الذي يمنح سلطة Product لـ MB01، أو تأكيد عدم وجوده وإحالة طلب التفويض المحدد إلى PO. حتى تتضح السلطة يتوقف دفع CSS إلى main؛ يستمر العمل المستقل.
- الدليل: branch codex/n53-mb01-ops-0466 ‏6fe3de7850ada6169a678b02d1907dc9f89ef457؛ Cloudflare Preview check 111114370226 ناجح، 6/6 CSS smoke، Work 12/12 golden و24/24 browser، Product build و6/6 browser مجاور.

### تحديث دليل N58 وN53 — 2026-10-03 03:22 UTC
- N58: الملف 43 من 111 ملف مواصفة، 42 قبله اكتملت، 68 بعده لم تبدأ؛ الملف الفاشل نفسه 4/5 حالات اختبار. اختبار initial-restore blob مطابق؛ runner المرشح مختلف عن baseline في scripts/e2e-runner.mjs وplaywright.config.js وscripts/playwright-output-safety.mjs. مسار persistent browser profile المرشح 238 حرفًا مقابل baseline 186؛ Default/Cookies يصل 254. احتمال Windows path/IndexedDB tooling غير مثبت. src/lib/db.js تغيّر أيضًا، لكن diff يخص writeAll لا openDB. يلزم PM اختيار مقارنة مكافئة/فحص واحد محدد دون إعادة الناجح أو نسبة الفشل إلى Product. الدليل المفصل في handoff/N58_INITIAL_RESTORE_REPRO.md في workspace RAKEEZ Ops.
- N53: التباس تفويض Product قد يكون سجل WA-N53-N54-0434 أقدم من Freeze MB01 0462.1/0464؛ PM يحسم مرجع السلطة أولًا. لا طلب PO مستقل الآن، ولا ترقية main/Production. إن أكد PM غياب تفويض Product، ينقل سؤالا محددا إلى PO.

## PM WATCH DECISION — 2026-10-03 06:33
### N58 CORE_V2 — GREEN diagnostic authorized
- لا يوجد دليل كافٍ على Product regression: ملف initial-restore مطابق بين baseline/candidate، بينما harness ومسار persistent profile مختلفان؛ المسار في candidate يقترب من حدود Windows/Chromium.
- diff الحالي في src/lib/db.js يغيّر writeAll ولا يغيّر openDB؛ لا يبرر Product change قبل عزل harness.
- نفّذ paired tooling-equivalence diagnostic واحدًا فقط، بلا retry وبلا Product change:
  - baseline وcandidate في مسارين معزولين متساويي الطول قدر الإمكان تحت C:\Users\Abody\.codex\worktrees.
  - نفس test-only harness/runner/output-safety bytes، ونفس Browser/Node/env، ونفس output-root shape القصير والمحمي.
  - شغّل فقط حالة CORE_V2 receipt survives a disposable browser-profile restart مرة على كل طرف.
- PASS/PASS: صنّف السابقة TOOLING/PATH DEBT، وثبّت تصحيح harness test-only ضيقًا يحافظ على output-safety/evidence، ثم استأنف من أول spec غير منفذ دون إعادة PASS السابق.
- FAIL/FAIL بنفس UnknownError: يبقى tooling/test debt؛ source audit ثم تصحيح test-only واحد وpaired proof.
- baseline PASS / candidate FAIL تحت بيئة متكافئة: أعد N58 إلى YELLOW؛ read-only trace فقط، ولا تعدّل src/schema/Supabase.
- لا Stage E/Preview/Production قبل عودة lane إلى GREEN وإكمال البقية. لا يحتاج PO الآن.
### N53 MB01 — PM decision on authority
- WA-N53-N54-0434 records the pre-V3 general N53 state as NOT_AUTHORIZED.
- Workflow V3 is newer standing PO authority for exact accepted low/medium-risk Work transport after technical Preview parity; for PM purposes it resolves the MB01 hold only.
- This applies only to the frozen MB01 two-line CSS presentation change in .share-preview-box. It does not authorize MB02 or broader N53 work.
- Rebuild the MB01 candidate from current remote main and verify the touched CSS base is unchanged from the Freeze baseline. Apply the exact patch only; any touched-source drift returns the lane to YELLOW.
- Run the normal V3 exact-tree release checklist and focused gates on the rebuilt candidate. If parity remains exact with zero GAP/runtime conflict, continue under the standing V3 path.
- Final user-visible closure still requires PO Production verification. No new PO decision is needed before MB01 unless drift, scope expansion, or a higher-risk condition appears.

### Workflow V3 docs provider evidence
- remote main is now 13de11b6e467ccaf275276c348ed275b7df183ed after docs-only checkpoints.
- Cloudflare skipped-build proof remains unverified. A read-only Wrangler check could not authenticate in the non-interactive environment. This remains NON-BLOCKING and is not a Product release.


## PM WATCH RECHECK — 2026-10-03 07:19
- لا توجد حالة YELLOW جديدة تتطلب قرار PM إضافيًا.
- N58: استمر فقط بالتشخيص الزوجي المكافئ المحدد في قرار 06:33.
- N53 MB01: استمر فقط بإعادة البناء من current remote main وفق سلطة V3 المحددة في قرار 06:33؛ أي drift جديد يعيد YELLOW.
- لا يحتاج PO الآن.

### N58 — local-sync-pwa عنوان Schedule في offline route — YELLOW جديد
- بعد فحص الاستعادة المزدوج وتصحيح test-only، استؤنفت الملفات غير المنفذة. interaction-focus وlegacy-claim-visible-action اجتازا؛ local-sync-pwa.e2e.mjs سجل 3 PASS/1 FAIL في حالة one online load precaches every lazy route and supports offline reload and reopen عند line 462: المتوقع أوقات الحصص، المعروض الجدول عند مسار #/schedule/times.
- blob الاختبار 2387a41a9e9b772507ed4f90beb55a5acdb805ef مطابق baseline/candidate؛ app.js وsrc/views/schedule.js وsrc/styles/schedule-work-integration.css لم تتغير بينهما. لا يوجد تشغيل baseline مكافئ لهذه الحالة بعد؛ لا تصنيف Product regression أو test debt حتى قرار PM.
- دليل المرشح محفوظ في worktree n58-otp-fix: artifacts/n58-calendar-client-0457-3/verification/2026-10-03T04-31-07-960Z-6388f443-f585-4328-9f93-7ca5d93390cc/local-sync-pwa.e2e.mjs؛ screenshot وtrace وlog. 65 ملف spec لاحق وStage E لم ينفذ؛ Heavy محررة.
- المطلوب من PM: اختيار تدقيق baseline مكافئ وحدود test-only correction إن أثبت فشلًا مشتركًا/دين اختبار؛ أو إبقاء N58 YELLOW إن كان مرشحًا خاصًا. لا تعديل src أو Preview أو Production في هذا المسار. N53 MB01 GREEN مستقل وفق قرار PM 06:33.

### N53 MB01 — حسم PM ونقل V3 مكتمل تقنيًا
- طبق RAKEEZ Ops قرار PM 06:33 على رقعة MB01 فقط؛ أعيد بناء المرشح من main الحالي مع تطابق CSS الأساسي وFreeze، ثم نجحت بوابات الشجرة وPreview. انتقل CSS المحدد إلى main ‏f7199ec fast-forward، وأكد Cloudflare check والـ CSS المنشور وsmoke المقيد محتوى Production. التذكرة الآن PO PRODUCTION REVIEW PENDING وليست CLOSED؛ لا سلطة لـ MB02 أو باقي N53. N58 local-sync-pwa يبقى YELLOW منفصلًا.

## PM WATCH DECISION — 2026-10-03 08:15 +03
### N58 local-sync-pwa — BASELINE TEST DEBT CONFIRMED / GREEN TO RESUME
- PM شغّل `local-sync-pwa.e2e.mjs` مرة واحدة فقط على exact baseline `430bc2e6d563924aeeeff37837f1732b2cde93eb` من worktree `D:\Abdullah Projects\RakeezX\worktrees\n58-performance-baseline-0457-3`.
- النتيجة baseline: 3 PASS / 1 FAIL، والفشل نفسه تمامًا في الحالة `one online load precaches every lazy route and supports offline reload and reopen` عند line 462: التوقع `أوقات الحصص` بينما `.topbar__title` يعرض `الجدول` على `#/schedule/times`.
- source audit: `tests/local-sync-pwa.e2e.mjs` و`src/app.js` و`src/views/schedule.js` و`src/styles/schedule-work-integration.css` متطابقة بين baseline والمرشح. كذلك `src/views/times.js` في baseline يعرّف صراحة `title: () => 'الجدول'`، لذلك التوقع القديم ليس عقد Product الحالي.
- التصنيف: BASELINE / TEST DEBT، وليس N58 Product regression.
- القرار: مسموح تصحيح test-only ضيق في `OFFLINE_ROUTE_MATRIX` لتوقع `الجدول` لمسار `#/schedule/times` فقط، مع إبقاء فحوص URL/offline/toast وبقية مصفوفة المسارات كما هي. ممنوع أي تعديل `src/` أو behavior أو scope.
- بعد التصحيح: شغّل الملف المصحح مرة واحدة على baseline ومرة واحدة على candidate، بلا retry. PASS/PASS => استأنف فقط 65 spec غير المنفذة ثم Stage E دون إعادة PASS السابقة. baseline PASS/candidate FAIL => YELLOW جديد وتحليل read-only فقط.
- ملاحظة تشغيلية: محاولة PM الأولى مررت مسار `tests/...` إلى runner فأنهى `No tests found` قبل تشغيل أي test؛ القياس المعتمد هو التشغيل الصحيح اللاحق باسم الملف فقط.
- لا يحتاج PO لهذه الحالة.

### N58 — نتيجة الزوج المصحح local-sync-pwa: baseline PASS / candidate FAIL — YELLOW
- baseline exact 430bc2e في worktree معزول نجح 4/4 بعد تصحيح test-only المأذون؛ سجل التشغيل handoff/n58-local-sync-baseline-corrected.log. candidate 9edc4178 مع test-only ‏13397b3 نجح 3/4 وفشل عند line 473 في الاختبار offline reload/reopen: بعد reload على #/settings لم يظهر .topbar__title، ولقطة الفشل تعرض boot فقط. نفس test blob المصحح 62943ae85887f9e6b7aea7bb58137c73dd30431f للطرفين.
- الدليل candidate في artifacts/n58-calendar-client-0457-3/verification/2026-10-03T05-26-56-381Z-16a7b58a-6b10-4a9a-8ea0-7564b91d9668/local-sync-pwa.e2e.mjs داخل worktree n58-otp-fix: before/result/log/trace/screenshot. لا إعادة محاولة، لا تعديل Product، لا Stage E، و65 ملف spec بعده لم يبدأ.
- المطلوب من PM: تدقيق trace/source قراءة فقط وتحديد هل boot المعلق بعد offline reload سببه مرشح Product أم فرق runner/PWA tooling، وحدود أي فحص إضافي. يبقى N58 YELLOW وفق شرط القرار السابق؛ N53/PO review مستقل.

## PM WATCH DECISION — 2026-10-03 09:34 +03
### N58 local-sync-pwa — TOOLING/HARNESS DEBT CONFIRMED / GREEN TO RESUME
- نفذ PM تشخيصًا زوجيًا جديدًا دون تعديل Product: نفس تصحيح test-only لمسار #/schedule/times ثم تشغيل local-sync-pwa.e2e.mjs على baseline 430bc2e6d563924aeeeff37837f1732b2cde93eb وعلى candidate 9edc41788ecb4952c798131ffd8aed634e45ed08.
- baseline مع runner/config الأصليين: 4/4 PASS في تشغيل واحد، 145.54 ثانية.
- candidate شُغّل مرة واحدة بعد توحيد scripts/e2e-runner.mjs وplaywright.config.js مؤقتًا إلى bytes خط الأساس، مع بقاء Product candidate نفسه: 4/4 PASS في تشغيل واحد، 150.28 ثانية.
- بعد التشخيص أُعيدت ملفات local-sync-pwa.e2e.mjs وrunner/config إلى حالتها الأصلية؛ status لتلك الملفات نظيف. لم يُعدّل src أو sw.js أو Schema/Supabase ولم يحدث Preview/Production.
- التصنيف: الفشل السابق candidate-only عند offline reload ليس دليل Product regression؛ يختفي عند مساواة harness/config، لذلك هو TOOLING/HARNESS DEBT.
- القرار: N58 يعود GREEN للتحقق المحلي. اعتبر local-sync-pwa Product-behavior PASS تحت harness المكافئ ولا تعِد تشغيله.
- استأنف فقط 65 spec غير المنفذة ثم Stage E باستخدام harness مكافئ قصير ومحمي يمنع path/output artifacts من تغيير سلوك Chromium. لا تعِد أي PASS سابق.
- إصلاح runner/output-safety يبقى test/tooling-only منفصلًا مع حفظ evidence retention وoutput safety ودون لمس Product runtime.
- إذا ظهر baseline PASS / candidate FAIL جديد تحت harness مكافئ، أوقف N58 YELLOW عند ذلك الملف واحفظ الدليل بلا retry.
- لا يحتاج PO لهذه الحالة.

### N58 — microbatch-0327 بعد استئناف 65 ملفًا — YELLOW / قرار PM مطلوب
- القرار السابق 2026-10-03 09:34 +03 سمح باستكمال الملفات بعد إثبات 4/4 لـ local-sync-pwa بإعداد baseline المتكافئ. في worktree RAKEEZ Ops المعزول، commit الاختبارات/الأداة فقط `9f33253a7d3d6c2523de24fc78b0f2f048596847` أعاد Vite إلى عملية منفصلة مع إبقاء مخرجات Playwright محروسة ومحفوظة. لا تغيير في `src/` ولا live Supabase.
- أُثبتت النافذة الثقيلة FREE والمنفذ 5173 خاليًا قبل التشغيل. `manual.e2e.mjs` نجح 3/3. `microbatch-0327.e2e.mjs` توقف بنتيجة 4 PASS / 3 FAIL: مشاهد N06 friday وsaturday وholiday ترى العنوان «إجازة اليوم الوطني»؛ المتوقع في الأولين «لا توجد لديك حصص اليوم» وفي الثالث «اليوم الوطني». الفشل عند السطر 53، دون إعادة محاولة.
- دليل التشغيل: `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3\n58-otp-fix\artifacts\n58-calendar-client-0457-3\verification\2026-10-03T07-22-25-213Z-fd1b4aed-f3ce-4985-adca-a6ba5d9326ae\`، وفيه before/result/log/screenshots/traces محفوظة. `tests/microbatch-0327.e2e.mjs` يختلف بين baseline وcandidate في مداخل Demo فقط، والتوقعات نفسها. `src/views/home.js` و`src/app.js` متطابقان؛ `src/lib/db.js` مختلف، ولا يثبت ذلك وحده سبب الفشل.
- التقدم: 46 ملف spec مكتمل (45 سابقًا + manual)، microbatch-0327 جزئي 4/7، و63 ملفًا لم يبدأ؛ Stage E لم يُشغّل. النافذة الثقيلة أُطلقت والمنفذ 5173 خالٍ. لا Preview/Production ولا تعديل Product.
- مطلوب PM: حدد فحص baseline/candidate متكافئًا أو مراجعة مصدر/trace محدودة لتصنيف الفرق. لا تُستأنف الملفات الـ63 أو Stage E ولا يُعدَّل `src/` قبل القرار. يستمر مسار N53 MB01 مستقلًا بانتظار مراجعة PO على Production.
## PM WATCH DECISION — 2026-10-03 11:27 +03
### N58 microbatch-0327 — EXPECTED N58 CONTRACT DELTA / TEST-ONLY ADAPTATION / GREEN TO RESUME
- تدقيق القراءة فقط يثبت أن Home/App لم يتغيرا بين baseline والمرشح، بينما N58 يضيف الإسقاط الفعّال للتقويم الرسمي ويجعل preset المختار مصدر الحقيقة للأيام الرسمية.
- D-076 البند 3 معتمد صراحة: الـpreset المختار يتحكم في الإجازات الرسمية وأيام التدريس/عدم التدريس. والكتالوج الحالي يعرّف إجازة اليوم الوطني من 2026-09-23 إلى 2026-09-26 بعنوان «إجازة اليوم الوطني».
- لذلك ظهور «إجازة اليوم الوطني» في 23 و25 و26 سبتمبر على المرشح هو السلوك المستهدف لـN58، وليس regression. baseline لا يملك الإسقاط نفسه، لذا لا يُطلب تطابق semantic لهذه assertions الثلاثة.
- القرار: تصحيح test-only ضيق في tests/microbatch-0327.e2e.mjs فقط: غيّر friday إلى 2026-10-02 وsaturday إلى 2026-10-03، وأبقِ holiday على 2026-09-23 مع العنوان المتوقع «إجازة اليوم الوطني».
- لا تستخدم حقن calendarDays الخام لصناعة holiday في هذا المشهد؛ دع selected official preset يقدّم اليوم الرسمي. حافظ على بقية فحوص النص/الرابط/RTL/geometry كما هي.
- شغّل microbatch-0327.e2e.mjs مرة واحدة فقط على candidate تحت نفس harness القصير والمحمي. إذا 7/7 PASS: استأنف فقط 63 ملف spec غير المنفذة ثم Stage E، بلا إعادة PASS السابق. إذا ظهر فشل جديد: YELLOW عند أول فشل، evidence بلا retry.
- ممنوع أي تغيير Product/runtime بسبب هذا الاختبار. لا يحتاج PO.

### N58 — تكييف microbatch-0327 وفق قرار 11:27 +03 — YELLOW / قرار PM مطلوب
- نُفذ التكييف test-only في `tests/microbatch-0327.e2e.mjs` بثلاثة أسطر فقط: الجمعة `2026-10-02`، السبت `2026-10-03`، وعنوان holiday في `2026-09-23` صار «إجازة اليوم الوطني». لم يتغير `src/`، commit المعزول `cae824454fed179073fcf1ba71371292ac79c243`.
- ثبتت النافذة الثقيلة FREE والمنفذ 5173 خاليًا، ثم شُغّل الملف مرة واحدة بنفس runner المحروس. النتيجة 5 PASS / 2 FAIL: مشهد holiday نجح، لكن الجمعة والسبت يعرضان العنوان «إجازة» بينما توقع الاختبار «لا توجد لديك حصص اليوم». لم تُعد المحاولة.
- التدقيق المصدرِي للقراءة فقط: `src/lib/calendar-presets.js` لا يدرج 02 أو 03 أكتوبر ضمن إجازة اليوم الوطني (تنتهي 26 سبتمبر)، لكن `src/lib/calendar-runtime.js:resolveCalendarDate` يصنف نهاية الأسبوع الافتراضية `holiday` مع label فارغ؛ و`src/views/home.js:todayEmptyCopy` يعرض بطاقة `calendarDay` غير الدراسي قبل فرع نهاية الأسبوع. هذا يفسر عنوان «إجازة» في candidate ولا يقرر وحده إن كان العرض هو العقد المطلوب.
- دليل التشغيل: `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3\n58-otp-fix\artifacts\n58-calendar-client-0457-3\verification\2026-10-03T09-22-24-136Z-5d12177a-7c35-4174-b8dc-9ce1f9e62eea\` مع before/result/log/screenshots/traces. لم تبدأ ملفات الـ63 التالية أو Stage E، ولا Preview/Production أو live Supabase.
- محاسبة manifest المصححة: 111 ملفًا = 43 ملفًا في prefix حتى initial-restore (بما فيه نجاح CORE_V2 المركب الموثق) + interaction-focus وlegacy-claim-visible-action وlocal-sync-pwa وmanual = 47 ملفًا مكتملًا + microbatch-0327 جزئي + 63 لم تبدأ. لا ملف quarantined/deferred؛ كان العدد 46 في التقرير السابق خطأ حسابيًا.
- مطلوب PM: حسم دلالة نهاية الأسبوع في N58: هل يعدّل توقع الاختبار إلى «إجازة» وفق resolver، أم يوجد خلل Product يستلزم مسارًا آخر؟ لا تكييف آخر ولا retry ولا استمرار suffix قبل قرار محدد. N53 MB01 مستقل ويظل PO PRODUCTION REVIEW PENDING.
## PM WATCH DECISION — 2026-10-03 13:18 +03
### N58 microbatch-0327 — PRESERVE N06 WEEKEND UX / NARROW PRODUCT MICRO-FIX AUTHORIZED / GREEN TO RESUME
- D-033/N06 هو عقد Product مغلق ومتحقق في Production: الجمعة/السبت يستخدمان رسالة عطلة نهاية الأسبوع الودية، بينما الإجازة الرسمية المعروفة تعرض سياقها/اسمها.
- D-076/N58 يضيف حقيقة التقويم الرسمية وأهلية اليوم، لكنه لا يلغي D-033 ولا يصرح بتحويل weekend الافتراضي إلى واجهة «إجازة».
- سبب الفشل الحالي واضح: resolveCalendarDate يصنف weekend الافتراضي kind=holiday/source=default، وtodayEmptyCopy يستهلك non-teaching قبل فرع weekday؛ لذلك يظهر عنوان «إجازة» بدل رسالة نهاية الأسبوع.
- القرار: لا تغيّر الاختبار ليتوقع «إجازة». أصلح العرض فقط في N58 candidate بحيث تبقى official/custom holiday/suspension ذات أولوية وتعرض سياقها، بينما default weekend يرجع إلى N06 rest-day copy. لا تغير eligibility أو Calendar persistence أو Sync/schema.
- هذا إصلاح حفظ-عقد قائم، وليس UX جديدًا؛ لا يحتاج Work أو PO جديدًا.
- شغّل microbatch-0327 مرة واحدة على candidate تحت harness المحمي، ومعه اختبار/فحص resolver المستهدف المناسب. إذا 7/7 PASS ولا regression: أكمل فقط 63 spec غير المنفذة ثم Stage E. أي فشل جديد = YELLOW بلا retry.
- التغيير المسموح: أضيق تعديل Product presentation ممكن، ويفضل في todayEmptyCopy/أولوية العرض؛ أي توسع إلى data/runtime semantics يعيد YELLOW.
- لا Preview/Production لـN58؛ فهو HIGH-RISK ويبقى local-only حتى اكتمال الشهادة وتفويض PO الحي.

### تشغيل المسارات المستقلة — تصحيح استغلال السعة
- N53 MB01 مغلق. ابدأ N53 MB02 في Work الآن إذا كان scope MB02 موثقًا صراحة في حزمة/عقد N53؛ ابنه من current Product baseline ولا تنفذ Product transport قبل PO Work approval.
- إذا MB02 غير معرف بدقة في المصادر، سجّل YELLOW للـPM بدل اختراع scope، ثم شغّل read-only audit مستقل منخفض المخاطر من backlog.
- لا تترك Work idle لمجرد أن N58 YELLOW؛ Heavy Window ينسق الاختبارات فقط، ولا يمنع التحضير/التصميم الخفيف المستقل.

### N58 — microbatch-0330 / N29 selector drift — YELLOW / قرار PM مطلوب
- وفق قرار PM 13:18 +03، عُدّل عرض Home في مرشح N58 بسطر واحد فقط (`src/views/home.js`، commit `011eccf03f3a4ef0a8a68d6ac834ff8c8dfb576f`) ليحافظ على نص N06 للـdefault weekend دون تغيير resolver أو eligibility أو persistence/Sync/schema. `microbatch-0327.e2e.mjs` نجح 7/7 مرة واحدة، ودليل التشغيل في `artifacts/n58-calendar-client-0457-3/verification/2026-10-03T11-22-16-790Z-4e0887bb-d063-46bd-9496-38511639a791/` داخل worktree RAKEEZ Ops.
- بعد التأكد من Heavy FREE وخلو المنفذ 5173، بدأ suffix غير المنفذ. أول ملف `microbatch-0330.e2e.mjs` أوقف المسار بنتيجة 5 PASS / 1 FAIL: اختبار N29 عند السطر 70 لا يجد `.welcome-option__title` داخل `[data-workspace-login]`. لا retry ولا تشغيل الملفات التالية.
- تدقيق قراءة فقط: `src/app.js` و`src/styles/app.css` متطابقان blob بين baseline `430bc2e6` والمرشح Product `9edc4178`. `src/app.js` يحتوي زر `[data-workspace-login]` بعنصرَي `<strong>/<span>` داخل واجهة N56، بينما الاختبار يطلب `.welcome-option__title/.welcome-option__detail` من الشكل السابق. test blob يختلف بين baseline/candidate فقط في تحقق مؤشر Demo اللاحق؛ لا يكفي هذا وحده لإثبات baseline PASS أو Product regression.
- الأدلة المحفوظة: `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3\n58-otp-fix\artifacts\n58-calendar-client-0457-3\verification\2026-10-03T11-23-05-417Z-47c68b83-255c-4cd9-8f3a-f8cda19ff61b\` وفيه before/result/log/screenshot/trace. 48 ملف spec مكتمل، microbatch-0330 جزئي، 62 لم تبدأ = 111؛ Stage E لم يبدأ. لا Preview/Production أو live Supabase لـN58.
- مطلوب PM: حدد فحص baseline متكافئًا أو تصحيح test-only محدودًا لـN29 وفق واجهة N56 الحالية، مع الحفاظ على تغطية التسلسل/OTP/Demo. لا تعديل اختبار أو Product إضافي قبل قرار محدد.

### N53 MB02 — نطاق Work غير محدد في المصادر المفحوصة — YELLOW / PM
- بعد إغلاق MB01 باعتماد PO، فُحصت قراءةً فقط حزم `RakeezX-Work-N53-CurrentProduct-0462` و`RakeezX-Work-N53-MB01-CurrentRefresh-0464` و`RakeezX-Work-Active` مع لوحة التنفيذ والعقد. لم يظهر تعريف صريح لحدود MB02 أو freeze/manifest له. إشارات “Micro-Batch 02 0330/0331” تخص N20/N21/N29 القديمة، وليست N53 MB02.
- مطلوب PM: تحديد مصدر scope MB02 المعتمد قبل تكليف Work أو بناء تصميم؛ لا يُخترع نطاق ولا يبدأ Product transport. N53 MB01 يبقى CLOSED. بالتوازي دُقّق N08 قراءة فقط: Product Ledger يضعه WORK APPROVED / IMPLEMENTATION NOT AUTHORIZED مع بوابة رخصة وخط PWA offline؛ لم يُغيّر خط أو أصل.
## PM WATCH DECISION — 2026-10-03 15:44 +03
### N58 microbatch-0330 / N29 — BASELINE TEST DEBT CONFIRMED / GREEN TO RESUME
- static baseline proof is sufficient: exact baseline `430bc2e6d563924aeeeff37837f1732b2cde93eb` has the same obsolete N29 assertions for `.welcome-option__title/.welcome-option__detail`, while the same baseline Product already renders N37/N56 landing actions as `[data-workspace-login] > strong/span` and `[data-workspace-demo] > strong/span`.
- canonical release history is newer and authoritative: N37 and N56 are CLOSED / PO Production verified. N56 preserves the unified OTP path on the N37 landing; therefore the old N29 selector/typography assertions must not resurrect superseded presentation.
- classification: BASELINE / TEST DEBT, not N58 Product regression.
- allowed correction: test-only in `tests/microbatch-0330.e2e.mjs`. Bind the title/detail checks to the shipped `strong/span` DOM, use current shipped copy, preserve `n37-primary` prominence and all functional assertions for unified Email→OTP, Demo entry/isolation, RTL/overflow and cloud safety. Do not restore obsolete N29 font-size/class expectations and do not change Product code for this failure.
- run `microbatch-0330.e2e.mjs` once on the N58 candidate under the protected equivalent harness. If 6/6 PASS, continue only the remaining 62 spec files then Stage E. First new failure => YELLOW with evidence, no retry.
- no Preview/Production/live Supabase for N58. HIGH-RISK live mutation still requires explicit PO authorization.

### N53 MB02 — WORK SCOPE DEFINED / GREEN TO START WORK REVIEW
- PM reviewed the 0462 current inventory. MB02 is now a bounded Work-only review of two list-heavy, medium-risk, Demo-equivalent N53 surfaces that were explicitly marked later N53 and are outside the excluded Auth/Sync/score/attendance/restore/Calendar/Schedule/keyboard scopes:
  1. `src/views/class-rules.js:443` — «مواثيق جاهزة» preset list.
  2. `src/views/teaching-hub.js:221` — «تبديل الفصل» teaching-context list.
- Goal: review viewport fit and scroll ownership only. Preserve all handlers, selection/context behavior and data semantics. Prefer the existing sheet-body scroll model; no shared `openSheet/confirmSheet` primitive change unless a separately evidenced GAP requires PM review.
- Work should test current Product baseline at desktop normal/short height plus 390/320 mobile, light/dark. If the current behavior is already coherent, return NO CHANGE evidence rather than inventing a redesign.
- any actual visual change is a new Work candidate and must go to PO Work review before Freeze/transport. No Product implementation authority is granted by this scope decision.

### N58 — microbatch-0344 / N19 context count — YELLOW / قرار PM مطلوب
- نفذ قرار PM 15:44 +03 كتعديل test-only لـN29 في `tests/microbatch-0330.e2e.mjs`، commit `b363943f058bb60775f3dc5de987a2e51be0dd47`. احتُفظ بتسلسل Email→OTP ودخول Demo/العزل وRTL/overflow وسلامة cloud. الملف نجح 6/6 مرة واحدة، ثم بدأ suffix 62 ملفًا تحت نافذة Heavy خالية.
- `microbatch-0335.e2e.mjs` نجح 3/3. توقف `microbatch-0344.e2e.mjs` بنتيجة 2 PASS / 1 FAIL عند اختبار N19 في السطر 38: أول طالب باسم «محمد» لديه 3 عناصر `[data-student-result]` بدل 2 المتوقعين، بعد إعداد عدة سياقات. لم تُعد المحاولة ولم يبدأ suffix التالي.
- مصدر الاختبار يختلف baseline/candidate فقط في تحقق Demo عند الإقلاع؛ `src/lib/student-search-ui.js` متطابق blob، لكن `src/store.js` و`src/lib/db.js` تغيرا في مرشح N58. لا يثبت هذا وحده دين اختبار أو regression. الدليل المحفوظ في `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\rakeezx-v3\n58-otp-fix\artifacts\n58-calendar-client-0457-3\verification\2026-10-03T13-02-59-072Z-8365a7a7-643d-4bc7-bf28-25ed4df529b5\` وفيه before/result/log/screenshot/trace.
- التقدم: 50 ملف spec مكتمل + microbatch-0344 جزئي + 60 لم تبدأ = 111؛ Stage E لم يبدأ. الإصلاح المحلي الوحيد في Product هو سطر عرض Home `011eccf` لحفظ عقد N06؛ لا Preview/Production/live Supabase لـN58.
- مطلوب PM: تحديد تشخيص baseline/candidate متكافئ أو تدقيق مصدر محدود لتفسير عنصر السياق الثالث قبل أي test/Product edit أو استئناف. N58 يبقى YELLOW دون retry.

### N53 MB02 — نتيجة Work-only review: NO CHANGE لملاءمة الشاشة والتمرير
- فُتح السطحان المحددان من PM من عناصرهما الفعلية على Product baseline `861006d5bfb30ed30125ff10a81110c0b2d89f7c` في Demo بثمانية فصول: «مواثيق جاهزة» و«تبديل الفصل». فُحصا عند 1440×900 و1440×600 و390×844 و320×700 في light/dark: 16/16 حالات آمنة بعد انتهاء حركة النافذة، دون تمرير أفقي أو خروج الأزرار الختامية، مع تمرير داخل body عند الحاجة. جُرب اختيار ميثاق وتمكين الحفظ والتنقل إلى فصل آخر؛ لم تُحفظ بيانات.
- الدليل: `C:\Users\Abody\Documents\Codex\2026-10-03\task-2\handoff\N53_MB02_WORK_REVIEW.md` و`handoff\mb02-work-review-2026-10-03-stable\result.json` مع 16 لقطة. لا مرشح بصري جديد ولا PO Work review/Freeze/transport لـMB02 الآن.
- ملاحظة وصول منفصلة خارج نطاق الملاءمة: قيمة `aria-current` للرابط الحالي في قائمة الفصول هي `"page"` بعلامتي اقتباس حرفيتين رغم ظهور `is-current` والتنقل السليم. لم يُصلح Product؛ يفرزها PM كتذكرة وصول مستقلة إن لزم.