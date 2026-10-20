# N36 verified popup package download link

Task: continuous-n36-actual-popup-package-download-link-20261020
Run: 3ecd0da9-c4b6-4ff8-bed0-36e14612ce48
Base/current observed origin/main: 3d05e0057a1bf1fc0ec080c6d1af8c017ca72808

Only the immutable download href and visible version label in src/views/class-import-center.js change from 0.5.21 to 0.5.22. The download attribute, listener, N107 compact UI and N36 receiver logic are unchanged. No extension/archive/store changes.

## Reused upstream evidence

The existing controller receipt for continuous-n36-actual-popup-start-idle-20261020 records provider SUCCESS at published SHA 3d05e0057a1bf1fc0ec080c6d1af8c017ca72808, verified 2026-10-20T16:15:24.219Z. Its immutable and Production asset checks both match the exact archive SHA256 f1d0936757f8d0cb03b88cf7ac289ce4cb3cf858f34f850f91a239f1c19f78a9 (128752 bytes), version 0.5.22. These are reused publisher observations, not provider checks performed by this worker.

The existing N107 compact queue receipt is also provider SUCCESS. The test checks the entire pre-change import-view hash against its verified Production source hash. Reversing only the two version substitutions yields the exact base file, preserving all N107 and receiver logic.

## Targeted verification

Command: node tests/n36-popup-package-link-20261020/check.mjs
Required check: n36_actual_new_verified_package_link_download_no_navigation — PASS.

Fresh canonical isolated browser context on owned loopback HTTP port 49631, existing served-demo and synthetic owner helpers, actual application route/DOM/source CSS and existing click handler. The displayed label is تنزيل إضافة ركيز 0.5.22. Clicking produces a native browser download named rakeez-teacher-import-helper-0.5.22.zip; downloaded bytes match the upstream verified SHA256. The application URL remains unchanged. The screenshot was inspected. Syntax and exact two-substitution source assertion pass. No full build or engine/source/account matrix repeated.

Result: tests/n36-popup-package-link-20261020/result.json
Rendered evidence: tests/n36-popup-package-link-20261020/download-line.png

Owned browser contexts and server close through finally; downloaded temporary browser artifact is deleted. No real account/school operations or shared browser session. This candidate's frontend publication remains NOT_RUN, owned by the sole publisher. Stable updater/physical parity and native Chrome reload are separate existing phases. Whole N36 acceptance is not claimed. No queue changes or push.
