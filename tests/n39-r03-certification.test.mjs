import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesStudentSearch, currentStudentSearchResults } from '../src/lib/student-search-ui.js';

test('N39 matcher preserves normalized substring and ordered token prefixes', () => {
  assert.equal(matchesStudentSearch('محمد أحمد عبدالله', 'أحمد عبد'), true);
  assert.equal(matchesStudentSearch('محمد أحمد عبدالله', 'محمد احمد'), true);
  assert.equal(matchesStudentSearch('محمد أحمد عبدالله', 'مح اح عب'), true);
  assert.equal(matchesStudentSearch('محمد أحمد عبدالله', 'عب مح'), false);
  assert.equal(matchesStudentSearch('محمد أحمد عبدالله', 'غير موجود'), false);
  assert.equal(matchesStudentSearch('محمد أحمد عبدالله', ''), false);
});

test('N39 aggregates by durable identity and excludes former students', () => {
  const one = { id: 'one', name: 'محمد أحمد', status: 'active' };
  const two = { id: 'two', name: 'محمد أحمد', status: 'active' };
  const former = { id: 'former', name: 'محمد أحمد', status: 'former' };
  const teachings = [
    { id: 'arabic', sectionId: 'class', subjectId: 'arabic' },
    { id: 'science', sectionId: 'class', subjectId: 'science' },
  ];
  const source = {
    teachings: () => teachings,
    students: id => id === 'arabic' ? [one, two, former] : [one, two, former],
    getSection: id => ({ id }),
    sectionLabel: section => section.id,
    getSubject: id => ({ name: id }),
  };
  assert.deepEqual(currentStudentSearchResults('', source), []);
  const matches = currentStudentSearchResults('محمد', source);
  assert.deepEqual(matches.map(({ student }) => student.id), ['one', 'two']);
  assert.deepEqual(matches.map(({ contexts }) => contexts.map(({ teaching }) => teaching.id)), [
    ['arabic', 'science'], ['arabic', 'science'],
  ]);
});
