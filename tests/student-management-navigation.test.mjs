import assert from 'node:assert/strict';
import test from 'node:test';
import { studentManagementSuccessDestination } from '../src/views/student.js';

const teaching = { id: 'teaching:origin', sectionId: 'section:shared' };

test('both successful lifecycle outcomes return to the originating Teaching roster', () => {
  for (const action of ['delete', 'end']) {
    assert.equal(
      studentManagementSuccessDestination(action, teaching, 'section:shared'),
      '#/teaching/teaching:origin/students',
    );
    assert.equal(
      studentManagementSuccessDestination(action, { id: 'teaching:other', sectionId: 'section:shared' }, 'section:shared'),
      '#/teaching/teaching:other/students',
      'shared Section identity must not replace the explicit Teaching origin',
    );
  }
});

test('missing, mismatched, or archived Teaching origin uses the Classes fallback', () => {
  for (const action of ['delete', 'end']) {
    assert.equal(studentManagementSuccessDestination(action, null, 'section:shared'), '#/classes');
    assert.equal(studentManagementSuccessDestination(action, teaching, 'section:other'), '#/classes');
    assert.equal(studentManagementSuccessDestination(action, teaching, undefined), '#/classes');
    assert.equal(studentManagementSuccessDestination(action, teaching, 'section:shared', true), '#/classes');
  }
});

test('dismissal and unsuccessful outcomes do not navigate', () => {
  for (const action of [undefined, null, 'transfer', 'error']) {
    assert.equal(studentManagementSuccessDestination(action, teaching, 'section:shared'), null);
  }
});
