# قائمة مراجعة Product Owner — PO REVIEW QUEUE

هذه الصفحة هي ما يحتاج عبدالله مراجعته بنفسه.
RAKEEZ Ops يكتب التعليمات بالعربي وباختصار: أين تذهب، ماذا تجرب، وما عبارة الاعتماد.

## حاليًا
لا يوجد بند يحتاج مراجعة Product Owner الآن.

## قالب أي بند جديد
### [Ticket] — جاهز لمراجعتك في [Work / Production]
- لماذا أراجع هذا؟:
- افتح:
- جرّب:
- المتوقع:
- ملاحظات فنية مهمة إن وجدت:
- إذا كل شيء صحيح قل:
  «أعتمد [Ticket] في [Work/Production]»
- إذا لاحظت مشكلة: اكتبها بطريقتك العادية؛ لا تحتاج وصف تقني.

## قواعد
- Preview العادي لا يظهر هنا إذا كان exact parity ومشمولًا بتفويض V3 الشرطي.
- تصميم Work جديد يظهر هنا مرة واحدة قبل Freeze.
- كل نتيجة User-visible في Production تظهر هنا قبل CLOSED.
- High-Risk live mutation يظهر هنا كتفويض واضح قبل التنفيذ الحي.

### N53 MB01 — تفويض تنفيذ Product المحدد — قبل Production
- القرار المطلوب إذا لم يجد PM تفويضا أحدث: هل تأذن بنقل رقعة MB01 المعتمدة إلى Product/main وProduction ضمن Workflow V3؟ التغيير الوحيد حذف max-height: 240px وoverflow-y: auto من .share-preview-box في src/styles/components.css لسطحي مشاركة الطالب والتقرير؛ لا تعديل بيانات أو Auth أو Supabase.
- الأدلة الجاهزة: Work Freeze 0464 بعد موافقة Work-local ‏0462.1؛ golden ‏12/12، browser ‏24/24؛ فرع Product ‏6fe3de7، build ناجح، browser مجاور ‏6/6؛ Cloudflare Preview ‏4abc5d8a ناجح والـ CSS المنشور يطابق رقعة Work وsmoke ‏6/6. لم تُرق النسخة إلى main/Production.
- سبب التوقف: Work Approval Ledger والعقد WA-N53-N54-0434 يصرحان N53 NOT_AUTHORIZED دون تذكرة Product مستقلة. إن كان تفويض MB01 اللاحق موجودا، يمكن لـ PM تسجيل مرجعه وتحديث التعارض قبل الاستئناف؛ وإلا يلزم قرار Product Owner صريح. لا يطلب هذا البند مراجعة Production النهائية بعد، إذ لم يحدث نشر Production.
