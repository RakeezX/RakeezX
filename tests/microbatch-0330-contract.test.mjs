import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const current=readFileSync('src/app.js','utf8').replace(/\r\n/g,'\n');
const original=execFileSync('git',['show','962c26158fe59000889da1c54ac859cf2c08a864:src/app.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
function block(source,start,end){const offset=source.indexOf(start);assert(offset>=0);const finish=source.indexOf(end,offset);assert(finish>offset);return source.slice(offset,finish);}
test('Micro-Batch 02 preserves exact profile save/provisioning/logout handler block',()=>{
 const handler=s=>block(block(s,'function renderFirstAccountProfile(','async function mountAndRunInitialRestore()'),'  const form =','\n}\n');
 assert.equal(handler(current),handler(original));
});
test('Micro-Batch 02 keeps one OTP controller and the account-free Demo route',()=>{
 const controller=block(current,'function mountEmailOtpController(','function openMiniHubLoginSheet(');
 assert.match(controller,/cloud\.requestEmailOtp\(email\)/);
 assert.match(controller,/cloud\.verifyEmailOtp\(selectedEmail, token\)/);
 const sheet=block(current,'function openMiniHubLoginSheet(','function mountWorkspaceGate(');
 assert.match(sheet,/openSheet\(/);
 assert.match(sheet,/mountEmailOtpController\(root, done, \{ reloadOnSuccess \}\)/);
 const gate=block(current,'function mountWorkspaceGate(','/** أفعال متاحة في كل الشاشات. */');
 assert.match(gate,/mountEmailOtpController\(app, \(\) => \{\}, \{ reloadOnSuccess: true, inline: true \}\)/);
 assert.match(gate,/requestDemo\(\);\s*location\.reload\(\)/);
});
