import test from 'node:test';
import assert from 'node:assert/strict';
import { installSessionAutoTriggers, nextSessionBoundary } from '../src/lib/session-auto.js';
import { selectTodayFocus } from '../src/views/home.js';
import * as store from '../src/store.js';

function fakeClock(start) {
  let time = new Date(start).getTime();
  let id = 0;
  const tasks = new Map();
  return {
    now: () => new Date(time),
    setTimeout(fn, delay) { const key = ++id; tasks.set(key, { fn, at: time + delay }); return key; },
    clearTimeout(key) { tasks.delete(key); },
    get size() { return tasks.size; },
    get next() { return Math.min(...[...tasks.values()].map((task) => task.at)); },
    jumpTo(value) { time = new Date(value).getTime(); },
    async advanceTo(value) {
      const target = new Date(value).getTime();
      while (true) {
        const due = [...tasks].sort((a, b) => a[1].at - b[1].at).find(([, task]) => task.at <= target);
        if (!due) break;
        time = due[1].at;
        tasks.delete(due[0]);
        due[1].fn();
        await Promise.resolve();
        await Promise.resolve();
      }
      time = target;
    },
  };
}

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
  const clock = fakeClock('2026-09-06T07:00:00');
  const stop = installSessionAutoTriggers({
    eventTarget: windowEvents, documentTarget: documentEvents,
    getToday: () => today, materialize: async (date) => calls.push(date), now: clock.now, timers: clock,
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
  assert.equal(clock.size, 0);
});

test('one timer follows third and fourth period starts and ends, then midnight', async () => {
  const clock = fakeClock('2026-09-06T09:29:59');
  const calls = [];
  const sessions = [
    { id: 'second', startTime: '08:00', endTime: '08:45', status: 'scheduled' },
    { id: 'third', startTime: '09:30', endTime: '10:15', status: 'scheduled' },
    { id: 'fourth', startTime: '10:20', endTime: '11:05', status: 'scheduled' },
  ];
  const focus = () => {
    const selected = selectTodayFocus(sessions, {
      now: clock.now(),
      attendanceState: (session) => session.id === 'second' ||
        (session.id === 'third' && clock.now() >= new Date('2026-09-06T10:15:00'))
        ? 'completed' : 'pending',
    });
    return selected ? `${selected.kind}:${selected.session.id}` : null;
  };
  const seen = [];
  const stop = installSessionAutoTriggers({
    now: clock.now, timers: clock, getSessions: () => sessions,
    materialize: async (date) => calls.push(date), repaint: () => { calls.push('paint'); seen.push(focus()); },
    eventTarget: events(), documentTarget: events(),
  });
  assert.equal(focus(), 'upcoming:third');
  assert.equal(clock.size, 1);
  assert.equal(clock.next, new Date('2026-09-06T09:30:00').getTime() + 50);
  for (const time of ['09:30:00.050', '10:15:00.050', '10:20:00.050', '11:05:00.050']) {
    await clock.advanceTo(`2026-09-06T${time}`);
    assert.equal(clock.size, 1);
  }
  assert.equal(calls.filter((call) => call === 'paint').length, 4);
  assert.deepEqual(seen, ['current:third', 'upcoming:fourth', 'current:fourth', 'past-pending:fourth']);
  assert.equal(clock.next, new Date('2026-09-07T00:00:00').getTime() + 50);
  stop();
});

