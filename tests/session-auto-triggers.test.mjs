import test from 'node:test';
import assert from 'node:assert/strict';
import { installSessionAutoTriggers } from '../src/lib/session-auto.js';

function events() {
  const listeners = new Map();
  return {
    visibilityState: 'hidden',
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    fire(name) { listeners.get(name)?.(); },
    count(name) { return listeners.has(name) ? 1 : 0; },
  };
}

test('SESSION-AUTO foreground triggers use the rollover date without polling or duplicate listeners', async () => {
  const windowEvents = events();
  const documentEvents = events();
  let today = '2026-09-06';
  const calls = [];
  const stop = installSessionAutoTriggers({
    eventTarget: windowEvents, documentTarget: documentEvents,
    getToday: () => today, materialize: async (date) => calls.push(date),
  });
  assert.equal(windowEvents.count('pageshow'), 1);
  assert.equal(documentEvents.count('visibilitychange'), 1);
  windowEvents.fire('pageshow');
  await Promise.resolve();
  today = '2026-09-09';
  documentEvents.visibilityState = 'visible';
  documentEvents.fire('visibilitychange');
  await Promise.resolve();
  assert.deepEqual(calls, ['2026-09-06', '2026-09-09']);
  stop();
  assert.equal(windowEvents.count('pageshow'), 0);
  assert.equal(documentEvents.count('visibilitychange'), 0);
});
