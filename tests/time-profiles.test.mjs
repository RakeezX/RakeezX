import test from 'node:test';
import assert from 'node:assert';
import { generateAdvancedPeriods } from '../src/models.js';

test('Time Profiles: Summer profile generates correct periods for grades 4, 5-6 and default', (t) => {
  const summerConfig = {
    type: 'summer',
    assembly: { enabled: true, start: '06:45', duration: 15 },
    firstPeriodStart: '07:00', periodDuration: 45, count: 7,
    recess: {
      enabled: true, duration: 20, transition: 5,
      rules: [{ grades: [4], afterPeriod: 2 }, { grades: [5, 6], afterPeriod: 3 }]
    }
  };

  const periods = generateAdvancedPeriods(summerConfig);

  // Grade 4 P3 should start after 25m break after P2 (which ends at 08:30)
  // Grade 5-6 P3 should start immediately after P2 (at 08:30)
  
  const p3G4 = periods.find(p => p.period === 3 && p.grades?.includes(4));
  const p3Default = periods.find(p => p.period === 3 && !p.grades);

  assert.strictEqual(p3G4.start, '08:55', 'G4 P3 starts at 08:55 (after 25m break)');
  assert.strictEqual(p3G4.end, '09:40', 'G4 P3 ends at 09:40');

  assert.strictEqual(p3Default.start, '08:30', 'Default P3 starts at 08:30 (no break yet)');
  assert.strictEqual(p3Default.end, '09:15', 'Default P3 ends at 09:15');

  // All converge at P4, so P4 should have no 'grades' specific filter (it should be default)
  const p4 = periods.find(p => p.period === 4 && !p.grades);
  assert.ok(p4, 'P4 converges to a common time for all');
  assert.strictEqual(p4.start, '09:40', 'P4 starts at 09:40 for everyone');
  assert.strictEqual(p4.end, '10:25', 'P4 ends at 10:25 for everyone');
});

test('Time Profiles: Ramadan profile generates flat periods', (t) => {
  const ramadanConfig = {
    type: 'ramadan',
    assembly: { enabled: false },
    firstPeriodStart: '09:00', periodDuration: 35, count: 5,
    recess: { enabled: true, duration: 10, transition: 0, afterPeriod: 3 }
  };

  const periods = generateAdvancedPeriods(ramadanConfig);

  const p1 = periods.find(p => p.period === 1);
  assert.strictEqual(p1.start, '09:00');
  assert.strictEqual(p1.end, '09:35');

  // P3 ends at 10:10 + 35 = 10:45. Break is 10 mins. P4 starts 10:55
  const p4 = periods.find(p => p.period === 4);
  assert.strictEqual(p4.start, '10:55');
});