test('foreground repairs a throttled timer and store changes replace its boundary', async () => {
  const clock = fakeClock('2026-09-06T09:00:00');
  const windowEvents = events();
  const documentEvents = events();
  const calls = [];
  let refresh;
  let calendarDay = null;
  const sessions = [{ startTime: '10:00', endTime: '10:45', status: 'scheduled' }];
  const stop = installSessionAutoTriggers({
    now: clock.now, timers: clock, getSessions: () => sessions,
    getCalendarDay: () => calendarDay,
    subscribe: (fn) => { refresh = fn; return () => { refresh = null; }; },
    materialize: async (date) => calls.push(date), repaint: () => calls.push('paint'),
    eventTarget: windowEvents, documentTarget: documentEvents,
  });
  sessions[0].startTime = '09:30';
  refresh();
  assert.equal(clock.next, new Date('2026-09-06T09:30:00').getTime() + 50);
  assert.equal(clock.size, 1);
  calendarDay = { kind: 'suspension' };
  refresh();
  assert.equal(clock.next, new Date('2026-09-07T00:00:00').getTime() + 50);
  calendarDay = null;
  refresh();
  clock.jumpTo('2026-09-06T10:10:00'); // Background throttling skipped the start timeout.
  documentEvents.fire('visibilitychange');
  assert.deepEqual(calls, []);
  documentEvents.visibilityState = 'visible';
  documentEvents.fire('visibilitychange');
  await Promise.resolve();
  assert.equal(clock.next, new Date('2026-09-06T10:45:00').getTime() + 50);
  windowEvents.fire('pageshow');
  await Promise.resolve();
  assert.deepEqual(calls.filter((call) => call !== 'paint'), ['2026-09-06', '2026-09-06']);
  assert.equal(clock.size, 1);
  stop();
});

test('local midnight materializes new day; cancellations and non-teaching days skip lesson boundaries', async () => {
  const clock = fakeClock('2026-09-06T23:59:59');
  const calls = [];
  const stop = installSessionAutoTriggers({
    now: clock.now, timers: clock,
    getSessions: () => [{ startTime: '23:59', endTime: '23:59', status: 'cancelled' }],
    materialize: async (date) => calls.push(date), repaint: () => calls.push('paint'),
    eventTarget: events(), documentTarget: events(),
  });
  await clock.advanceTo('2026-09-07T00:00:00.050');
  assert.deepEqual(calls, ['2026-09-07', 'paint']);
  assert.equal(clock.size, 1);
  stop();
  const now = new Date('2026-09-06T09:00:00');
  const rows = [{ startTime: '09:30', endTime: '10:15', status: 'scheduled' }];
  assert.equal(nextSessionBoundary(now, rows, { kind: 'holiday' }), new Date('2026-09-07T00:00:00').getTime());
  assert.equal(nextSessionBoundary(now, [{ ...rows[0], status: 'cancelled_holiday' }]), new Date('2026-09-07T00:00:00').getTime());
});

test('deactivation stops the old scheduler and stale completion cannot write or repaint after remount', async () => {
  const clock = fakeClock('2026-09-06T09:00:00');
  const windowEvents = events();
  const documentEvents = events();
  const writes = [];
  const paints = [];
  let releaseOld;
  let refreshOld;
  let stop = installSessionAutoTriggers({
    now: clock.now, timers: clock, eventTarget: windowEvents, documentTarget: documentEvents,
    subscribe: (fn) => { refreshOld = fn; return () => { refreshOld = null; }; },
    materialize: async (_date, signal) => {
      await new Promise((resolve) => { releaseOld = resolve; });
      if (!signal.aborted) writes.push('old');
    },
    repaint: () => paints.push('old'),
  });
  const unsubscribe = store.onWorkspaceDeactivation(() => { stop?.(); stop = null; });
  windowEvents.fire('pageshow');
  assert.equal(typeof releaseOld, 'function');
  assert.equal(clock.size, 1);

  store.deactivateWorkspace('test-transition');
  assert.equal(stop, null);
  assert.equal(refreshOld, null);
  assert.equal(clock.size, 0);
  assert.equal(windowEvents.count('pageshow'), 0);
  assert.equal(documentEvents.count('visibilitychange'), 0);

  const stopNew = installSessionAutoTriggers({
    now: clock.now, timers: clock, eventTarget: windowEvents, documentTarget: documentEvents,
    materialize: async () => writes.push('new'), repaint: () => paints.push('new'),
  });
  assert.equal(clock.size, 1);
  releaseOld();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(writes, []);
  assert.deepEqual(paints, []);
  windowEvents.fire('pageshow');
  await Promise.resolve();
  assert.deepEqual(writes, ['new']);
  assert.deepEqual(paints, ['new']);
  assert.equal(clock.size, 1);
  stopNew();
  unsubscribe();
});
