// AI: execute only the actual changed copy branch; rendered runner evidence is separate.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile('extensions/rakeez-teacher-import-helper/run-controller.js','utf8');
const line=source.split('\n').find(l=>l.includes("$('run-skipped').textContent=active.excluded?"));assert.ok(line);
function text(excluded,warnings){const els={};vm.runInNewContext(line,{$:id=>els[id]??=( {textContent:''}),active:{excluded},warnings});return els['run-skipped'].textContent;}
assert.equal(text(0,[]),'');assert.equal(text(0,['PAGINATION_MISSING_NEXT']),'');assert.equal(text(0,['ROSTER_LINKS_UNAVAILABLE']),'');
assert.match(text(2,['INVALID_ROWS_EXCLUDED']),/2/);assert.match(text(0,['REPORT_FETCH_FAILED']),/غير محسومة/);
assert.doesNotMatch(text(0,['REPORT_FETCH_FAILED']),/استُبعد 0/);
console.log('PASS actual changed warning-copy branch: uncertainty remains distinct from observed excluded rows');
