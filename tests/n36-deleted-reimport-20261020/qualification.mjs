// AI: bind affected proof and reuse unchanged 0.5.17 safeguards; no browser rerun.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const base='01940ee3a6fe0f4c79e0ad50c9209662a7ef7517',prior='9a9352a7bc688061589e4f85af2e4820a798bdec',folder='tests/n36-deleted-reimport-20261020/';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const browser=JSON.parse(await fs.readFile(folder+'browser.json','utf8')),reproduction=JSON.parse(await fs.readFile(folder+'reproduction.json','utf8'));
assert.equal(browser.status,'PASS');assert.equal(browser.checks.length,11);assert.deepEqual(browser.errors,[]);
assert.equal(reproduction.reproduction.outcome.failure.code,'CLASS_ARCHIVED_OR_AMBIGUOUS');
const store=await fs.readFile('src/store.js','utf8'),view=await fs.readFile('src/views/class-import-center.js','utf8');
const slice=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to,text.indexOf(from)));
assert.equal(slice(store,'export async function importSetupProfile','/** إعدادات هذا الجهاز'),slice(git('show',prior+':src/store.js'),'export async function importSetupProfile','/** إعدادات هذا الجهاز'));
for(const [from,to] of [['export function installExtensionBridge','async function resumeSavedExtensionBatch'],['function automaticGuard','function automaticPersistedGuard'],['async function receiveExtension','function setupBinding']])assert.equal(slice(view,from,to),slice(git('show',prior+':src/views/class-import-center.js'),from,to));
const untouched=['src/app.js','src/store.js','src/lib/cloud.js','src/lib/sync.js','sw.js','extensions/rakeez-teacher-import-helper','assets/extensions'];
assert.equal(git('diff','--name-only',base,'--',...untouched),'');
assert.match(await fs.readFile('extensions/rakeez-teacher-import-helper/manifest.json','utf8'),/"version": "0\.5\.17"/);
const imports=text=>[...text.matchAll(/(?:^|\n)\s*import\s+.*?(?:from\s*)?['"]([^'"]+)['"]/g)].map(m=>m[1]);
assert.deepEqual(imports(view),imports(git('show',base+':src/views/class-import-center.js')),'No startup dependency added');
execFileSync(process.execPath,['--check','src/views/class-import-center.js']);
const result={status:'PASS',baseSha:base,checks:['Eleven affected actual-app/IndexedDB cases passed; baseline failure preserved','0.5.17 profile transaction/direct receiver/lifetime guard code byte-identical; evidence reused','Extension/package remains 0.5.17 unchanged; no repack or stable updater invocation','No startup imports/SW/app/store/cloud/sync changes; affected JS syntax PASS'],sourceSha256:createHash('sha256').update(await fs.readFile('src/views/class-import-center.js')).digest('hex'),priorEvidence:'tests/n36-actual-save-20261020/browser.json',browserEvidence:folder+'browser.json',liveJourney:'NOT_RUN',publication:'NOT_RUN'};
await fs.writeFile(folder+'qualification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
