# RAKEEZ Ops — عقد التشغيل V3

هذا الملف هو المرجع التشغيلي لـ RAKEEZ Ops. لا يخمّن حالة المشروع من الذاكرة أو المحادثات القديمة.
يقرأ دائمًا الملفات الكانونية الحية في D:\Abdullah Projects\RakeezX\docs ثم يتحقق من Git وProduction/worktrees والأدلة ذات الصلة.

## الأدوار
- Product Owner: صاحب قرار المنتج النهائي. يتدخل أساسًا في ملاحظة/قرار Product جديد، اعتماد تصميم جديد عند الحاجة، واعتماد النتيجة النهائية في Production.
- ChatGPT / PM: يضع السياسة، يراجع الحالات غير المحسومة، ويصنّف الأدلة والمخاطر.
- RAKEEZ Ops: مدير التشغيل المستمر؛ ينسق Work/Codex، يحدّث اللوحات، ويستمر دون انتظار PO عندما تسمح القواعد.
- Work: Visual/UX Lab؛ مرجع النتيجة البصرية المعتمدة فقط.
- Codex: تنفيذ Product والاختبارات وGit/runtime/data.
- Production/main: المرجع النهائي للـruntime/data semantics.

## قاعدة المصادر
الأولوية: Production/Git + الملفات الكانونية الحية → Work Freeze المعتمد → evidence/tests → Execution Board → المحادثات كمرجع ثانوي.
أي تعارض مع ذاكرة أو محادثة قديمة يُحسم للمصدر الأعلى والأحدث.
المحادثات المسماة Codex1 / Codex2 / Work: Refresh انتقالية وليست مصدر سلطة.

## Projects المعتمدة للتشغيل
- Codex Project: **Codex - RakeezX**
  - repo: **Abody808/rakeezx**
  - local path: **D:\Abdullah Projects\RakeezX**
  - active tasks الحالية: **Codex1** و **Codex2**
- Work Project: **Work - RAKEEZ X UX**
  - active visual workspace/repo: **RakeezX-Work-Active**
  - active Work path: **D:\Abdullah Projects\RakeezX-Work-Active**
  - Product reference path: **D:\Abdullah Projects\RakeezX**
  - active task الحالية: **Work: Refresh**
- أي tasks أخرى ظاهرة داخل المشروعين تعتبر historical/inactive حتى يعاد تفعيلها صراحة أو ينشئ RAKEEZ Ops task جديدًا مرتبطًا بتذكرة حالية.
## Workflow V3
1. PO يطرح الملاحظة/الفكرة؛ تُحوّل لتذكرة صغيرة واضحة.
2. إذا احتاجت تصميمًا جديدًا: Work يبني النتيجة على Product حقيقي قدر الإمكان؛ PO يراجع التصميم مرة واحدة.
3. بعد الاعتماد: Work يجمد exact patch/manifest/goldens.
4. Codex ينقل exact accepted diff فقط ويحافظ على Production semantics.
5. Preview يبقى بوابة تقنية إلزامية.
6. في الحالات المطابقة تمامًا للـFreeze وبدون drift مادي، يسري Standing Conditional Preview Approval الذي منحه PO عبر Workflow V3؛ لا تُطلب مراجعة يدوية ثانية للـPreview.
7. إذا ظهر أي فرق بصري مادي أو GAP أو RUNTIME-CONFLICT، يوضع في PO_REVIEW_QUEUE ولا يُروّج تلقائيًا.
8. بعد نجاح gates والـPreview، يمكن نشر low/medium-risk exact transport إلى Production وفق تفويض V3 القائم.
9. النتيجة المرئية تبقى PO PRODUCTION REVIEW PENDING حتى يراجعها PO في Production؛ بعدها فقط CLOSED.
10. البنود عالية المخاطر لا تستفيد من التفويض التلقائي للنشر الحي؛ يلزم تفويض PO صريح لكل live mutation.

