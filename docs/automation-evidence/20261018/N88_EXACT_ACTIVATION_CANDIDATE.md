# N88 — مرشح التفعيل الدقيق المعطّل

AI-authored. Task `continuous-n88-service-activation-candidate-20261018`, run
`d05b1d5b-3c34-4b95-abea-1f3b4609600c`, base
`ddddd901b321acd432c54426faa3f09873c1987f`.

الحزمة قابلة للمراجعة والتنفيذ المشروط، ولم تُطبّق على خدمة مستضافة. لا تثبت
صلاحية الاستخدام الحي أو قبول N88. لا يوجد push أو deploy أو تعديل لصفوف حقيقية.

## المطابقة الفعلية وحدودها

المدخل المقروء فقط: `artifacts/ops-supervisor-v4/intake-evidence/po-0636-service-preflight/metadata.json`
في المشروع الأساسي. تحقق SHA256
`b0abdcb656880f0660d43d4678ce1191fb8ccd7eed2e957f519d33aa5f55f334`.
التقاطه `2026-10-18T03:39:31.082219+00:00`، والمشروع
`xlrubcwjqktzzunrvuns`، PostgreSQL 17.6؛ صفر صفوف شخصية.
الـsnapshot يسجل غياب مخطط N88 والأدوار الخاصة والدالة المنشورة، لا غيابها الآن.

`drafts/n88-student-portal/activation/metadata-contract.json` يحفظ الأعمدة
المستهلكة والأنواع وnullability وكل قيود ومحفزات وRLS الجداول السبعة كبيانات مقارنة.
لم يُنفذ أي تعريف SQL مأخوذ من المزوّد. الأعمدة المستخدمة في canonical-adapter،
بما فيها text IDs وbigint revision وdate end_date، تطابق الالتقاط. مفاتيح
PK المركبة وFK المالك إلى auth.users وروابط الأبناء المستخدمة تطابقه أيضًا.
التصحيح الملموس في الاختبار: RLS الفعلي **FORCE** وليس ENABLE فقط؛ النسخة المحلية
تفرضه. ولم نفترض وجود n88_backend: الهجرة تُنشئه NOLOGIN بصلاحيات محدودة؛
تحويله إلى LOGIN وحيازة بياناته عملية منفصلة، بلا كلمة مرور داخل الحزمة.

**مطابقة الملحق الأحدث:** رُوجع أحدث صف N88 في السجل الأساسي قبل الإنهاء؛
أضاف `metadata-addendum.json` بالتقاط `2026-10-18T03:46:04.759881+00:00` وSHA256
`e1f5276131ada32af32eb7ba467b74a4f84a993a3cdc265445873c95131b9e09`، و
`management-capabilities.json` بالتقاط `2026-10-18 06:48 Asia/Riyadh` وSHA256
`49a4e708b7e86001f62222600880591483bac2110b32415270cc54b44410e5c1`.
كلاهما في مجلد المدخل نفسه، read-only وصفر صفوف شخصية. تحققت hashes.
الملحق يثبت PK/FK وAuth RLS المفعّل بلا FORCE وبلا سياسات، والمالك
supabase_auth_admin، وأجسام كل دوال المحفزات التي تشير إليها الجداول السبعة.
لكل جسم ومحفز هوية مقارنة في preflight؛ revision يزيد old+1 للتغيير، يمنع
تعديل tombstone عبر الكتابة العامة، وrecord_owner_sync_change يمنع تغيير المالك.
لا تعديل لأية دالة canonical أو Sync أو restore؛ لا إعادة لاختبارها الكامل.

**الخلل الحقيقي في المقترح السابق:** GRANT إلى n88_guard وحده لا يتجاوز RLS
بلا سياسات، فلا يستطيع قفل Auth. صُحح إلى helperَين خاصين يملكهما **postgres
الموجود**: `lock_owner_key(uuid)` متاح لـn88_guard فقط، و
`lock_current_session(uuid,uuid)` متاح لـn88_backend فقط. الأول يقفل مفتاح مستخدم
واحد؛ الثاني يقفل المستخدم والجلسة المطابقتين ويتحقق من banned_until/not_after،
ولا يعيد tokens أو كلمات مرور أو قائمة حسابات. owner/session القادمان من Auth SDK
المتحقق منه مستقلان عن طلب العميل. search_path=pg_catalog وPUBLIC EXECUTE مسحوب.
بقي lock_canonical_sources وconsume_ingress بملكية n88_guard.

