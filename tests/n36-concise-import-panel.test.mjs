// AI-authored: actual app/CSS copy check; no live account or extension collection.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const baseSha = '91b4adc8736f79c663512a2829eb3b57ec54998f';
test('N36 copy/download and surrounding owner/review controls preserved; N107 owns rendered checks', async () => {
  const file = 'src/views/class-import-center.js';
  const current = await fs.readFile(file, 'utf8');
  const before = execFileSync('git', ['show', baseSha + ':' + file], { encoding: 'utf8' });
  // Only the static introductory copy/actions may differ; preserve the entire
  // preview, partial-source notice, ownership, lease, review and receipt code.
  // Broader shared-hub data/guard equality is checked in n104-responsive-export.test.mjs.
  const omitCopy = s => s.slice(s.indexOf('function directExtensionEntry()'), s.indexOf('async function receiveExtension()')).replace(/\r\n/g, '\n').replace(/  return html`<section class="card card--pad n36-direct"[\s\S]*?(?=    \$\{extensionPreview)/, '');
  assert.equal(omitCopy(current), omitCopy(before));
  for (const ext of ['zip', 'manifest.json']) {
    const p = 'assets/extensions/rakeez-teacher-import-helper-0.5.9.' + ext;
    assert.deepEqual(await fs.readFile(p), execFileSync('git', ['show', baseSha + ':' + p]));
  }
  // Current N107 actual-app browser evidence checks extension-first placement,
  // unchanged 0.5.11 download, responsive layout and tabs under the activated card.
  assert.match(current, /rakeez-teacher-import-helper-0\.5\.11\.zip/);
  assert.ok(current.indexOf('${directExtensionEntry()}${rosterFilePane(list)}') > 0);
});
