# N44 — حزمة تفعيل دقيقة ومعطّلة

AI-authored. Task `continuous-n44-service-activation-candidate-20261018`، run
`db4e0272-e5b1-44da-83b1-c720bc76cb4d`، base
`6753b1ede766649c2bb7506b07df63bf421858c5`.

النتيجة حزمة مصدر خاملة قابلة للمراجعة؛ لا تشغيل حي ولا إثبات قبول N44.
لم يحدث push/deploy أو تغيير خدمة/Auth أو سر أو صف مستخدم. تبقى واجهة التطبيق
وSW والخدمة والإرسال وCloudflare والمجدول **OFF**، بلا routes أو cron أو preview.

## المطابقة والتصحيحات

تحقق SHA256 لمدخل metadata الأصلي في المشروع الأساسي:
`b0abdcb656880f0660d43d4678ce1191fb8ccd7eed2e957f519d33aa5f55f334`،
المشروع `xlrubcwjqktzzunrvuns`، التقاط `2026-10-18T03:39:31.082219+00:00`.
وتحقق ملحق Auth/functions
`e1f5276131ada32af32eb7ba467b74a4f84a993a3cdc265445873c95131b9e09`
وقدرات الإدارة
`49a4e708b7e86001f62222600880591483bac2110b32415270cc54b44410e5c1`.
كلها metadata فقط وصفر صفوف شخصية؛ تعريفات المزوّد بيانات مقارنة لم تُنفّذ.
يحفظ `drafts/n44-push/activation/metadata-contract.json` الأنواع وnullability
وقيود PK/FK والمحفزات وRLS وهوية أجسام دوالها. تشمل المطابقة الجداول العشرة
المستهلكة: sessions/score_subitems/items/years/sections/subjects/calendars/
calendar_days/terms/teachings، وحقول Auth الخمسة اللازمة فقط.

الأعمدة الحالية تطابق المقترح. صُححت النسخة المصطنعة القديمة لتعكس **FORCE RLS**
وnullability الفعليتين وON DELETE CASCADE لرابط score_subitems→items.
لا تعديل لأي جدول canonical أو محفز Sync أو هجرة مطبقة. Full preflight يقارن
قيود ومحفزات الجداول المستهلكة وأجسام دوالها كنص/MD5 مع تثبيت المالك وsecurity
definer؛ الهجرة تحرس الأعمدة وPK/FK الفورية وFORCE RLS وقدرات الإدارة قبل DDL.

اختُبرت الهجرة بدور postgres **غير superuser**، مع Auth مملوك
لـsupabase_auth_admin وRLS مفعّل غير FORCE وصفر سياسات. لا ملكية أو سياسة أو
BYPASSRLS جديدة على Auth. helper الجلسة الخاص يبقى بملكية postgres الموجود،
متاحًا لـn44_backend فقط، ويعيد owner/session/not_after بلا tokens.
read_source بملكية n44_guard تحت RLS المالك؛ UPDATE(id) للقفل فقط وWITH CHECK
false يمنع كتابة الصفوف. يُمنح EXECUTE قبل نقل الملكية، مع CREATE/SET مؤقتين
للنقل داخل المعاملة ثم سحبهما قبل commit. أدوار backend/guard الجديدة
NOLOGIN/NOINHERIT/NOBYPASSRLS ولا تملك جداولها الخاصة أو وصولًا مباشرًا لـAuth.
عضوية الإنشاء الإدارية التلقائية لـpostgres تحت PG17 بلا SET أو INHERIT ليست
عضوية متاحة للواجهة أو backend.

**شرط فعلي إضافي لم تثبته اللقطة:** إنشاء FK إلى auth.users يحتاج امتياز
REFERENCES(id) الحالي لـpostgres. فشل التطبيق المحلي أولًا لغيابه؛ حُفظ الفشل
في `tests/n44-activation-postgres.references-initial-failure.json`.
أضيف شرط توقف صريح في preflight والهجرة. يثبت الاختبار رفض غيابه، ثم يحاكي
وجوده في العنقود المصطنع فقط. لا تزعم هذه النتيجة وجوده فعليًا، ولا تمنحه
الهجرة تلقائيًا. إن غاب عند readback المستضاف يتوقف التطبيق ويحتاج قرارًا
محددًا للصلاحية؛ لا توسعة تلقائية ولا تعطيل FK أو RLS لتجاوز الشرط.

## الملفات والعمليات المحددة

