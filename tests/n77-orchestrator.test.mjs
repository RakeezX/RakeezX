import test from 'node:test';
import assert from 'node:assert/strict';
import { executeN77 } from './n77-live/orchestrator.mjs';

function adapter(failure) {
  const calls = [];
  const hit = name => { calls.push(name); if (name === failure) throw new Error(name); };
  return { calls, deploy: async p => hit('deploy:' + p), probe: async p => hit('probe:' + p),
    inspectAbsent: async () => hit('inspect'), provision: async () => hit('provision'),
    signIn: async () => hit('signIn'), runGate: async () => { hit('gate'); return 'PASS'; },
    retire: async () => { hit('retire'); return 'RETAINED_BANNED'; },
    disarm: async p => hit('disarm:' + p), verifyDisarm: async () => { hit('verify'); return true; } };
}

test('cleanup is deployed/probed before create; every uncertain create/sign-in/gate enters exact retirement', async () => {
  for (const fail of [null, 'provision', 'signIn', 'gate']) {
    const a = adapter(fail), r = await executeN77(a);
    assert.deepEqual(a.calls.slice(0, 6), ['deploy:cleanup-only','probe:cleanup-only',
      'deploy:provision','probe:provision','inspect','provision']);
    assert.equal(r.disposition, 'RETAINED_BANNED'); assert.equal(r.disarmed, true);
  }
});
test('unconfirmed retirement keeps cleanup armed and records same-run recovery; no silent second pair', async () => {
  const a = adapter('retire'), r = await executeN77(a);
  assert.equal(r.disarmed, false); assert.equal(r.recovery, 'retire');
  assert.equal(a.calls.some(c => c.startsWith('disarm:')), false);
});
