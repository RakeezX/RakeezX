import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const textHash=b=>createHash('sha256').update(b.toString().replace(/\r\n/g,'\n')).digest('hex');
test('source manifest binds actual adapter inputs and preserves old observation method/history',async()=>{
 const m=JSON.parse(await readFile('drafts/n44-push/activation/manual-file-admission-1031/manifest.json'));
 for(const [p,h]of Object.entries(m.inputs))assert.equal(textHash(await readFile(p)),h,p);
 const p='drafts/n44-push/activation/manual-phone-handoff-1031/host.mjs',old=execFileSync('git',['show','36a3e2e98097038bbb33002b3f8e6967ba86426d:'+p]).toString(),current=(await readFile(p,'utf8')).replace(/\r\n/g,'\n');
 assert.equal(current.slice(current.indexOf('  async admit('),current.indexOf('  async admitManualTransfer(')),old.slice(old.indexOf('  async admit('),old.indexOf('  async assemble(')));
 const oldManifest=JSON.parse(execFileSync('git',['show','36a3e2e98097038bbb33002b3f8e6967ba86426d:drafts/n44-push/activation/manual-phone-handoff-1031/manifest.json'])),next=JSON.parse(await readFile('drafts/n44-push/activation/manual-phone-handoff-1031/manifest.json'));delete next.manualFileAdmissionSupplement;assert.deepEqual(next,oldManifest);
 assert.equal(m.actualTransferChannelReady,false);assert.equal(m.latencyVerified,false);assert.equal(m.serviceDeliveryClaim,false);assert.equal(m.uiDeliveryClaim,false);assert.equal(m.operations.actualFileIngestions,0);assert.equal(m.producer.observationArgument,false);
});
