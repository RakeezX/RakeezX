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
