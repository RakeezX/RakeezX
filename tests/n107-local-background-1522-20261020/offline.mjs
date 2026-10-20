// AI: targeted startup dependency inventory, not a Service Worker certification.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
const file='src/lib/class-import-background.js', source=await readFile(file,'utf8'), shell=await readFile('sw.js','utf8'), app=await readFile('src/app.js','utf8');
assert.ok(app.includes("import('./lib/class-import-background.js')"));
const dependencies=[file,...[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>relative('.',resolve(dirname(file),m[1])).replaceAll('\\','/'))];
for(const dependency of dependencies){await readFile(dependency);assert.ok(shell.includes("'./"+dependency+"'"),dependency+' absent from existing offline shell');}
const evidence=JSON.parse(await readFile('tests/n107-local-background-1522-20261020/result.json','utf8'));
evidence.checks.push({name:'n107_changed_startup_offline_dependency',status:'PASS',evidence:'App account startup installs global coordinator; new module and all '+(dependencies.length-1)+' direct source imports exist in the existing offline shell. No Service Worker/offline-cache certification claimed.'});
evidence.offlineDependencies=dependencies;
await writeFile('tests/n107-local-background-1522-20261020/result.json',JSON.stringify(evidence,null,2));console.log('PASS n107_changed_startup_offline_dependency');