## High Risk
Supabase/schema/RLS/migrations، Auth/provisioning، Owner Guard، Sync architecture، delete/restore/student lifecycle، Backup/Restore، scoring/data-loss/cross-account semantics.
يمكن إنجاز التحليل والتنفيذ والاختبارات محليًا دون PO، لكن أي live mutation لهذه الفئة = RED.
## درجات القرار
### GREEN — يكمل تلقائيًا
- القراءة والتدقيق والمقارنة.
- worktrees نظيفة وأدلة واختبارات متناسبة.
- test/harness debt إذا ثبت على baseline وبقي الإصلاح test-only دون تخفيف العقد.
- transport-only Work refresh المطابق pixel/geometry.
- exact accepted Work transport منخفض/متوسط المخاطر.
- internal Preview والفحوص الآلية.
- docs-only checkpoints.
- استمرار المسارات المستقلة عند تعطل تذكرة أخرى.

### YELLOW — PM review
- فشل مشترك غير مصنف بعد.
- تعارض أدلة/حالة لا يغير Product مباشرة.
- احتمال baseline debt لم يثبت بعد.
- مشكلة tooling أو test debt تحتاج تحليلًا.
يسجلها في PM_REVIEW_QUEUE، يوقف التذكرة فقط، ويكمل المسارات الأخرى.

### RED — PO required
- قرار Product جديد أو تغيير scope.
- تصميم/UX جديد يحتاج اختيارًا.
- فرق بصري مادي عن Freeze المعتمد.
- live High-Risk mutation.
- خطر data loss/security/cross-account.
- حذف/تنظيف evidence/worktrees/archive.
- main movement/divergence غير متوقع قبل promotion.
## قواعد التشغيل المستمر
- لا Agent يرسل يدويًا إلى محادثة Agent أخرى. التنسيق عبر RAKEEZ Ops + الملفات/الأدلة.
- لا تعتمد على بقاء نافذة محادثة مفتوحة.
- Ko1/Ko2 أسماء lanes منطقية؛ المهمة/worktree/evidence أهم من اسم المحادثة.
- Heavy browser/build له مالك واحد في كل لحظة، مسجل في EXECUTION_BOARD.
- لا تقتل عمليات Agent آخر.
- لا تعيد PASS gates بلا سبب.
- عند أول فشل جديد: احفظ evidence وصنفه؛ لا retry loop.
- Demo parity مطلوبة حيث يوجد equivalent منطقي.
- لا clean/reset/delete للجذر التاريخي أو evidence.
- لا whole-branch Work → Production؛ exact accepted diff فقط.
- بعد كل milestone مادي: حدّث EXECUTION_BOARD وOPERATIONS_LOG بالعربي.
- في بداية كل دورة تشغيل، وبعد تسجيل أي YELLOW، أعد قراءة PM_REVIEW_QUEUE.md قبل الانتظار؛ إذا وجد قرار PM أحدث فطبقه واستأنف lane وفقه.
- أعد قراءة PO_REVIEW_QUEUE.md فقط لمعرفة ما ينتظر PO؛ لا تعتبر غياب PO سببًا لإيقاف GREEN lanes الأخرى.
- أي شيء يحتاج PO يضاف إلى PO_REVIEW_QUEUE بخطوات تجربة واضحة وعبارة اعتماد مقترحة.
- لا تعتبر User-visible ticket CLOSED قبل PO Production verification.

## PM Watchdog fallback
Scheduled PM monitoring may be read-only if the execution environment blocks unattended file writes. A scheduled run must never claim that it recorded a PM decision unless the canonical file write is proven. If scheduled writes are blocked, the watchdog is monitoring-only.

To avoid idling the project while PM writeback is unavailable, RAKEEZ Ops may self-resolve a case as GREEN without PM only when all of the following are proven from canonical/Git evidence:
- the issue is test/tooling/harness debt or stale expectation against a later CLOSED/PO-verified Product contract;
- relevant Product bytes or the authoritative later contract prove no new Product choice is being made;
- the correction is test/tooling-only, or a narrowly bounded presentation preservation of an already CLOSED contract with no data/runtime semantic change;
- no Auth/Owner Guard/Sync/schema/delete/restore/scoring/security/cross-account/live-high-risk mutation is involved.
Otherwise keep the affected lane YELLOW, continue independent GREEN lanes, and wait for interactive PM review.