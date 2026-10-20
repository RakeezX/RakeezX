# N36 — concise one-start description

- Task: `continuous-n36-clean-one-start-description-20261020`
- Run: `5730ea62-fc58-4615-aeab-f581cf752647`
- Base: `66a84641fe74b7f0a33c98e2ec9a72b3c31886b9` (HEAD and observed origin/main at inspection).
- Authority: activated copy-only card and canonical N36 row `[PO-20261020-RESUME]`.

Updated only the introductory paragraph in `directExtensionEntry()`:

> استورد من مدرستي بضغطة واحدة الفصول والمواد والطلاب والجدول، وبيانات المعلم والمدير والمدرسة المتاحة.

The real source template places it after the heading in `[data-n36-direct]`; the import pane includes `directExtensionEntry()`. The package remains 0.5.16. Existing result statuses, permissions, handlers and data behavior are unchanged.

## Affected verification

- PASS `n36_clean_one_start_available_fields_description`: Node assertion compared the full source against the base with exactly one paragraph replacement; checked the actual template placement, import-pane entry, existing status hook and unchanged package URL.
- PASS `node --check src/views/class-import-center.js`.
- PASS `git diff --check`.
- NOT_RUN rendered browser/import journey and full build, as explicitly excluded by this copy-only card. The source inspection is not rendered-UI evidence.
- No browser/server, service operation, real-data mutation, push or deployment performed. No phase resources acquired. Publication/served-source verification remain with the controller/publisher; no Product acceptance claimed.
