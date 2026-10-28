// AI: local source packaging only. No environment/credential/provider access.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function buildPacket(root=process.cwd()) {
 const original='C:/Users/Abody/Projects/RakeezX/.worktrees/continuous-n44-one-approved-closed-page-push-20261019';
 const baselineDir=path.join(original,'tests/n44-mobile-live-20261027/hosted-readback');
 const packetBytes=await fs.readFile(path.join(baselineDir,'packet.json'));
 assert.equal(sha(packetBytes),'bb6248f9d04c654b47ec1b491b6b3d6e90d8683770edfc94258b451d194eca92');
 const packet=JSON.parse(packetBytes);
 assert.equal(sha(await fs.readFile(path.join(baselineDir,'native-source.zip'))),packet.artifact.archiveSha256);
 const baseline=JSON.parse(await fs.readFile(path.join(baselineDir,'build.json'),'utf8'));
 const map=await fs.readFile(path.join(baselineDir,'bundle/import_map.json'));
 assert.equal(sha(map),baseline.importMapSha256);
 const savedEdge=await fs.readFile(path.join(baselineDir,'bundle/edge.mjs'));
 assert.equal(sha(savedEdge),baseline.edgeSha256);
 assert.equal(baseline.edgeSha256,packet.artifact.entrySha256);
 const compiler=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
 assert.equal(compiler.version,'0.28.1');
 const options={absWorkingDir:root,bundle:true,format:'esm',platform:'neutral',packages:'external',write:false,logLevel:'silent',metafile:true,entryPoints:['supabase/functions/n44-notifications/index.ts']};
 const a=await compiler.build(options),b=await compiler.build(options);
 assert.equal(sha(a.outputFiles[0].contents),sha(b.outputFiles[0].contents));
 const inputs={};
 for(const p of Object.keys(a.metafile.inputs).sort()) {
  assert.ok(/^(drafts\/n44-push\/|src\/|supabase\/functions\/n44-notifications\/)/.test(p));
  assert.ok(!/(^|\/)(\.env|private|custody)(\/|\.|$)/i.test(p));
  assert.ok(/\.(mjs|js|ts|json)$/.test(p));
  execFileSync('git',['ls-files','--error-unmatch','--',p],{cwd:root,stdio:'pipe'});
  inputs[p]=sha(await fs.readFile(path.join(root,p)));
 }
 const out=path.join(root,'artifacts/build/n44-core-packet-1028');
 execFileSync('git',['check-ignore','artifacts/build/n44-core-packet-1028/native-source.zip'],{cwd:root});
 await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'edge.mjs'),a.outputFiles[0].contents);
 await fs.writeFile(path.join(out,'import_map.json'),map);
 const zipScript=`from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_STORED
import sys
p=Path(sys.argv[1])
with ZipFile(p/'native-source.zip','w') as z:
 for name in ('edge.mjs','import_map.json'):
  info=ZipInfo(name,(1980,1,1,0,0,0));info.compress_type=ZIP_STORED
  z.writestr(info,(p/name).read_bytes())
with ZipFile(p/'native-source.zip') as z:
 assert z.namelist()==['edge.mjs','import_map.json']
 for name in z.namelist(): assert z.read(name)==(p/name).read_bytes()
`;
 execFileSync('python',['-c',zipScript,out],{windowsHide:true});
 const first=sha(await fs.readFile(path.join(out,'native-source.zip')));
 execFileSync('python',['-c',zipScript,out],{windowsHide:true});
 assert.equal(first,sha(await fs.readFile(path.join(out,'native-source.zip'))));
 const missing=Object.keys(baseline.sourceInputs).filter(p=>!(p in inputs));
 const changed=Object.keys(baseline.sourceInputs).filter(p=>p in inputs&&baseline.sourceInputs[p]!==inputs[p]);
 const finite=a.outputFiles[0].text.includes('finite-due')&&a.outputFiles[0].text.includes('N44_FINITE_SCHEDULER_JSON');
 assert.ok(finite);
 const publicManifest={schema:1,counts:{inputs:Object.keys(inputs).length,baselineInputs:Object.keys(baseline.sourceInputs).length,missingBaselineInputs:missing.length,changedBaselineInputs:changed.length,archiveEntries:2},hashes:{edge:sha(a.outputFiles[0].contents),archive:first,importMap:sha(map),baselineEdge:sha(savedEdge),inputs:Object.values(inputs),missingBaselineInputs:missing.map(p=>baseline.sourceInputs[p])}};
 await fs.writeFile(path.join(root,'drafts/n44-push/activation/core-v1-packet/manifest.public.json'),JSON.stringify(publicManifest,null,2)+'\n');
 await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify({missing,changed,inputs,finite},null,2)+'\n');
 return {publicManifest,missing,changed,out};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))) {
 const r=await buildPacket();console.log(JSON.stringify({counts:r.publicManifest.counts,archiveSha256:r.publicManifest.hashes.archive,missing:r.missing,changed:r.changed}));
 if(r.missing.length||r.changed.some(p=>!['drafts/n44-push/backend.mjs','drafts/n44-push/existing-host.mjs'].includes(p)))process.exitCode=2;
}
