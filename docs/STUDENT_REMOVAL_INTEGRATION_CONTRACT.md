# Student Removal integration — ticket 0094

## Authority and diagnosis

Production baseline: `78b4dddffc3e810efb3ba152d1d767e03c747337`.
The live 0030 metadata-only verification passed: exact function bodies, SECURITY
DEFINER/empty search_path and authenticated-only preview permissions match the
frozen migration. Security fingerprint:
`18fa8c7a905e4dc5072924798d8a4af3b1a750e744318128baae5e33aa28f8a6`.
No migration, live function change, or Product-row query was performed.

Synthetic baseline reproduction found missing client classification, not a
proven server defect: missing revision was checked before authentication;
normal unacknowledged students returned general `sync_not_ready`; Demo package
enrollments without a revision returned `invalid_source`. Demo membership is
identified through the existing `isLocalOnlyRecord` reference rule, including
ordinary-ID students added to a Demo class. Existing Demo deletion owns an
entire package/class, not an individual student; it is not a lifecycle fallback.

The reported generic message alone does not establish which exception occurred
in the original Work browser. Current healthy runtime returns known reasons;
an actual thrown/unavailable preview previously became the generic UI message.
The UI catch now preserves known auth/offline conditions. Unknown failures still
remain generic, non-destructive, and contain no raw errors or IDs.

## Account/data-type verification matrix

The runtime method is invoked by the UI in every row. A blocked preflight never
calls the remote preview RPC or a lifecycle command. Successful preview also
does not execute a lifecycle command.

| Synthetic state | Remote preview RPC | Runtime result | Confirmation |
| --- | --- | --- | --- |
| Authenticated, online, acknowledged, pristine | YES | delete_pristine / pristine | Explicit deletion only |
| Authenticated, online, acknowledged, protected history | YES | end_enrollment / history_exists | Explicit end-enrollment only |
| Authenticated, online, unacknowledged local student/enrollment | NO | blocked / student_not_synced | None |
| Signed-out normal local student | NO | blocked / auth_required | None |
| Demo package student or ordinary-ID student in Demo class | NO | blocked / demo_local_only | None |
| Stale canonical source/revision | YES | blocked / stale_source | None |
| Archived canonical enrollment/section | YES | blocked / archived_enrollment | None |
| Offline normal student | NO | blocked / offline | None |
| Genuine unavailable RPC | YES | blocked / preview_unavailable | None |

These account/data flows are covered by isolated synthetic IndexedDB + native
SQL + browser RPC transport tests. Ticket 0097 additionally verified the live
Production Auth and deployed 0030 RPC using the authorized QA account, with the
two reviewed candidate modules overlaid only in its isolated browser before
promotion. Pristine/history/stale/archived results and their relevant real UI
states passed. Unsynced data required normal Sync acknowledgement and a new live
preview, never automatic deletion; signed-out and Demo cases made no preview RPC.
No credentials, tokens, or browser storage were exported. Supported cleanup
tombstoned pristine students, ended historical enrollment, removed the local
Demo package, and archived protected classes. Protected synthetic history and
tombstones remain intentionally retained; the QA Auth user is retained.

The first live setup retained pre-canonical year/term IDs while creating
teachings. The harness was corrected to use acknowledged canonical parents;
no Sync semantics were changed. Blocked-state assertions now await completed
preview presentation instead of inspecting the transient busy state.

## Work presentation contract (existing sheet, no redesign)

All blocked-state sheet titles remain `إدارة الطالب`.

| Reason | Short explanation | Available actions | Destructive confirmation |
| --- | --- | --- | --- |
| auth_required | يلزم تسجيل الدخول إلى الحساب المعني لإتمام هذا الإجراء. | العودة للإدارة / إغلاق; login remains the existing app flow | NO |
| offline | يلزم الاتصال بالإنترنت لإتمام هذا الإجراء. | العودة للإدارة / إغلاق; retry removal after reconnecting | NO |
| student_not_synced | تحتاج بيانات الطالب إلى المزامنة أولًا قبل إزالته. | مزامنة الآن / العودة للإدارة / إغلاق | NO |
| demo_local_only | هذا طالب في فصل تجريبي محلي. يمكن حذف الفصل التجريبي من إدارة الفصول. | العودة للإدارة / إغلاق; existing whole-Demo-class management remains separate | NO |
| stale_source | تغيرت حالة الطالب، حدّث البيانات ثم حاول مرة أخرى. | العودة للإدارة / إغلاق | NO |
| archived_enrollment | لا يمكن تنفيذ الإجراء على فصل مؤرشف. | العودة للإدارة / إغلاق | NO |
| invalid_source | بيانات الانتساب الحالي غير متاحة. حدّث البيانات ثم حاول مرة أخرى. | العودة للإدارة / إغلاق | NO |
| sync_not_ready | أكمل المزامنة أو تحديث الجهاز أولًا، ثم حاول مرة أخرى. | العودة للإدارة / إغلاق | NO |
| student_unavailable / student_deleted | بيانات الطالب غير متاحة حاليًا. | العودة للإدارة / إغلاق | NO |
| preview_unavailable / unknown | تعذر التحقق من نتيجة الإزالة الآن. تحقق من الاتصال وحدّث البيانات ثم حاول مرة أخرى. | العودة للإدارة / إغلاق | NO |

`مزامنة الآن` invokes only the existing Sync coordinator. If it succeeds, the
runtime takes a new read-only snapshot and requests authoritative preview using
the newly acknowledged enrollment revision. It never automatically confirms or
executes deletion/end enrollment. Failed/blocked Sync is not overridden and
retry is not promised as a guaranteed fix.

Pristine confirmation retains title `حذف هذا الطالب؟`, explains that no
protected educational history exists, and offers `إلغاء` / `حذف الطالب`.
History confirmation retains title `إزالة الطالب من الفصل؟`, explains preserved
attendance/grades/history and Former Students placement, and offers `إلغاء` /
`إزالة من الفصل`. Execution independently rechecks existing 0029/0030 authority.
Resume receipts, Transfer, tombstones, and Sync ordering are unchanged.

No destructive local fallback, per-Demo-student removal, account creation,
history rewrite, or reinstatement capability is introduced.
