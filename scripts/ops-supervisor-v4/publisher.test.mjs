import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { publishCandidate, observePublishedCommit, parseProviderCheck, normalizeCloudflareIndex, runCommand } from './publisher.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = path.join(here, '.test-tmp');
const text = result => Buffer.from(result.stdout ?? '').toString('utf8').trim();
const output = value => ({ code: 0, stdout: Buffer.from(JSON.stringify(value)), stderr: Buffer.alloc(0) });
const sha256 = value => createHash('sha256').update(value).digest('hex');
// Literal provider output captured by the parent during the live read-only check.
const jsdFixture = (await fs.readFile(new URL('./fixtures/cloudflare-jsd.html', import.meta.url), 'utf8')).replace(/\n$/, '');
const missingCommitFixture = JSON.parse(await fs.readFile(new URL('./fixtures/github-checks-missing-commit-422.json', import.meta.url), 'utf8'));
const missingCommitResponse = sha => ({ code: missingCommitFixture.code,
  stdout: Buffer.from(missingCommitFixture.stdout.replaceAll(missingCommitFixture.queriedSha, sha)),
  stderr: Buffer.from(missingCommitFixture.stderr.replaceAll(missingCommitFixture.queriedSha, sha)) });
const indexMetadata = { repoPath: 'index.html', urlPath: 'index.html', statusCode: 200, server: 'cloudflare', contentType: 'text/html; charset=utf-8' };

