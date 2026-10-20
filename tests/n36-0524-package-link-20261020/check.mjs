// AI-authored: exact copy-only link check; reuses publisher receipts, no browser certification.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { unzipSync } from '../../src/lib/student-import-parsers.js';

const baseSha = '77915580a01ee4ea2fc9e50d6a5358f77452d110';
const view = 'src/views/class-import-center.js';
const archivePath = 'assets/extensions/rakeez-teacher-import-helper-0.5.24.zip';
const hash = b => createHash('sha256').update(b).digest('hex');
const readJson = async p => JSON.parse((await fs.readFile(p, 'utf8')).replace(/^\uFEFF/, ''));
const base = execFileSync('git', ['show', `${baseSha}:${view}`], { encoding: 'utf8' });
const source = await fs.readFile(view, 'utf8');
const before = '<a class="btn btn--primary" href="/assets/extensions/rakeez-teacher-import-helper-0.5.23.zip" download>تنزيل إضافة ركيز 0.5.23</a>';
const after = before.replaceAll('0.5.23', '0.5.24');
assert.equal(base.split(before).length, 2, 'One exact original link');
assert.equal(source, base.replace(before, after), 'Only exact href and label change; N107/imports preserved byte-for-byte');
const links = [...source.matchAll(/<a\b[^>]*href="([^"]+rakeez-teacher-import-helper-[^"]+\.zip)"[^>]*>([^<]+)<\/a>/g)];
assert.equal(links.length, 1);
assert.equal(links[0][1], '/' + archivePath);
assert.equal(links[0][2], 'تنزيل إضافة ركيز 0.5.24');
execFileSync(process.execPath, ['--check', view]);

const manifest = await readJson(archivePath.replace('.zip', '.manifest.json'));
const archive = await fs.readFile(archivePath);
assert.equal(manifest.version, '0.5.24');
assert.equal(manifest.archive.file, archivePath.split('/').at(-1));
assert.equal(hash(archive), manifest.archive.sha256);
assert.equal(archive.length, manifest.archive.bytes);
const packedManifest = JSON.parse(Buffer.from(unzipSync(archive)['manifest.json']).toString('utf8'));
assert.equal(packedManifest.version, '0.5.24');
assert.equal(packedManifest.name, 'ركيز المعلم - الاستيراد من مدرستي');

const queue = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/';
const reused = [];
for (const [id, paths] of [
  ['continuous-n36-0523-route-and-clean-madrasati-ui-20261020', [archivePath, archivePath.replace('.zip', '.manifest.json')]],
  ['continuous-n107-minimal-import-controls-20261020', [view]],
]) {
  const card = await readJson(queue + id + '.json');
  const receipt = card.deliveryReceipt;
  assert.equal(receipt.providerStatus, 'SUCCESS');
  assert.equal(receipt.productionDeployed, true);
  assert.ok(receipt.verifiedAt);
  assert.equal(receipt.binding.checkHeadShaMatches, true);
  execFileSync('git', ['merge-base', '--is-ancestor', receipt.publishedSha, baseSha]);
  const assets = [];
  for (const phase of ['immutable', 'production']) {
    assert.equal(receipt.evidence[phase].passed, true);
    for (const path of paths) {
      const a = receipt.evidence[phase].assets.find(a => a.repoPath === path);
      const expected = hash(path === view ? Buffer.from(base) : await fs.readFile(path));
      assert.equal(a.verified, true);
      assert.equal(a.statusCode, 200);
      assert.equal(a.expectedSha256, expected);
      assert.equal(a.observedSha256, expected);
      assets.push({ phase, repoPath: path, url: receipt.evidence[phase].origin + '/' + path, sha256: expected });
    }
  }
  reused.push({ taskId: id, candidateSha: receipt.candidateSha, publishedSha: receipt.publishedSha, verifiedAt: receipt.verifiedAt, assets });
}
const result = {
  taskId: 'continuous-n36-0524-verified-package-link-20261020',
  runId: '6bba93d2-7477-4560-9c33-e06d2f20b5a0',
  name: 'n36_exact_0524_verified_archive_download_link', status: 'PASS', baseSha,
  href: links[0][1], label: links[0][2], archiveSha256: hash(archive), archiveBytes: archive.length,
  scope: 'Exact link extraction, syntax, immutable archive manifest and reused upstream publication receipts; all other view bytes unchanged.',
  reused, renderedUi: 'NOT_RUN: copy-only source assertion requested by activated card; unchanged rendered evidence reused.',
  currentCandidatePublication: 'NOT_RUN: independent publisher owns changed served view/archive verification.',
};
await fs.writeFile('tests/n36-0524-package-link-20261020/result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
