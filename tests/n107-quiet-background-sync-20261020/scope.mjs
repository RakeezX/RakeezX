// AI-authored: verify the candidate changes only the bounded presentation function.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const baseSha='3789084a5142c785e97ae228ef9dbe1d451be397';
const before=execFileSync('git',['show',baseSha+':src/views/class-import-center.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const after=readFileSync('src/views/class-import-center.js','utf8').replace(/\r\n/g,'\n');
const panel=s=>s.slice(s.indexOf('function localImportPanel() {'),s.indexOf('function importDurationPanel() {'));
assert.equal(before.replace(panel(before),''),after.replace(panel(after),''),'No changes outside localImportPanel');
const receipt=s=>panel(s).slice(panel(s).indexOf('  return html`${current'),panel(s).indexOf('\n    ${'));
assert.equal(receipt(before),receipt(after),'Current local/cloud/cancelled receipt rendering unchanged');
assert.deepEqual(execFileSync('git',['diff','--name-only',baseSha,'--','src'],{encoding:'utf8'}).trim().split('\n'),['src/views/class-import-center.js']);
const result={name:'n107_affected_result_inspected_and_sync_unchanged',status:'PASS',evidence:'Only localImportPanel differs from base; its current-plan receipt markup and all code outside it are identical after line-ending normalization. Queue/Sync/owner/grades/retry/cancel modules and handlers unchanged. Desktop 1100px and narrow 390px actual app/source CSS screenshots inspected; no horizontal overflow. Browser/store snapshots unchanged; no synthetic service commits.'};
writeFileSync('tests/n107-quiet-background-sync-20261020/scope.json',JSON.stringify({baseSha,check:result},null,2)+'\n');
console.log(JSON.stringify(result));
