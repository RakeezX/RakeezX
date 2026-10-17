## AI — v0.5.4: complete source review, explicit class batches

The teacher still starts one foreground run on their own source tab. The new
`source-roster.js` model is transient in the dedicated run tab only: up to 1200
validated rows, eligibility limited to 24 complete report pages across the run, and the existing 90-second
run/5-minute review deadlines. Navigation overhead has a separate bounded allowance
(up to 48 total visited documents including the 24 reports). No source route,
permission, frame access, credential access or background collection was added.

Pagination GET links are followed before pending index links. A MyStudents index
without an allowed roster link is redundant only after every discovered report
series has all consecutive pages and an explicit terminal, no student warning or
pending student route remains, and source-tab/origin/role/school guards still pass.
A lone index, missing page, changed pager or unsupported relevant link stays denied.

The full source review never enters `bundle()` or the 300-row category transport.
Class counts are compact; selecting one exact classroom renders only that class's
names and requires a fresh review confirmation. A class above 300 is disabled and
rejected again by validation, never truncated. Another class may be transferred
explicitly during the original review lease. Same normalized name in distinct exact
classrooms is permitted; duplicates within a class and ambiguous classroom aliases
fail closed. No 1200-field editor is created and the old timetable editor stays shut.

Only the selected <=300 names enter the existing private one-time handoff and N12
owner/year/term/offline-lease preview/confirmation. Session payloads use AES-GCM;
the short-lived key shares Chrome's extension-only session boundary (this is not
protection against a compromised browser). Claim deletes before decryption/reply;
replay, cancellation, source invalidation, review expiry and transport alarm fail
closed. No names appear in URLs, diagnostics or persistent storage.

Official completeness/last-page compatibility and PO acceptance remain NOT_RUN.
0.5.1 and 0.5.3 archives remain unchanged rollback packages. Do not update the
personal stable runtime or reload the user's browser from a worker; that operator
step follows independent verified publication only.


## Exact package and publisher boundary

Archive: `rakeez-teacher-import-helper-0.5.4.zip`  
SHA-256: `41c24b282c043b5447863fb2bb08c4b94286be34b7aa06287e011c7dec4a6cce`  
Bytes: 91000

The v0.5.4 manifest lists every packaged file hash. Node checks compare every archive byte to that manifest and checkout source; runtime JS/CSS/HTML/JSON use canonical LF serialization. Installed MV3 evidence binds the archive and runtime files. The existing app download entry points to v0.5.4. No new app startup dependency or offline-shell module was added.

The worker does not push/deploy. The controller/publisher must integrate the exact candidate, verify Cloudflare provider + immutable revision + served app and v0.5.4 asset parity. Only afterward may the authorized operator use the existing update-stable.ps1 on `C:\Users\Abody\Projects\RakeezX\artifacts\private-tools\n36-current\runtime`; keep one stable unpacked directory and its backups. Worker performed no install or reload. N36 remains OPEN pending genuine PO trial.
