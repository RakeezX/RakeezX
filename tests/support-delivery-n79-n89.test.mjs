import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import vm from 'node:vm';

const PARENT='5ef16b68aa016a252f83c94b8250daabd844d2d2';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const base=path=>execFileSync('git',['show',`${PARENT}:${path}`],{encoding:'utf8',windowsHide:true});
const specifiers=source=>[...source.matchAll(/(?:import(?:\s+[\s\S]*?\s+from\s+|\s*)|import\s*\()(['"])([^'"]+)\1/g)].map(m=>m[2]);
async function omissions(readSource) {
  const visited=new Set();
  async function visit(path){if(visited.has(path))return;visited.add(path);
    for(const spec of specifiers(await readSource(path)).filter(s=>s.startsWith('.'))) {
      const child=posix.normalize(posix.join(posix.dirname(path),spec));if(child.endsWith('.js'))await visit(child);
    }
  }
  await visit('src/app.js');
  const sw=await readSource('sw.js');const cached=new Set([...sw.matchAll(/['"]\.\/(src\/[^'"]+\.js)['"]/g)].map(m=>m[1]));
  return {visited,cached,missing:[...visited].filter(p=>!cached.has(p)).sort()};
}

test('raw entry reaches central config and new graph omission count is zero; five existing omissions remain debt',async()=>{
  const before=await omissions(base),after=await omissions(read);
  const debt=['day-targeting','education-department-directory','hijri-year-input','sync-warning-policy','visible-numerals'].map(n=>`src/lib/${n}.js`).sort();
  assert.deepEqual(before.missing,debt);assert.deepEqual(after.missing,debt);
  assert.ok(after.visited.has('src/lib/support-public-config.js'));assert.ok(after.cached.has('src/lib/support-public-config.js'));
  assert.match(await read('index.html'),/src="(?:\.\/)?src\/app\.js"/);
  // The complete graph still FAILs historically. Equality/dependency registration PASS is bounded.
});

test('minimal SW generation change installs central config and preserves newer/unrelated caches in VM',async()=>{
  const sw=(await read('sw.js')).replaceAll('\r\n','\n'),old=base('sw.js').replaceAll('\r\n','\n');
  assert.equal(sw,old.replace("const VERSION = 'rakeezx-v36';","const VERSION = 'rakeezx-v38';")
    .replace("  './src/lib/support-whatsapp.js',","  './src/lib/support-whatsapp.js',\n  './src/lib/support-public-config.js',"));
  const events={},added=[],deleted=[],keys=['rakeezx-v36','rakeezx-v37','rakeezx-v38','rakeezx-v39','fixture-unrelated'];
  const context=vm.createContext({URL,Request:class {constructor(url){this.url=url;}},console,
    self:{location:{origin:'https://fixture.test'},addEventListener:(name,fn)=>{events[name]=fn;},
      skipWaiting:async()=>{},clients:{claim:async()=>{}}},
    caches:{open:async name=>{assert.equal(name,'rakeezx-v38');return {add:async req=>added.push(req.url)};},
      keys:async()=>keys,delete:async name=>deleted.push(name)},});
  vm.runInContext(sw,context);
  let wait;events.install({waitUntil:p=>{wait=p;}});await wait;
  assert.ok(added.includes('./src/lib/support-public-config.js'));assert.ok(added.includes('./src/lib/support-whatsapp.js'));
  events.activate({waitUntil:p=>{wait=p;}});await wait;assert.deepEqual(deleted,['rakeezx-v36','rakeezx-v37']);
});
