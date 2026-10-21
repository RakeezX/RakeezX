/** AI: public source-only exact reconstruction payload; never credentials/config values. */
import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
const base='e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3',lf=s=>s.replaceAll('\r\n','\n'),show=p=>lf(execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:2097152}));
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const old=show('drafts/n88-student-portal/cloudflare-entry.mjs'),next=lf(await readFile('drafts/n88-student-portal/cloudflare-entry.mjs','utf8'));
const block=s=>s.slice(s.indexOf('      const reply=JSON.parse'),s.indexOf('      if(responseRegion)out.set'));
const compiled=async s=>(await esbuild.transform('async function bridge(){\n'+s+'\n}',{target:'es2022',format:'esm'})).code.replace(/^async function bridge\(\) \{\n/,'').replace(/\n\}\n$/,'').split('\n').map(l=>'    '+l).join('\n');
const protocol=lf(await readFile('drafts/n88-student-portal/web-protocol.mjs','utf8'));
process.stdout.write(JSON.stringify({student:lf(await readFile('drafts/n88-student-portal/activation/bundle/private/assets/student.mjs','utf8')),helpers:protocol.slice(protocol.indexOf('// AI: finite successful-GET')).replaceAll('export ','')+'\n',oldBlock:await compiled(block(old)),newBlock:await compiled(block(next)),wire:'const wire = new Headers({ "content-type": "application/json" });',wireExtra:'\n      if (request.method === "GET" && url.pathname === "/api/n88/student/read") wire.set("x-n88-read-phase-version", "1");'}));