- `supabase/migrations/20261018044448_n44_exact_activation_staged.sql`:
  أنشأها CLI v2.117.0 بأمر `migration new n44_exact_activation_staged` بعد قراءة
  help، ثم جُمعت من SQL المحلي المراجع. معاملة واحدة fresh-only، قفل advisory
  خاص N44، حد lock=1s وstatement=15s. ترفض تصادم schema/role/version؛ لا
  backfill أو contexts أو أسرار. أزيلت السياسات الخاصة الكامنة للمصادقين من
  النسخة المجمعة؛ backend الخاص وحده يملك DML. المقترحات السابقة بقيت كما هي.
- `activation/preflight.inactive.sql`: catalog فقط، read-only، يتوقف عند drift
  أو تصادم. يجب التحقق المستقل من project/connection؛ اسم المشروع المكتوب
  في SELECT ليس إثبات اتصال. اللقطة التاريخية ليست fresh preflight مستضافًا.
- `activation/readback.inactive.sql` و`identities.inactive.sql`:
  catalog فقط، هويات schema/roles/memberships/helpers/ACL/grants/RLS/policies/
  PK/FK/indexes/triggers. `expected-identities.json` ناتج PostgreSQL المحلي
  الفعلي، مرحلة NOLOGIN فقط. أداة
  `node scripts/n44-activation-readback.mjs actual.json approved-expected.json`
  ترفض اختلاف الهويات أو project/version/enabled أو envelope غير metadata-only.
  لا تطبّع اختلاف الصلاحيات؛ تغير LOGIN أو الحيازة لاحقًا يحتاج diff ودليلًا.
- `activation/bundle/edge/index.mjs` مع deno.json/lock/import_map.json:
  رسم الاستيراد المحلي الفعلي مدمج، بما فيه calendar/models الحالية؛ حزم npm
  الخمس تبقى مثبتة بنفس integrity في npm/Deno locks، دون نسخ مفاتيح أو install
  في أداة الحزم. `supabase.staged.toml` جزء merge **معطّل** لا يستبدل config
  المشروع. verify_jwt=false لأن ingress والمجدول يستخدمان توقيعًا خاصًا؛
  التحقق داخل الخدمة عبر Auth SDK الرسمي والجلسة الحالية باقٍ.
- `activation/bundle/cloudflare/worker.mjs` و`wrangler.staged.toml`:
  ingress للأصل الحالي فقط، المسار المقترح `/api/n44/*`، بلا imports خارجية
  أو workers.dev أو routes/preview/observability. لم يُستدعَ Wrangler للنشر.
- `activation/bundle/scheduler/worker.mjs` و`scheduler.staged.toml`:
  مجدول خاص مستقل، بلا route عام أو cron. بعد تفويض لاحق فقط، cadence المقترح
  مرة بالدقيقة؛ signed POST إلى `/functions/v1/n44-notifications/schedule`،
  أربع صفحات كحد أقصى ×25 due ثم cleanup محدود. المفتاح منفصل عن ingress.
- `activation/deploy.staged.json` يحدد أسماء bindings/الأدوار والحيازة وkill
  switch بالاسم فقط؛ `client-readiness.json` يربط publicKey وenabled بالبروتوكول
  `n44-browser-v2` وrevision=`n44-browser-service-v2` وبالثابتين الحاليين
  PUSH_CONFIGURATION وN44_PUSH_ENABLED. لا قيمة سرية أو VAPID عام مفترض.
- `activation/manifest.json` يربط المصادر والحزم بأدواتها وhashes. مصادر UTF-8
  LF ومخرجات ببايتاتها؛ `.gitattributes` يثبت LF عند checkout. إعادة الحزم:
  `node scripts/n44-activation-bundle.mjs <installed-esbuild-main.js>`؛ لا fetch
  ضمن أداة الحزم. لا مصدر N88 أو app/SW متغير ولا startup dependency جديدة.

## الأدلة والحدود

`node tests/n44-activation-postgres.mjs` نجح على عنقود PG17.6 مصطنع مملوك،
بـintegration lease. رفض type/FORCE/FK-deferrability drift وrole/schema/version
collision وغياب REFERENCES، ثم نفّذ الهجرة المشروطة بدور الإدارة غير superuser.
نجحت قراءة lesson/due/calendar عبر علاقات أب/ابن صحيحة، ورصد revision وحذف
الابن، ورفض كتابة guard وقراءة backend المباشرة، وعزل المالك وclear GUC عند
rollback، ورفض جلسة لمالك آخر أو محظورة/منتهية. إعادة التطبيق تتوقف قبل DDL.
`tests/n44-activation-postgres.result.json` يحفظ النتيجة الفعلية؛ أُوقفت PG
وتحرر lease؛ checkpoints مملوكة ومتوقفة محفوظة ومُستثناة من Git، بلا محاولة
تنظيف سابقة مرفوضة. أخطاء أدوات الاختبار الأولى محفوظة منفصلة دون تغييرها إلى PASS.