دور postgres الفعلي BYPASSRLS=true وsuperuser=false وليس عضو supabase_auth_admin
ولا يملك CREATE على auth. لا تُمنح هذه القدرة لأي دور جديد، ولا تُنشأ سياسات
Auth ولا تتغير ملكيته أو RLS. الهجرة تشترط current_user=postgres، وتفحص قدرته
الحالية على CREATE ROLE والأعمدة اللازمة لقفل الصفوف؛ أي امتياز غير متاح يوقفها
بدل توسيع صلاحيات الإدارة. الاختبار يستخدم الدور نفسه **غير superuser** لتنفيذ
الهجرة والـhelpers مع Auth RLS الموصوف، لا نموذج Auth بلا RLS.
تسمح الهجرة مؤقتًا SET إلى n88_guard للدور postgres فقط لنقل ملكية دالتين
جديدتين إليه، ثم تعيده SET=false داخل المعاملة؛ لا عضوية backend/guard.
النسخ الملتقطة تثبت حالة وقت الالتقاط؛ fresh preflight لازم عند التطبيق المستضاف.

## الملفات التنفيذية

- `supabase/migrations/20261018034356_n88_exact_activation_staged.sql`:
  أنشأها Supabase CLI المثبت v2.117.0 بعد قراءة `--help` و`migration new --help`
  ثم `migration new n88_exact_activation_staged`. هجرة واحدة ذرية fresh-only؛
  توقف عند تصادم schema/role/version أو اختلاف الأعمدة وPK/FK وRLS اللازمة.
  تشمل مكونات SQL السابقة بترتيبها، ثم grants/helpers/private policies.
  لا تغيير لهجرة مطبقة، ولا backfill أو context أو بيانات دخول أو cron.
- `activation/preflight.inactive.sql`: فحص metadata فقط لكل الأعمدة والقيود
  والمحفزات المسجلة، إضافة إلى شروط Auth والتصادم. يُشغّل لاحقًا كمدقق مأذون
  على المشروع المتحقق منه مستقلاً. لا يثبت اسم المشروع المكتوب في SELECT هوية الاتصال.
- `activation/readback.inactive.sql` و`identities.inactive.sql`: قراءات catalog فقط؛
  الأخير ينتج JSON لهويات helpers/ACL/grants/policies/RLS/الأدوار والامتيازات السلبية.
  `expected-identities.json` ناتج PG المحلي الفعلي؛ ليس readback مستضافًا.
  `scripts/n88-activation-readback.mjs actual.json approved-expected.json` يتحقق
  من envelope metadata-only: projectId/capturedAt/personalRowsRead=0/mode،
  migrationVersion=`20261018034356` وenabled=false وidentities كما أعاد الاستعلام.
  يتوقف عند أي drift؛ لا يطبّع اختلاف صلاحيات أو يعتمده آليًا. expected يخص
  مرحلة NOLOGIN؛ أي تغيير حيازة/LOGIN لاحق يحتاج diff وإثباتًا منفصلين.
- `activation/bundle/edge`: entry مدمج مع deno.json/lock الدقيقين؛ pg 8.23.1
  وAuth SDK 2.118.0 يبقيان imports خارجيين مثبتين بالـintegrity. لا جلب ضمن أداة الحزم.
  `bundle/cloudflare/worker.mjs` بلا imports خارجية أو Node APIs.
  `bundle/private` وثيقة التطبيق الفعلية مع JS/CSS الفعلية، وليس نموذج HTML بديلًا؛
  التعديل المولّد لمسارات assets في الوثيقة، تحت `/n88-private/`، وللمسافات
  اللاحقة في نسخ CSS فقط؛ المصدر المشترك غير متغير.
  الـentry المولّد JavaScript اسمه `index.mjs`، ويبقى index.ts الأصلي typed.
  `supabase.staged.toml` merge fragment معطّل بمسار entry وimport_map الصريحين،
  وimport_map.json مشتق من pins نفسها بلا مفاتيح config إضافية.
- `activation/manifest.json` يربط مصادر ورسوم الوحدات ومخرجات الحزم بالأجزاء
  التنفيذية وهويات الأدوات. source hashes بنص UTF-8 LF، output hashes ببايتاتها.
  `.gitattributes` داخل activation يفرض LF للحزمة عند checkout، وهويات أجسام
  الدوال تطبّع CRLF إلى LF فقط؛ لا تتجاهل اختلاف تعريف أو امتياز.
  `toolchain.json` يثبت SHA256 للأدوات الموجودة؛ esbuild 0.28.1، Wrangler 4.148.0،
  Deno 2.2.12 المؤهل سابقًا، وDeno 2.9.6 لفحص type-check المساعد.
