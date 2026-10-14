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
    if (command === 'git' && args.includes('push')) {
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
    const sha = url.searchParams.get('__rakeez_delivery') ?? text(await runCommand('git',['--git-dir',remote,'rev-parse','refs/heads/main'],{cwd:repo}));
    const file = url.pathname.slice(1).split('/').map(decodeURIComponent).join('/') || 'index.html';
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

test('public root uses anonymous browser headers and an ops-only advance reuses exact Product build',async t=>{
 const f=await fixture(t);f.setWrongProduction(true);let seen=0;const fetcher=async(url,options)=>{if(new URL(url).pathname==='/'){seen++;assert.match(options.headers['User-Agent'],/Chrome\/154/);assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);assert.equal(new URL(url).search,'');}return f.dependencies.fetch(url,options);};
 const deps={...f.dependencies,fetch:fetcher};const first=await publishCandidate(f.opts,deps);assert.equal(first.errorCode,'SOURCE_PARITY_PENDING');
 const later=path.join(f.root,'ops');await f.git(['worktree','add','--detach',later,first.publishedSha]);await fs.writeFile(path.join(later,'ops-note.txt'),'Ops only');await f.git(['add','ops-note.txt'],later);await f.git(['commit','-m','Ops-only proof update'],later);const head=text(await f.git(['rev-parse','HEAD'],later));assert.equal((await f.dependencies.run('git',['push','origin',head+':refs/heads/main'],{cwd:later})).code,0);f.setWrongProduction(false);
 const counts={...f.counts};const final=await publishCandidate(f.opts,deps);assert.equal(final.status,'deployed',JSON.stringify(final));assert.equal(final.publishedSha,head);assert.equal(final.build.kind,'exact-asset-build-reuse');assert.equal(final.build.reusedFrom,first.publishedSha);assert.equal(f.counts.buildCount,counts.buildCount);assert.equal(f.counts.pushCount,counts.pushCount);assert.equal(final.evidence.production.assets.find(x=>x.repoPath==='index.html').urlPath,'/');assert.ok(seen>=4);await f.assertCanonicalPreserved();
});