`node tests/n44-activation-artifacts.mjs <installed-deno-2.2.12.exe>` نجح:
hashes/graphs/pins، سلوك الحزم المعطلة، readback tamper negatives، syntax
والـpublic mapping. شغّل **handler Edge المدمج الفعلي** بطلب مصطنع دون listener
في Deno2.2.12 مع شبكة محظورة وبيئة child محدودة؛ قرأ N44_ENABLED فقط من
bindings الخاصة وأعاد503. يحاكي الاختبار Deno.serve فقط لاستلام handler؛ لا UI
مقلد ولا browser جديد. فحص Deno2.9.6 مع cached-only/frozen-lockfile نجح أيضًا؛
ليس إثبات خدمة مستضافة. النتائج في `tests/n44-activation-artifacts.result.json`.

أعيد استخدام أدلة 18 crypto و16 boundary و12 runtime حسب hashes المكونات
المطابقة فقط، مع إبقاء الفروق التاريخية ظاهرة. كل hashes دليل العميل الفعلي
الحالي تطابق سجل PASS؛ لم تُكرر UI/Preview أو اختبارات شاملة، ولا يُدّعى UI PASS جديد.

## ملخص التفعيل العربي — اعتماد لاحق محدد، لا تنفيذ الآن

1. تحقق مستقلًا من المشروع الحالي وfresh metadata preflight كامل، بما فيه
   REFERENCES الحالي. اعتمد الهجرة الخاصة `20261018044448` والـhelpers/roles/
   grants المحددة؛ طبّق مرة واحدة واقرأ back هويتها. لا يطبق ناشر frontend هذا SQL.
2. وفّر حيازة server-only لاحقًا لبيانات n44_backend المقيدة وTLS، وbindings
   المسماة في deploy.staged.json، بمفاتيح مستقلة وAuth key عام مسموح فقط؛ لا
   service_role أو privileged browser key أو قيم أسرار في CLI/artifacts/logs.
3. احصل على fresh **سياسة Auth الفعلية** timebox/inactivity/single-session؛
   unknown/unsupported يبقي OFF. اربط supported profile المعتمد بـapprovalId
   جديد وserviceSourceSha ذي40 حرفًا وrevision الدقيق عند التفعيل. لا تجديد بشري
   يومي: أي تغيير Auth يبدأ بتعطيل/drain N44 وتقاعد approval/bindings وإعادة
   تأهيل profile. تستمر فحوص ban/session/not_after/consent/source في كل محاولة،
   مع lease جهاز أقصاه30 يومًا دون حفظ bearer/refresh token.
4. اعتمد exact diff لنشر Edge وingress على الأصل الموجود والمجدول الخاص فقط،
   واقرأ source/config hashes وOFF flags وغياب cron/routes النشطة. تحقق من
   توقيع ingress/scheduler وTLS/IP/CF-Worker denial وسياسة logs الخالية من
   bearer/endpoint/SQL parameters. لا host أو اشتراك مدفوع جديد.
5. بتفويض مستقل، استخدم fixture مستضافًا جديدًا صالح العلاقات؛ اختبر ملكية/
   جلسة/consent/revocation/source lifecycle، ثم جهازًا حقيقيًا يستقبل إشعارًا
   عامًا بلا أي عميل مفتوح، ويرفض الربط المتقاعد/logout/expiry والـclick الخاص
   غير المأذون. لا هوية متقاعدة أو زوج إثبات مستنفد، ولا أي عملية N64 مرفوضة.
6. بعد الأدلة فقط، diff صريح منفصل يشغّل مفاتيح الخدمة/ingress/delivery/
   scheduler/browser/SW ويضع VAPID العام المناسب. فشل أي شرط يبقيها OFF.

كل hosted/Auth-policy/provider/device/Production gates أعلاه **NOT_RUN**.
الحزمة الخاملة جاهزة محليًا؛ لا إعلان live readiness أو إغلاق N44/N78 أو قبول PO.