- `activation/wrangler.staged.toml` مثبت إلى compatibility date 2026-10-01،
  بلا routes أو workers.dev أو preview أو observability، وN88_ENABLED=false.
  `activation/deploy.staged.json` يحدد entry/config/lock/gateway والوثيقة الخاصة
  والـheaders والمسارات المقترحة وحيازة bindings بالاسم فقط. ليس إعداد نشر نشطًا.

كل المسارات النسبية أعلاه تحت `drafts/n88-student-portal/` ما لم يُذكر غير ذلك.
بوابة JWT الخارجية للدالة المقترحة false لأن الطالب ليس حساب Supabase؛ التحقق
من ingress الموقّع ومن Auth SDK والجلسة الحالية باقٍ داخل الخدمة. لا service_role.
لا تغييرات N44 أو src أو public أو SW أو startup dependency؛ لا حاجة لإعادة
اختبار offline shell غير المتغير. student readiness وEdge وCloudflare ما زالت OFF.

## الفحوص المنفذة

- `node tests/n88-activation-postgres.mjs`: PG17.6 فعلي مملوك، loopback، بيانات
  مصطنعة فقط، lease integration مملوك. الهجرة الدقيقة تعمل مع الأنواع/nullability
  المستهلكة وPK/FK وFORCE RLS، وAuth بمالك supabase_auth_admin وRLS مفعّل
  وصفر سياسات. تنفيذ الهجرة ومالكا Auth helpers بدور postgres غير superuser.
  يرفض backend قراءة Auth/الكتابة canonical واستدعاء owner-key الداخلي،
  ويمنع دورَي الواجهة من helpers. نطاق المالك ينتهي عند rollback. الجلسة الصحيحة
  تعمل، والخاطئة/لغير المالك/المنتهية/المحذوفة تُرفض. FK للمالك نفسه ينتظر القفل
  بينما مالك آخر مستقل. إعادة الهجرة تتوقف قبل DDL. أُغلقت PG وتحرر lease.
  التفاصيل في `tests/n88-activation-postgres.result.json`.
- حُفظ الفشل الأول في `tests/n88-activation-postgres.initial-harness-failure.json`:
  محاولة SET ROLE من session_user مشرف ليست اختبار عضوية backend؛ صُححت إلى
  pg_has_role باسم الدور، دون تغيير guard أو صلاحية المنتج.
- حُفظ فشلا إدارة الأدوار غير superuser في
  `tests/n88-activation-postgres.management-owner-initial-failure.json` و
  `tests/n88-activation-postgres.management-acl-initial-failure.json`.
  أثبتا أن CREATE ROLE لا يمنح SET تلقائيًا وأن postgres لا يمنح EXECUTE بعد
  نقل الملكية دون grant option. صُحح تسلسل الهجرة: grant أثناء الملكية ثم SET
  مؤقت لنقل الملكية، وإلغاء SET قبل commit. لا استخدام superuser لتجاوزهما.
- أداة الحزم offline مع esbuild المثبت، ثم
  `node tests/n88-activation-artifacts.mjs`: hashes/graph/imports وnamespace
  وpins/readback-tamper/default-OFF/syntax نجحت. الأدلة في result الموافق.
  لم نسمّ هذه الفحوص دليل UI مرسومًا، ولم نكرر رحلات UI/PIN السابقة.
- فحص Deno2.9.6 للـentry مع frozen lock نجح؛ ليس إثبات offline dependency cache
  أو نسخة runtime المستضافة. محاولة check الأولى على Deno2.2.12 رفضت flag
  `--cached-only` لهذا subcommand؛ لا استنتاج Runtime FAIL من رفض CLI flag.
  فشل pin esbuild المفترض أولًا وصُحح إلى النسخة المرصودة 0.28.1؛ ثم صحح جامع
  hashes لاحقة query في module specifier دون تغيير المصدر. نجاح الحزمة موثق بعد التصحيح.
- فحص الحزمة كشف تسمية JavaScript المولّد `.ts` فنتجت 212 أخطاء inference/
  implicit-any. حُفظ artifact والفشل في `tests/n88-activation-edge-initial-type-failure.json`
  و`tests/fixtures/n88-activation/edge-initial-generated-typescript.txt`.
  صُحح الامتداد إلى `.mjs` دون ts-nocheck أو تغيير strictness؛ فحص Deno2.9.6
  للحزمة الفعلية `check --cached-only --frozen --config .../deno.json .../index.mjs`
  نجح، وفحص المصدر TypeScript الأصلي بقي ناجحًا.
- تعاد الاستفادة من دليل Runtime Deno2.2.12 وUI/PIN/owner guards السابق غير
  المتغير؛ النسخة المحلية الحالية لا تحاكي دوال كتابة/Sync/restore كاملة ولا تثبتها.