async function fixture(t) {
  await fs.mkdir(scratch, { recursive: true });
  const root = await fs.mkdtemp(path.join(scratch, 'publisher-'));
  const repo = path.join(root, 'canonical'), remote = path.join(root, 'remote.git');
  await fs.mkdir(repo);
  const git = async (args, cwd = repo) => {
    const result = await runCommand('git', args, { cwd });
    assert.equal(result.code, 0, text({ stdout: result.stderr })); return result;
  };
  await git(['init', '--bare', remote], root);
  await git(['init', '-b', 'main']);
  await git(['config', 'user.name', 'Delivery test']);
  await git(['config', 'user.email', 'test@local.invalid']);
  await fs.mkdir(path.join(repo, 'src', 'generated'), { recursive: true });
  await fs.mkdir(path.join(repo, 'scripts'));
  await fs.writeFile(path.join(repo, '.gitignore'), 'node_modules/\ndist/\n');
  await fs.writeFile(path.join(repo, 'index.html'), '<html><body>Rakeez fixture</body></html>\n');
  await fs.writeFile(path.join(repo, 'sw.js'), 'const VERSION = "fixture";\n');
  await fs.writeFile(path.join(repo, 'src', 'view.js'), 'export const label = "Before";\n');
  await fs.writeFile(path.join(repo, 'src', 'untouched.js'), 'export const untouched = true;\n');
  await fs.writeFile(path.join(repo, 'src', 'generated', 'build-meta.generated.js'), 'export const BUILD = "initial";\n');
  await fs.writeFile(path.join(repo, 'scripts', 'generate-build-meta.mjs'),
    'import fs from "node:fs";\n' +
    'const value = fs.readFileSync("src/view.js", "utf8") + process.env.SOURCE_DATE_EPOCH;\n' +
    'fs.writeFileSync("src/generated/build-meta.generated.js", "export const BUILD = " + JSON.stringify(value) + ";\\n");\n');
  await git(['add', '.']); await git(['commit', '-m', 'Base']);
  const base = text(await git(['rev-parse', 'HEAD']));
  await git(['remote', 'add', 'origin', remote]); await git(['push', 'origin', 'main']);
  await git(['checkout', '-b', 'candidate']);
  await fs.writeFile(path.join(repo, 'src', 'view.js'), 'export const label = "After.";\n');
  await git(['add', 'src/view.js']); await git(['commit', '-m', 'N92 copy']);
  const candidate = text(await git(['rev-parse', 'HEAD']));
  await git(['checkout', 'main']);
  await fs.writeFile(path.join(repo, 'src', 'untouched.js'), 'KEEP THIS UNSAVED CHANGE\n');
  const initialStatus = text(await git(['status', '--porcelain']));
  const calls = [], checkMap = new Map();
  let nextCheckId = 101, pushCount = 0, buildCount = 0, wrongProduction = false;
  const providerCheck = (sha, id = nextCheckId++, conclusion = 'success') => ({
    id, head_sha: sha, name: 'Cloudflare Pages', status: 'completed', conclusion,
    app: { id: 85455, slug: 'cloudflare-workers-and-pages' }, check_suite: { head_branch: 'main' },
    details_url: 'https://dash.cloudflare.com/?to=/account/pages/view/rakeezx/2b02e78c-bf5a-4cfb-b371-cac4431d2143',
    output: { summary: "<a href='https://2b02e78c.rakeezx.pages.dev'>Preview URL</a>" },
  });
  checkMap.set(base, [providerCheck(base)]);
  const run = async (command, args, options) => {
    calls.push({ command, args: [...args], cwd: options?.cwd });
    if (command === 'gh') {
      if (args[0] === 'repo') return output({ nameWithOwner: 'RakeezX/RakeezX' });
      const endpoint = args.find(item => item.startsWith('repos/'));
      const sha = endpoint?.match(/\/commits\/([a-f0-9]{40})\//)?.[1];
      const checks = checkMap.get(sha) ?? [];
      return output({ total_count: checks.length, check_runs: checks });
    }
    if (command === process.execPath) buildCount++;
    const result = await runCommand(command, args, options);
    if (command === 'git' && args[0] === 'push') {
      pushCount++;
      if (result.code === 0) {
        const sha = args.at(-1).split(':')[0];
        checkMap.set(sha, [...(checkMap.get(sha) ?? []), providerCheck(sha)]);
      }
    }
    return result;
  };
  const fetcher = async input => {
    const url = new URL(input);
    const sha = url.searchParams.get('__rakeez_delivery');
    const file = url.pathname.slice(1).split('/').map(decodeURIComponent).join('/');
    const result = await runCommand('git', ['show', `${sha}:${file}`], { cwd: repo });
    if (wrongProduction && url.hostname === 'rakeezx.com' && file === 'src/view.js') {
      return new Response('stale production', { status: 200 });
    }
    return new Response(result.code === 0 ? result.stdout : 'Missing', { status: result.code === 0 ? 200 : 404 });
  };
  let acquired = 0, released = 0;
  const opts = { ticketId: 'N92', taskId: 'v5-n92-copy', cwd: repo, candidateSha: candidate, baseSha: base,
    stateDir: path.join(root, 'state'), productionUrl: 'https://rakeezx.com', repository: 'RakeezX/RakeezX', validationTier: 'FAST',
    acquireLease: async name => { assert.equal(name, 'integration'); acquired++; return { id: acquired }; },
    releaseLease: async token => { assert.ok(token.id); released++; } };
  t.after(async () => { await fs.rm(root, { recursive: true, force: true }); });
  return { repo, remote, root, git, base, candidate, opts, calls, checkMap, providerCheck,
    dependencies: { run, fetch: fetcher },
    get counts() { return { pushCount, buildCount, acquired, released }; },
    setWrongProduction(value) { wrongProduction = value; },
    assertCanonicalPreserved: async () => {
      assert.equal(text(await git(['rev-parse', 'HEAD'])), base);
      assert.equal(text(await git(['status', '--porcelain'])), initialStatus);
      assert.equal(await fs.readFile(path.join(repo, 'src/untouched.js'), 'utf8'), 'KEEP THIS UNSAVED CHANGE\n');
    } };
}

test('provider metadata requires exact app, head SHA and deployment-specific URL', () => {
  const sha = 'a'.repeat(40);
  const valid = { id: 10, head_sha: sha, name: 'Cloudflare Pages', status: 'completed', conclusion: 'success',
    app: { id: 85455, slug: 'cloudflare-workers-and-pages' },
    details_url: 'https://dash.cloudflare.com/?to=/account/pages/view/rakeezx/2b02e78c-bf5a-4cfb-b371-cac4431d2143',
    output: { summary: "<a href='https://2b02e78c.rakeezx.pages.dev'>Preview</a>" } };
  assert.equal(parseProviderCheck(valid, { publishedSha: sha }).deploymentId, '2b02e78c-bf5a-4cfb-b371-cac4431d2143');
  assert.equal(parseProviderCheck({ ...valid, head_sha: 'b'.repeat(40) }, { publishedSha: sha }), null);
  assert.equal(parseProviderCheck({ ...valid, app: { id: 1, slug: 'cloudflare-workers-and-pages' } }, { publishedSha: sha }), null);
  assert.equal(parseProviderCheck({ ...valid, output: { summary: 'https://evil.rakeezx.pages.dev' } }, { publishedSha: sha }).previewUrl, null);
});

test('FAST publication verifies exact source, preserves dirty canonical, and reuses receipt', async t => {
  const f = await fixture(t);
  const result = await publishCandidate(f.opts, f.dependencies);
  assert.equal(result.status, 'deployed', JSON.stringify(result));
  assert.equal(result.state, 'DEPLOYED_AWAITING_PO');
  assert.equal(result.build.kind, 'metadata-only');
  assert.notEqual(result.publishedSha, f.candidate); // Generated metadata is explicitly committed and bound.
  assert.equal(result.binding.candidateAncestorOfPublished, true);
  assert.equal(result.evidence.production.passed, true);
  assert.ok(result.evidence.production.assets.some(a => a.repoPath === 'src/view.js' && a.verified));
  assert.equal(f.counts.buildCount, 1); assert.equal(f.counts.pushCount, 1);
  assert.equal(f.counts.acquired, f.counts.released);
  await f.assertCanonicalPreserved();
  const second = await publishCandidate(f.opts, f.dependencies);
  assert.deepEqual(second, result);
  assert.equal(f.counts.pushCount, 1); assert.equal(f.counts.buildCount, 1);
  const pushes = f.calls.filter(c => c.command === 'git' && c.args[0] === 'push');
  assert.equal(pushes[0].args.at(-1), `${result.publishedSha}:refs/heads/main`);
  assert.ok(pushes.every(c => !c.args.some(a => a.includes('--force') || a.startsWith('+'))));
});

test('the actual GitHub unknown-local-commit 422 is allowed only for the exact prepush SHA', async t => {
  const f = await fixture(t);
  let missingReads = 0;
  const run = async (command, args, options) => {
    if (command === 'gh' && args[0] === 'api' && f.counts.pushCount === 0) {
      const sha = args.find(arg => arg.startsWith('repos/')).match(/\/commits\/([a-f0-9]{40})\//)[1];
      missingReads++;
      return missingCommitResponse(sha);
    }
    return f.dependencies.run(command, args, options);
  };
  const result = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(result.status, 'deployed', JSON.stringify(result));
  assert.equal(missingReads, 1);
  assert.equal(f.counts.buildCount, 1); assert.equal(f.counts.pushCount, 1);
  await f.assertCanonicalPreserved();
});

test('one provider precheck outage resumes the durable built stage without another build or worktree', async t => {
  const f = await fixture(t);
  const journalFile = path.join(f.opts.stateDir, `${f.candidate}.journal.json`);
  let outage = true;
  const run = async (command, args, options) => {
    if (outage && command === 'gh' && args[0] === 'api') {
      outage = false;
      const saved = JSON.parse(await fs.readFile(journalFile));
      assert.equal(saved.stage, 'built');
      assert.equal(saved.build.status, 'passed');
      assert.equal(saved.build.publishedSha, saved.publishedSha);
      assert.ok(saved.assets.some(asset => asset.repoPath === 'src/view.js' && asset.sha256));
      return { code: 1, stdout: Buffer.from('{"message":"Service Unavailable","status":"503"}'), stderr: Buffer.from('gh: Service Unavailable (HTTP 503)') };
    }
    return f.dependencies.run(command, args, options);
  };
  const first = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(first.status, 'pending'); assert.equal(first.errorCode, 'CHECKS_UNAVAILABLE');
  assert.equal(f.counts.pushCount, 0); assert.equal(f.counts.buildCount, 1);
  const built = JSON.parse(await fs.readFile(journalFile));
  assert.equal(built.stage, 'built'); assert.equal(built.prepareAttempt, 1);
  const result = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(result.status, 'deployed', JSON.stringify(result));
  assert.equal(f.counts.buildCount, 1); assert.equal(f.counts.pushCount, 1);
  assert.equal(result.publishedSha, built.publishedSha);
  assert.equal(result.integrationWorktree, built.worktree);
  assert.equal(f.calls.filter(call => call.command === 'git' && call.args.includes('worktree') && call.args.includes('add')).length, 1);
  await f.assertCanonicalPreserved();
});

test('an unrelated 422 or a missing different SHA remains a retryable precheck failure without rebuilding', async t => {
  for (const kind of ['different-sha', 'other-message']) {
    const f = await fixture(t);
    const run = async (command, args, options) => {
      if (command === 'gh' && args[0] === 'api') {
        if (kind === 'different-sha') return missingCommitResponse('f'.repeat(40));
        return { code: 1, stdout: Buffer.from('{"message":"Validation Failed","status":"422"}'), stderr: Buffer.from('gh: Validation Failed (HTTP 422)') };
      }
      return f.dependencies.run(command, args, options);
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await publishCandidate(f.opts, { ...f.dependencies, run });
      assert.equal(result.status, 'pending', kind);
      assert.equal(result.errorCode, 'CHECKS_UNAVAILABLE', kind);
    }
    assert.equal(f.counts.buildCount, 1); assert.equal(f.counts.pushCount, 0);
    const saved = JSON.parse(await fs.readFile(path.join(f.opts.stateDir, `${f.candidate}.journal.json`)));
    assert.equal(saved.stage, 'built'); assert.equal(saved.prepareAttempt, 1);
    await f.assertCanonicalPreserved();
  }
});

test('a backed-up legacy REMOTE_CHURN prepush journal can deliberately reprepare once while retaining old worktrees', async t => {
  const f = await fixture(t);
  const run = async (command, args, options) => command === 'gh' && args[0] === 'api'
    ? { code: 1, stdout: Buffer.from('{"message":"Service Unavailable","status":"503"}'), stderr: Buffer.from('gh: Service Unavailable (HTTP 503)') }
    : f.dependencies.run(command, args, options);
  assert.equal((await publishCandidate(f.opts, { ...f.dependencies, run })).status, 'pending');
  const journalFile = path.join(f.opts.stateDir, `${f.candidate}.journal.json`);
  const legacy = JSON.parse(await fs.readFile(journalFile));
  const retainedWorktree = legacy.worktree;
  Object.assign(legacy, { stage: 'blocked', prepareAttempt: 3, errorCode: 'REMOTE_CHURN', message: 'Legacy precheck exhausted attempts' });
  for (const field of ['build', 'assets', 'changedPaths', 'sourceOnlyPaths', 'publishedSha', 'builtAt']) delete legacy[field];
  assert.equal(legacy.pushIntentAt, undefined);
  await fs.writeFile(journalFile, JSON.stringify(legacy));
  const backup = path.join(f.opts.stateDir, 'legacy-prepush-recovery-backup.json');
  await fs.copyFile(journalFile, backup);
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    const retained = path.join(f.opts.stateDir, `integration-${f.candidate.slice(0, 12)}-${ordinal}`);
    await fs.mkdir(retained); await fs.writeFile(path.join(retained, 'retained-evidence.txt'), 'Do not delete or reuse');
  }
  // This is the explicit one-time journal correction described in RECOVERY.md,
  // not automatic permission to reset genuine conflicts or push failures.
  legacy.stage = 'reprepare'; legacy.prepareAttempt = 0;
  delete legacy.errorCode; delete legacy.message; delete legacy.errorDetails;
  await fs.writeFile(journalFile, JSON.stringify(legacy));
  const result = await publishCandidate(f.opts, f.dependencies);
  assert.equal(result.status, 'deployed', JSON.stringify(result));
  assert.equal(f.counts.buildCount, 2); // One legacy build, one necessary rebuilt receipt.
  assert.equal(f.counts.pushCount, 1);
  assert.notEqual(result.integrationWorktree, retainedWorktree);
  assert.ok((await fs.stat(retainedWorktree)).isDirectory());
  assert.equal(JSON.parse(await fs.readFile(backup)).errorCode, 'REMOTE_CHURN');
  await f.assertCanonicalPreserved();
});

test('the missing-commit 422 is never accepted as an empty check list after push', async t => {
  const f = await fixture(t);
  const run = async (command, args, options) => {
    if (command === 'gh' && args[0] === 'api' && f.counts.pushCount > 0) {
      const sha = args.find(arg => arg.startsWith('repos/')).match(/\/commits\/([a-f0-9]{40})\//)[1];
      return missingCommitResponse(sha);
    }
    return f.dependencies.run(command, args, options);
  };
  const first = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(first.status, 'pending'); assert.equal(first.errorCode, 'CHECKS_UNAVAILABLE');
  assert.equal(f.counts.buildCount, 1); assert.equal(f.counts.pushCount, 1);
  const recovered = await publishCandidate(f.opts, f.dependencies);
  assert.equal(recovered.status, 'deployed', JSON.stringify(recovered));
  assert.equal(f.counts.buildCount, 1); assert.equal(f.counts.pushCount, 1);
});

test('crash after accepted push and before push journal confirmation never publishes again', async t => {
  const f = await fixture(t);
  const first = await publishCandidate(f.opts, { ...f.dependencies, afterPushTransport: async () => { throw new Error('simulated process interruption'); } });
  assert.equal(first.status, 'pending'); assert.equal(f.counts.pushCount, 1);
  const journalFile = path.join(f.opts.stateDir, `${f.candidate}.journal.json`);
  const saved = JSON.parse(await fs.readFile(journalFile));
  assert.equal(saved.stage, 'prepared'); assert.ok(saved.pushIntentAt);
  const resumed = await publishCandidate(f.opts, f.dependencies);
  assert.equal(resumed.status, 'deployed', JSON.stringify(resumed));
  assert.equal(resumed.pushRecovered, true); assert.equal(f.counts.pushCount, 1); assert.equal(f.counts.buildCount, 1);
  await f.assertCanonicalPreserved();
});

test('advanced main is merged in isolation and both histories survive a normal push', async t => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external');
  await f.git(['clone', '--branch', 'main', f.remote, external], f.root);
  await f.git(['config', 'user.name', 'Other writer'], external); await f.git(['config', 'user.email', 'other@local.invalid'], external);
  await fs.writeFile(path.join(external, 'src/other.js'), 'export const independent = 7;\n');
  await f.git(['add', '.'], external); await f.git(['commit', '-m', 'Independent main update'], external); await f.git(['push', 'origin', 'main'], external);
  const advanced = text(await f.git(['rev-parse', 'HEAD'], external));
  const result = await publishCandidate(f.opts, f.dependencies);
  assert.equal(result.status, 'deployed', JSON.stringify(result));
  assert.equal(result.binding.kind, 'merge'); assert.equal(result.binding.mainAtPreparation, advanced);
  assert.equal((await runCommand('git', ['merge-base', '--is-ancestor', advanced, result.publishedSha], { cwd: f.repo })).code, 0);
  assert.equal(text(await f.git(['show', `${result.publishedSha}:src/other.js`])), 'export const independent = 7;');
  await f.assertCanonicalPreserved();
});

test('build failure prevents every push and retains a repairable integration checkout', async t => {
  const f = await fixture(t);
  const result = await publishCandidate({ ...f.opts, buildCommand: { command: process.execPath, args: ['-e', 'process.stderr.write("specific build failure");process.exit(2)'] } }, f.dependencies);
  assert.equal(result.status, 'blocked'); assert.equal(result.errorCode, 'BUILD_FAILED'); assert.equal(f.counts.pushCount, 0);
  assert.match(result.context, /specific build failure/);
  assert.equal(text(await f.git(['ls-remote', '--heads', 'origin', 'refs/heads/main'])).split(/\s+/)[0], f.base);
  assert.ok((await fs.stat(result.integrationWorktree)).isDirectory());
  await f.assertCanonicalPreserved();
});

test('main advancing exactly at push rejects the stale attempt and preserves the other writer', async t => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external-race');
  await f.git(['clone', '--branch', 'main', f.remote, external], f.root);
  await f.git(['config', 'user.name', 'Concurrent writer'], external); await f.git(['config', 'user.email', 'concurrent@local.invalid'], external);
  await fs.writeFile(path.join(external, 'src/concurrent.js'), 'export const preserved = true;\n');
  await f.git(['add', '.'], external); await f.git(['commit', '-m', 'Concurrent main change'], external);
  const concurrentSha = text(await f.git(['rev-parse', 'HEAD'], external));
  let raced = false;
  const run = async (command, args, options) => {
    if (!raced && command === 'git' && args[0] === 'push') {
      raced = true; await f.git(['push', 'origin', 'main'], external);
    }
    return f.dependencies.run(command, args, options);
  };
  const first = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(first.status, 'pending'); assert.equal(first.errorCode, 'PUSH_NOT_CONFIRMED');
  assert.equal(text(await f.git(['ls-remote', '--heads', 'origin', 'refs/heads/main'])).split(/\s+/)[0], concurrentSha);
  const second = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(second.status, 'deployed', JSON.stringify(second));
  assert.equal(second.binding.mainAtPreparation, concurrentSha);
  assert.equal(text(await f.git(['show', `${second.publishedSha}:src/concurrent.js`])), 'export const preserved = true;');
  assert.equal(f.counts.pushCount, 2); // One rejected push and one accepted publication.
  assert.equal(f.counts.buildCount, 2); // A concrete main change required a new integration.
  await f.assertCanonicalPreserved();
});

