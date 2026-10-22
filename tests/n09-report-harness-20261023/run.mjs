// AI-authored. Run from repository root:
// node --import ./tests/n09-report-harness-20261023/run.mjs --test tests/n70-cross-class.test.mjs tests/n70-v21-print-labels.test.mjs
// Only CSS side effects are omitted in this Node logic test. Real JS is loaded
// unchanged; rendered layout evidence is retained separately, never claimed here.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.css')) {
      readFileSync(new URL(url)); // Missing stylesheets must still fail loading.
      return { format: 'module', source: 'export {};', shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
