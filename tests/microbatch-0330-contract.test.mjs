import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const current=readFileSync('src/app.js','utf8').replace(/\r\n/g,'\n');
const original=execFileSync('git',['show','115ee3a14b934fd206c2ccba2f45e89f9c3c2001:src/app.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
function block(source,start,end){const offset=source.indexOf(start);assert(offset>=0);const finish=source.indexOf(end,offset);assert(finish>offset);return source.slice(offset,finish);}
test('Micro-Batch 02 preserves exact profile save/provisioning/logout handler block',()=>{
 const handler=s=>block(block(s,'function renderFirstAccountProfile(','async function mountAndRunInitialRestore()'),'  const form =','\n}\n');
 assert.equal(handler(current),handler(original));
});
test('Micro-Batch 02 preserves unified OTP and account/Demo action handlers',()=>{
 assert.equal(block(current,'function openMiniHubLoginSheet(','function mountWorkspaceGate('),block(original,'function openMiniHubLoginSheet(','function mountWorkspaceGate('));
 const handlers=s=>block(s,'  app.querySelector(\'[data-workspace-login]\')','/** أفعال متاحة في كل الشاشات. */');
 assert.equal(handlers(current),handlers(original));
});