test('old Preview check cannot certify a new main push; stale production never returns deployed', async t => {
  const f = await fixture(t);
  let suppressCheck = true;
  const run = async (command, args, options) => {
    const result = await f.dependencies.run(command, args, options);
    if (command === 'gh' && args[0] === 'api' && suppressCheck) {
      const endpoint = args.find(x => x.startsWith('repos/'));
      const sha = endpoint.match(/\/commits\/([a-f0-9]{40})\//)[1];
      return output({ total_count: 1, check_runs: [f.providerCheck(sha, 5)] });
    }
    return result;
  };
  const first = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(first.status, 'pending'); assert.equal(first.errorCode, 'PROVIDER_PENDING'); assert.equal(f.counts.pushCount, 1);
  suppressCheck = false; f.setWrongProduction(true);
  const stale = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(stale.status, 'pending'); assert.equal(stale.errorCode, 'SOURCE_PARITY_PENDING');
  assert.equal(stale.evidence.immutable.passed, true); assert.equal(stale.evidence.production.passed, false);
  assert.equal(f.counts.pushCount, 1); assert.equal(f.counts.buildCount, 1);
  f.setWrongProduction(false);
  const recovered = await publishCandidate(f.opts, { ...f.dependencies, run });
  assert.equal(recovered.status, 'deployed'); assert.equal(f.counts.pushCount, 1);
});

test('live observation performs no build, fetch, worktree, or push operations', async t => {
  const f = await fixture(t);
  const result = await observePublishedCommit({ cwd: f.repo, publishedSha: f.base, repository: 'RakeezX/RakeezX', productionUrl: 'https://rakeezx.com' }, f.dependencies);
  assert.equal(result.status, 'verified', JSON.stringify(result)); assert.equal(result.readOnly, true);
  assert.equal(f.counts.buildCount, 0); assert.equal(f.counts.pushCount, 0);
  assert.ok(f.calls.filter(c => c.command === 'git').every(c => ['ls-remote', 'show'].includes(c.args[0])));
  await f.assertCanonicalPreserved();
});

test('only the exact observed Cloudflare JSD injection can be normalized', () => {
  const original = '<html><body>ركيز — original bytes</body></html>\r\n';
  for (const script of [jsdFixture, jsdFixture.replace('a494e9a129572c49', '111122223333abcd').replace('MTc5MTc5NTYwOQ==', 'MTgwMDAwMDAwMA==')]) {
    const injected = Buffer.from(original.replace('</body>', script + '</body>'));
    const result = normalizeCloudflareIndex(injected, indexMetadata);
    assert.equal(result.normalization, 'cloudflare-jsd-v1');
    assert.equal(result.normalizedSha256, sha256(original));
    assert.equal(result.normalizedBytes, Buffer.byteLength(original));
    assert.equal(result.removedProviderBytes, Buffer.byteLength(script));
    assert.notEqual(sha256(injected), result.normalizedSha256);
  }
});

test('normalization refuses changed scripts, duplicate injections, other assets, and challenge pages', () => {
  const page = script => Buffer.from('<html><body>ركيز' + script + '</body></html>');
  for (const script of [
    jsdFixture.replace('a.height=1', 'a.height=2'),
    jsdFixture.replace('/scripts/jsd/main.js', '/scripts/jsd/other.js'),
    jsdFixture + jsdFixture,
    jsdFixture + '\n',
    jsdFixture.replace('MTc5MTc5NTYwOQ==', 'YWJjZGVmZ2hpag=='),
  ]) assert.equal(normalizeCloudflareIndex(page(script), indexMetadata), null);
  for (const overrides of [
    { statusCode: 403 }, { statusCode: 503 }, { server: 'other' },
    { repoPath: 'src/view.js' }, { urlPath: 'other.html' },
    { contentType: 'text/plain' }, { mitigated: 'challenge' },
  ]) assert.equal(normalizeCloudflareIndex(page(jsdFixture), { ...indexMetadata, ...overrides }), null);
  const changedApp = normalizeCloudflareIndex(Buffer.from(page(jsdFixture).toString().replace('ركيز', 'مغاير')), indexMetadata);
  assert.notEqual(changedApp.normalizedSha256, sha256(page('')));
});

test('observation retains raw HTML proof and accepts only matching normalized application bytes', async t => {
  const f = await fixture(t);
  const request = { cwd: f.repo, publishedSha: f.base, repository: 'RakeezX/RakeezX', productionUrl: 'https://rakeezx.com' };
  let alterApplication = false;
  const fetcher = async input => {
    const response = await f.dependencies.fetch(input);
    if (new URL(input).hostname !== 'rakeezx.com' || new URL(input).pathname !== '/index.html') return response;
    let body = (await response.text()).replace('</body>', jsdFixture + '</body>');
    if (alterApplication) body = body.replace('Rakeez fixture', 'Wrong application');
    return new Response(body, { status: 200, headers: { server: 'cloudflare', 'content-type': 'text/html; charset=UTF-8' } });
  };
  const accepted = await observePublishedCommit(request, { ...f.dependencies, fetch: fetcher });
  assert.equal(accepted.status, 'verified', JSON.stringify(accepted));
  const index = accepted.evidence.production.assets.find(asset => asset.repoPath === 'index.html');
  assert.equal(index.verified, true); assert.equal(index.normalization, 'cloudflare-jsd-v1');
  assert.equal(index.expectedSha256, index.normalizedSha256);
  assert.notEqual(index.expectedSha256, index.observedSha256);
  assert.ok(accepted.evidence.immutable.assets.every(asset => !asset.normalization));
  alterApplication = true;
  const rejected = await observePublishedCommit(request, { ...f.dependencies, fetch: fetcher });
  assert.equal(rejected.status, 'pending');
  assert.equal(rejected.evidence.production.passed, false);
  assert.equal(rejected.evidence.production.assets.find(asset => asset.repoPath === 'index.html').verified, false);
  assert.equal(f.counts.buildCount, 0); assert.equal(f.counts.pushCount, 0);
});
