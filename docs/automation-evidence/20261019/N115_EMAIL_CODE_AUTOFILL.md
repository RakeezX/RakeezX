# N115 — email code entry (AI implementation)

Task: `continuous-n115-email-code-autofill-20261019`  
Run: `0c73cf2b-ab73-454a-a837-e8b9636d203d`  
Base / observed origin/main: `330a1920bae03bb189834a31615d6874d76c1860`

The existing input in `src/app.js` already has `autocomplete="one-time-code"`, numeric input mode, text semantics, six-digit pattern and maxlength. `src/auth.js` named in the card does not exist at this base; the allowed `src/app.js` contains both entry surfaces and their shared controller.

Changed only the shared input controller: normalize clipboard digits before native maxlength truncation, preserve selection replacement, and normalize browser `change` events alongside `input`. No automatic submission. Existing normalization continues to convert Arabic/Persian digits and preserve leading zeros. Both existing login surfaces use this controller. No Auth policy, owner guard, service, data, dependency or CSS change.

## Affected proof

- `node tests/n115-1019-email-code.mjs --baseline`: PASS reproduction against immutable base application source. Pasting `٠١٢ ٣٤٥` lost the sixth digit (`01234`).
- `node tests/n115-1019-email-code.mjs`: PASS actual app DOM, handlers and source CSS, fresh isolated Chromium on task-owned dynamic loopback HTTP port. Formatted Arabic/Persian paste yields `012345`; typing, leading zeros, partial selection replacement, input/change autofill events work. No implicit verification; incomplete code never reaches Auth. Synthetic rejected verification receives the correct email/token, shows the real invalid-code state, leaves submit enabled and user signed out. No page errors.
- `node --check src/app.js` and `git diff --check`: PASS.
- `tests/n115-1019-baseline.json`, `tests/n115-1019-browser.json`: exact scoped results. `tests/fixtures/n115-1019/email-code.png`: inspected 390×844 mobile rendering; field, code and error remain readable.

The fixture reuses N112's same-origin synthetic transport substitution and canonical `withIsolatedLocalBrowser`; real controller/cloud/store code remains active. Clipboard events exercise the real paste handler. The baseline models the native maxlength insertion only when the handler does not cancel the synthetic event. This is not an OS clipboard or mailbox integration certification. Service Workers/external traffic blocked; no real sends or account creation. Browser/context and owned server close in finally; no shared live lease needed for this eligible local phase.

## Supported browser contract and limit

`one-time-code` makes the field eligible for supported system/browser suggestions; it cannot guarantee that a particular email client supplies a suggestion. [Apple's HTML AutoFill documentation](https://developer.apple.com/documentation/security/enabling-password-autofill-on-an-html-input-element) documents the attribute. [WebKit's Safari notes](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/) describe eligibility. [Chrome's WebOTP documentation](https://developer.chrome.com/docs/identity/web-apis/web-otp) describes SMS-based phone verification, not mailbox access. No WebOTP call or mailbox permission was added. Browser-generated suggestions from an actual email were not tested or promised; manual entry and formatted paste remain usable.

Local candidate evidence only. Integration, publication and served Production checks belong to the independent controller/publisher; no claim of PO acceptance.