## قائمة تفعيل واحدة — عمليات خارجية لم تُنفّذ

1. حدّث قراءة metadata للمشروع أعلاه قبل التطبيق، وقارن snapshots الثلاثة
   المثبتة: PK/FK/nullability وAuth owner/RLS/zero policies وأجسام المحفزات
   وmanagement capabilities، migrations وغياب N88 schema/roles/function.
   preflight يفحص الهويات والامتيازات المطلوبة للدور الموجود، ويوقف أي drift
   بدل تعديل Auth أو منح bypass جديد. لا حساب أو صف طالب أو secret مطلوب.
2. بعد الموافقة الصريحة على DDL/private grants فقط، شغّل preflight ثم طبّق
   **الهجرة 20261018034356 فقط مرة واحدة** عبر مسار الهجرات المأذون؛ لا db push
   شامل ولا تسلسل SQL ثانٍ. اقرأ history وidentities وACL/private-schema exposure؛
   `n88_private` يجب ألا يظهر في Data API/GraphQL. طابق expected قبل أي LOGIN.
3. حائز الأسرار يحوّل n88_backend وحده إلى LOGIN بعد الاعتماد، ويحقن privately
   N88_DATABASE_URL (الدور المحدود، TLS موثق، بلا ssl override) وCA عند الحاجة،
   ومفتاحَي N88_HMAC_KEY وN88_INGRESS_KEY المختلفين. Edge فقط يحصل على DB/HMAC؛
   Cloudflare يحصل على ingress المشترك فقط. bindings العامة الموجودة بالاسم
   في deploy.staged.json، وN88_AUTH_API_KEY مفتاح Auth العام الموجود. لا استخراج
   قيم إلى artifacts/arguments/logs، ولا خدمة مدفوعة أو host جديد.
4. تحقق مستقلاً من Auth issuer/audience/JWKS/signing/session/getUser الحاليين
   دون callback/resend/cancel أو تغيير إعداد Auth. تحقق من TLS/CF external ingress
   وIP ورفض Worker subrequests وسياسات logs/analytics/Logpush لدى المزوّدين:
   لا private path أو PIN أو cookie/bearer أو SQL parameters/error DETAIL.
5. وافق على diff نشر الدالة n88-student-portal (entry المدمج وdeno lock/config
   أعلاه، gateway verify_jwt=false، revision=n88-existing-host-v1)، ثم Worker
   على **أصل التطبيق الموجود فقط** `/api/n88/*`، والوثيقة الخاصة على `/s/<43 chars>`
   والـasset allowlist `/n88-private/*` مع headers المحددة، بلا account-app fallback.
   مكوّن frontend publisher لا يطبق migration/function/roles/secrets/routes.
   ابدأ disabled/readiness OFF حتى اكتمال readback والاختبار المصطنع المأذون.
6. اعتمد fixture مستضافًا جديدًا محدودًا للمالك/الجلسة/parent-child lifecycle؛ لا
   هويات متقاعدة ولا إعادة زوج مستنفد. اختبر exact owner/current-session وarchive/
   restore/revision وrotation/revocation والـingress/cookie والصلاحيات السلبية.
   ثم تحقق من الجهاز/المتصفح الفعلي، private handoff، عدم cache/SW/logging للمسار،
   وربط teacher UI الحقيقي بguard المالك. التزم phase leases وإزالة موارد fixture
   المملوكة وفق موافقتها. لا إرسال حقيقي أو دخول طالب حقيقي ضمن الحزمة.
7. بعد readbacks والأدلة المطلوبة فقط، diff صريح يشغّل N88_ENABLED على الطرفين
   وbrowser readiness المطابق للـrevision. لا تغيير ضمني من نشر source، ولا ادعاء
   إغلاق Product أو قبول PO. إذا فشل شرط، تبقى القدرة OFF ويُحفظ الفشل.

**ملخص القرار العربي:** الحزمة تطلب اعتمادًا محددًا لاحقًا للهجرة الخاصة
20261018034356 وأدوارها وgrants، ثم حيازة أسرار backend المقيد، ونشر الدالة
ومسار Cloudflare ووثيقة الطالب على الأصل الموجود، مع fixture مستضاف جديد وفحص
جهاز/متصفح. يشمل اعتماد الهجرة صراحة ملكية postgres الحالية للـAuth helpers
الخاصة فقط، بلا تعديل managed Auth أو منح BYPASSRLS جديد. لا تكفي fixtures
المحلية لإعلان جاهزية الخدمة الحية. النشر المسموح الآن source معطّل فقط.
