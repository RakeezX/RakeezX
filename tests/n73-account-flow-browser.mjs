import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { withIsolatedLocalBrowser } from '../../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';
import { openReadyServedDemo } from './helpers/served-demo-readiness.mjs';
import { syntheticService, owner, foreignOwner, source, target, second } from './n73-account-flow-fixture.mjs';

const reproduce = process.argv.includes('--reproduce');
const root = resolve('.'), output = 'test-results/n73-owner-preflight';
const checks = [];
let service = syntheticService();
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/__n73/')) {
      let body = ''; for await (const chunk of req) body += chunk;
      const result = await service.request(pathname.slice('/__n73/'.length), JSON.parse(body || '{}'));
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.'+decodeURIComponent(pathname));
    if (!file.startsWith(root+sep)) throw new Error('Outside application root');
    res.setHeader('Content-Type', { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2' }[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch (error) { res.writeHead(error.status ?? 404, { 'Content-Type':'application/json' }); res.end(JSON.stringify({ message:error.message, code:error.code, status:error.status })); }
});
await mkdir(output, { recursive:true });
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:'+server.address().port;
const taskFile = process.env.N73_TASK_FILE ?? 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n73-owner-preflight-20261013.json';
const runId = process.env.N73_RUN_ID ?? '901fe1a1-686e-400a-bf92-4be9504dfb41';
async function accountPage(createContext, width = 390) {
  service = syntheticService();
  const context = await createContext({ viewport:{ width, height:844 }, locale:'ar-SA', timezoneId:'Asia/Riyadh' });
  await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
  const page = await context.newPage();
  await openReadyServedDemo(page, base);
  const account = await page.evaluate(async () => (await import('/tests/n73-account-flow-fixture.mjs')).prepareAccount());
  assert.equal(account.ready, true); assert.equal(account.lease.editable, true); assert.deepEqual(account.outbox, []);
  return { page, context, account };
}
async function openCopy(page) {
  await page.goto(base+'/#/teaching/'+source+'/items');
  await page.waitForFunction(() => !document.querySelector('[data-act="copy"]')?.disabled);
  await page.locator('[data-act="copy"]').click();
}
async function select(page, ids) {
  for (const id of ids) await page.locator('[data-copy-target][value="'+id+'"]').check();
  await page.waitForFunction(() => !document.querySelector('[data-copy-apply]')?.disabled);
}
async function confirm(page) {
  await page.locator('[data-copy-apply]').click();
  await page.getByRole('button', { name:'تأكيد التطبيق', exact:true }).click();
}
try {
  await withIsolatedLocalBrowser({ taskFile, runId, url:base, timeoutMs:120000 }, async ({ createContext }) => {
    const { page, context } = await accountPage(createContext);
    try {
      const result = await page.evaluate(async ({ source, target }) => {
        const store = await import('/src/store.js');
        const { runtimeSyncOwnershipGuard: guard } = await import('/src/lib/sync-ownership.js');
        const access = guard.cloudAccess({ operation:'dispatch', authenticatedUserId:store.getActiveWorkspace().authUserId });
        const promise = store.reviewScoreDistributionCopy(source, [target]);
        try { return { access, async:promise instanceof Promise, plan:await promise }; }
        catch (error) { return { access, async:promise instanceof Promise, error:error.message }; }
      }, { source, target });
      assert.equal(result.access.reason, 'command-owner-missing'); assert.equal(result.async, true);
      if (reproduce) {
        assert.equal(result.error, 'تعذّر التحقق من ملكية مساحة العمل.'); assert.equal(service.evidence.plans.length, 0);
        await openCopy(page);
        await page.locator('[data-copy-target][value="'+target+'"]').check();
        await page.getByRole('alert').filter({ hasText:'تعذّر التحقق من ملكية مساحة العمل.' }).waitFor();
        assert.equal(await page.locator('[data-copy-apply]').isDisabled(), true);
        await page.screenshot({ path:output+'/before.png', fullPage:true });
        checks.push({ name:'n73_owner_preflight_reproduction', status:'PASS', evidence:'Unchanged base actual store + runtime guard + account UI reproduce command-owner-missing and exact Arabic error; matching auth/workspace, valid N49 lease, syncEligible, clean outbox; zero plan/apply HTTP calls.' });
      } else {
        assert.equal(result.error, undefined); assert.equal(result.plan.targets.length, 1);
        checks.push({ name:'n73_owner_preflight_fixed_store', status:'PASS', evidence:'Actual account store returns Promise resolving one-target review; ownerless dispatch remains command-owner-missing.' });
      }
    } finally { await context.close(); }
    if (reproduce) return;

    for (const width of [390,1280]) {
      const { page, context } = await accountPage(createContext, width);
      try {
        await openCopy(page);
        assert.equal(await page.locator('[data-copy-target]:checked').count(), 0);
        await select(page, width === 390 ? [target,second] : [target]);
        assert.equal(await page.locator('[data-copy-review] details').getAttribute('open'), null);
        await page.locator('[data-copy-review] summary').click();
        assert.equal(await page.locator('[data-copy-remove]:checked').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+2), false);
        await page.screenshot({ path:output+'/'+width+'-review.png', fullPage:true });
        const before = await page.evaluate(async () => (await import('/src/lib/db.js')).getAll('scores'));
        assert.equal(before.find(row => row.id === 'n73-cap').value, 23);
        await confirm(page);
        await page.getByText('طُبّق التوزيع على الفصول المحددة', { exact:true }).waitFor();
        await page.waitForFunction(async () => (await (await import('/src/lib/db.js')).get('scores','n73-cap'))?.value === 20);
        const after = await page.evaluate(async () => {
          const db = await import('/src/lib/db.js'); return { scores:await db.getAll('scores'), items:await db.getAll('items'), outbox:await db.getAll('outbox') };
        });
        assert.equal(after.scores.find(row => row.id === 'n73-valid').value, 18);
        assert.equal(after.scores.find(row => row.id === 'n73-extra-score').value, 4);
        assert.equal(after.scores.find(row => row.id === 'n73-source-score').value, 19);
        assert.equal(after.items.find(row => row.id === 'n73-extra').deleted, false);
        assert.equal(after.items.filter(row => row.teachingId === second).length, width === 390 ? 1 : 0,
          JSON.stringify({ plans:service.evidence.plans, serverItems:service.current.items, localItems:after.items }));
        assert.equal(after.scores.filter(row => after.items.filter(item => item.teachingId === second).some(item => item.id === row.itemId)).length, 0);
        assert.deepEqual(after.outbox, []); assert.equal(service.evidence.commits, 1);
        checks.push({ name:'n73_actual_account_review_apply_'+width, status:'PASS', evidence:'Actual served application DOM/CSS review → confirmation → store → owner-bound durable Sync dispatch → canonical HTTP receipt: selected '+(width===390?'two targets':'one target')+'; 23→20, 18/extra4/source19 preserved; no copied source grades, clean outbox.' });
      } finally { await context.close(); }
    }

    for (const scenario of ['auth-mismatch','workspace-mismatch','unauthenticated','unknown-context',
      'sync-ineligible','claim-recovery','cloud-restore','expired-lease','read-only-lease','pending-outbox',
      'ownerless-dispatch','foreign-dispatch']) {
      const { page, context } = await accountPage(createContext);
      try {
        const result = await page.evaluate(async ({ scenario, owner, foreignOwner, source, target }) => {
          const store = await import('/src/store.js'), cloud = await import('/src/lib/cloud.js'), db = await import('/src/lib/db.js');
          const { runtimeSyncOwnershipGuard: guard } = await import('/src/lib/sync-ownership.js');
          const { createSyncV2Engine } = await import('/src/lib/sync-v2.js');
          const { LEASE_STORAGE_PREFIX } = await import('/src/lib/offline-lease.js');
          const plan = await store.reviewScoreDistributionCopy(source, [target]);
          const workspace = store.getActiveWorkspace();
          const before = { items:await db.getAll('items'), scores:await db.getAll('scores') };
          const engine = createSyncV2Engine({ ownershipGuard:guard, currentAuthenticatedUserId:() => cloud.user?.id });
          const auth = id => {
            const session = { access_token:'synthetic-local-only', user:{ id } };
            localStorage.setItem(cloud.AUTH_STORAGE_KEY, JSON.stringify(session)); cloud.setMockAuth(session.user,session);
          };
          if (scenario === 'auth-mismatch') auth(foreignOwner);
          if (scenario === 'workspace-mismatch') guard.setWorkspace({ ...workspace, authUserId:foreignOwner });
          if (scenario === 'unauthenticated') { cloud.setMockAuth(null,null); localStorage.removeItem(cloud.AUTH_STORAGE_KEY); }
          if (scenario === 'unknown-context') store.deactivateWorkspace();
          if (scenario === 'sync-ineligible') store.activateWorkspace({ ...workspace, syncEligible:false });
          if (scenario === 'claim-recovery') store.setWorkspaceClaimInProgress(true);
          if (scenario === 'cloud-restore') store.setCloudRestoreInProgress(true);
          if (scenario === 'read-only-lease') localStorage.removeItem(LEASE_STORAGE_PREFIX+workspace.id);
          if (scenario === 'pending-outbox' || scenario.endsWith('-dispatch')) {
            const queued = await engine.queueCommand({ store:'items', recordId:source, command:'score:distribution_apply', patch:{ planId:plan.planId,token:plan.token,confirmed:true } });
            if (scenario.endsWith('-dispatch')) {
              await db.put('outbox', { ...queued, ownerId:scenario === 'ownerless-dispatch' ? null : foreignOwner });
              return { dispatch:await engine.dispatchPending(), pending:await db.getAll('outbox') };
            }
          }
          // Expiry is applied by the test's clock before the two public calls.
          if (scenario === 'expired-lease') return { plan, before };
          const failures = [];
          for (const call of [() => store.reviewScoreDistributionCopy(source,[target]),
            () => store.applyReviewedScoreDistribution(source,[target],{ expectedToken:plan.token,confirmed:true })]) {
            try { await call(); failures.push(null); } catch (error) { failures.push({ message:error.message,code:error.code }); }
          }
          const after = scenario === 'unknown-context' ? before : { items:await db.getAll('items'), scores:await db.getAll('scores') };
          return { failures, unchanged:JSON.stringify(before) === JSON.stringify(after) };
        }, { scenario, foreignOwner, source, target });
        if (scenario === 'expired-lease') {
          await page.clock.setFixedTime(new Date(Date.now()+15*86400000));
          const expired = await page.evaluate(async ({ source,target,token }) => {
            const s = await import('/src/store.js'); const errors = [];
            for (const call of [() => s.reviewScoreDistributionCopy(source,[target]),
              () => s.applyReviewedScoreDistribution(source,[target],{ expectedToken:token,confirmed:true })]) {
              try { await call(); errors.push(null); } catch (error) { errors.push(error.code); }
            }
            return { errors, lease:s.getOfflineLeaseStatus() };
          }, { source,target,token:result.plan.token });
          assert.deepEqual(expired.errors, ['OFFLINE_LEASE_LIMITED','OFFLINE_LEASE_LIMITED']);
          assert.equal(expired.lease.reason, 'expired');
        } else if (scenario.endsWith('-dispatch')) {
          assert.equal(result.dispatch.attempted, 0); assert.equal(result.dispatch.ownershipBlocked, 1);
          assert.equal(result.dispatch.blockReason, scenario === 'ownerless-dispatch' ? 'command-owner-missing' : 'command-owner-mismatch');
        } else {
          assert.equal(result.failures.length, 2); assert.ok(result.failures.every(Boolean), JSON.stringify({ scenario,result }));
          assert.equal(result.unchanged, true);
        }
        assert.equal(service.evidence.envelopes.length, 0); assert.equal(service.evidence.commits, 0);
        checks.push({ name:'n73_fail_closed_'+scenario, status:'PASS', evidence:'Actual public store review/apply or durable engine dispatch rejects synthetic '+scenario+'; zero HTTP mutation attempts/commits.' });
      } finally { await context.close(); }
    }

    for (const mode of ['plan-failed','stale-review','stale-apply','lost-receipt']) {
      const { page, context } = await accountPage(createContext);
      try {
        await openCopy(page);
        if (mode === 'plan-failed') {
          service.setMode(mode);
          await page.locator('[data-copy-target][value="'+target+'"]').check();
          await page.getByRole('alert').filter({ hasText:'Synthetic plan unavailable' }).waitFor();
          assert.equal(await page.locator('[data-copy-apply]').isDisabled(), true);
        } else {
          await select(page,[target,second]);
          service.setMode(mode);
          await page.locator('[data-copy-apply]').click();
          if (mode === 'stale-review') {
            await page.getByText('تغيّر التوزيع منذ المراجعة. افتح المراجعة من جديد.', { exact:true }).waitFor();
            assert.equal(await page.getByRole('button',{ name:'تأكيد التطبيق',exact:true }).count(), 0);
          } else {
            await page.getByRole('button',{ name:'تأكيد التطبيق',exact:true }).click();
            if (mode === 'stale-apply') {
              await page.getByText('تغيّر التوزيع أو تعذّر قبول التطبيق؛ راجع التغييرات قبل المحاولة الجديدة.',{ exact:true }).waitFor();
              const pending = await page.evaluate(async () => (await import('/src/lib/db.js')).getAll('outbox'));
              assert.equal(pending[0].state, 'rejected');
            } else {
              await page.getByText('تعذّر تأكيد التطبيق. طلبك محفوظ للمزامنة وإعادة المحاولة الآمنة.',{ exact:true }).waitFor();
              assert.equal(service.evidence.commits, 1);
              const retried = await page.evaluate(async () => {
                const { createSyncV2Engine } = await import('/src/lib/sync-v2.js');
                const { runtimeSyncOwnershipGuard } = await import('/src/lib/sync-ownership.js');
                const cloud = await import('/src/lib/cloud.js'), db = await import('/src/lib/db.js');
                const result = await createSyncV2Engine({ ownershipGuard:runtimeSyncOwnershipGuard,currentAuthenticatedUserId:() => cloud.user?.id }).dispatchPending();
                return { result, outbox:await db.getAll('outbox'), score:await db.get('scores','n73-cap'), items:await db.getAll('items') };
              });
              assert.equal(retried.result.acknowledged, 1); assert.deepEqual(retried.outbox, []);
              assert.equal(retried.score.value, 20); assert.equal(retried.items.filter(row => row.teachingId === second).length, 1);
              assert.deepEqual(service.evidence.envelopes[0], service.evidence.envelopes[1]);
              assert.equal(service.evidence.commits, 1);
            }
          }
        }
        if (mode !== 'lost-receipt') assert.equal(service.evidence.commits, 0);
        if (['plan-failed','stale-review'].includes(mode)) assert.equal(service.evidence.envelopes.length, 0);
        await page.screenshot({ path:output+'/'+mode+'.png',fullPage:true });
        checks.push({ name:'n73_account_'+mode, status:'PASS', evidence:'Actual account UI shows '+mode+' distinctly; '+(mode==='lost-receipt'?'real engine retries exact accepted durable envelope; one server commit, canonical adoption, no duplicate items.':'no server commits.') });
      } finally { await context.close(); }
    }
  });
} finally {
  server.closeAllConnections(); await new Promise(done => server.close(done));
  const fileHashes = {};
  for (const path of ['src/store.js','src/views/items.js','src/lib/sync-ownership.js','tests/n73-account-flow-browser.mjs','tests/n73-account-flow-fixture.mjs']) {
    fileHashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  await writeFile(output+'/'+(reproduce?'reproduction':'result')+'.json', JSON.stringify({ base, taskFile, runId,
    sha:execFileSync('git',['rev-parse','HEAD'],{ encoding:'utf8' }).trim(), fileHashes, checks }, null, 2));
  console.log(JSON.stringify(checks));
}
