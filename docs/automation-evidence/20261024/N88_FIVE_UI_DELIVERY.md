# N88 qualified current-five UI slice — AI implementation

Task continuous-n88-current-five-ui-delivery-20261024; run b249f900-9cd7-499a-8902-e09f387def2c.

Base cf5f000697a53deba7a85f06586e1ef841a6e240, confirmed by origin/main readback. Card base 5d216959e5fe334b73b7fa276f6987a1f444b6b1 was fast-forwarded through its ops-only successor; all three Product preimages were unchanged. Applied only the three-file diff ceec3a1c4c128c4601b62044528e5c08581aaaf0..2b15de2a5e8f13a4109815164fcd3f9358bd1a93. All three exact source SHA-256 values match the manifest at parent fb63adcb8ffcee21e4f34c2536d65a3fb16ef61d. No source merge was needed. The candidate is the commit containing this document; exact source and dependency hashes are in provenance.json in the task test directory.

Current-main dom.js contains newer region-rendering support (imported html unchanged); app.css has newer contrast tokens; student-portal-class.css has newer list-support and quiet-progress styles. These dependencies were retained, individually recorded and qualified with actual current-source tests. Old rendered evidence alone was not reused to certify changed CSS. An initial overly broad provenance equality assertion exposed these differences; that assumption and its qualification remain recorded.

| Required publication check | Result | Actual evidence |
| --- | --- | --- |
| n88_five_counts_order_and_unknown_receipt_ui | PASS | tests/n88-five-ui-delivery-20261024/ui.mjs and ui.json: mounted runtime/client/component/source CSS via fresh HTTP; five pupils/two active codes, numeric ordering and duplicate-label identity ties; actual sorted-row revoke sends original student/enrollment; unknown after successful list with no replay; confirmed empty versus unavailable; retired owner roster/support removed. |
| n88_finite_mutation_diagnostic_and_owner_guards | PASS | client.mjs/client.json and UI support: finite diagnostic schema/value bounds; mutation503 separate from list success; unknown receipt retained; old snapshot rejected; invocation-to-dispatch owner retirement prevents HTTP dispatch. |
| n88_qualified_three_file_current_main_parity | PASS | provenance.json: three exact qualified source hashes, current-main preimage equality and recorded dependency qualifications; node --check on all three sources; git diff --check. |

The UI sorts a copied display array without persisting roster order. Counts do not establish issuance or rollback. Existing grade, publication, receipt, owner, cancellation and Sync semantics remain intact. No new startup dependency was introduced.

Tests port the existing class-management HTTP fixture, with the canonical isolated helper on owned loopback port52488. Fresh disposable contexts block external requests and Service Workers; owned browser/contexts and server closed in finally. This eligible isolated phase requires no shared browser lease. The initial additional CSS assertion used the ul rather than li; exact failure and selector-only correction are retained in ui.json. The original client's synchronous-preflight harness correction is preserved.

Local readiness covers only this public UI slice. No push/deploy/provider action, live account access or real-data mutation occurred. The original independent publisher owns integration/build and served verification. Actual hosted list200 and student503/no-profile do not establish issuance or stability. All original thirteen parent FAIL/NOT_RUN gates, service/issuance UNKNOWN and umbrella N88 remain open in their original custody.
