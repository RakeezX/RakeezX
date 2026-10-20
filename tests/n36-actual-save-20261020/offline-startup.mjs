// AI: certify only dependencies made eager by the new shell receiver.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
const base='7a68241d47c4501b224ac237a36e9d44c4a377ea';
const imports=text=>[...text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^;'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(m=>m[1]);
async function closure(entry,override){const seen=new Set();async function visit(file){if(seen.has(file))return;seen.add(file);const text=file==='src/app.js'&&override?override:await fs.readFile(file,'utf8');for(const spec of imports(text)){if(!spec.startsWith('.'))continue;await visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),spec.split('?')[0])));}}await visit(entry);return seen;}
const old=await closure('src/app.js',execFileSync('git',['show',base+':src/app.js'],{encoding:'utf8'}));
const current=await closure('src/app.js'),added=[...current].filter(f=>!old.has(f));
const shell=await fs.readFile('sw.js','utf8');for(const file of added)assert.ok(shell.includes("'./"+file+"'"),'Missing offline shell dependency: '+file);
const result={status:'PASS',newEagerDependencies:added,scope:'Static dependency closure newly added by app-shell receiver; each exact resource remains in existing offline SHELL. No live SW/cache certification.'};
await fs.writeFile('tests/n36-actual-save-20261020/offline-startup.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
