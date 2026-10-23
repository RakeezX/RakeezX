/** AI: fixed 76/78 transition preparation. No provider, credential, SQL execution or listener. */
import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
export const dir='drafts/n88-student-portal/activation/read-service-20261023/';
const active='drafts/n88-student-portal/',prepared=active+'activation/read-roundtrip-20261023/';
export const hash=s=>createHash('sha256').update(s).digest('hex');
const read=async p=>(await readFile(p,'utf8')).replaceAll('\r\n','\n');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'exact transform preimage');return s.replace(a,b);};
export async function prepare(){
 await mkdir(dir,{recursive:true});
 const m=JSON.parse(await read(prepared+'manifest.json'));
 for(const [p,h]of Object.entries(m.outputs))assert.equal(hash(await read(prepared+p)),h,'prepared '+p);
 const oldContract=JSON.parse(await read(active+'activation/error-boundary-contract.json')),oldIds=JSON.parse(await read(active+'activation/error-boundary-identities.json')),
 newContract=JSON.parse(await read(prepared+'error-boundary-contract.json')),newIds=JSON.parse(await read(prepared+'error-boundary-identities.json'));
 assert.equal(oldContract.operations.length,76);assert.equal(oldIds.length,76);assert.equal(newIds.length,78);
 assert.deepEqual(newContract.operations.slice(0,76),oldContract.operations);assert.deepEqual(newContract.controls,oldContract.controls);
 const added=newContract.operations.slice(76);assert.deepEqual(added.map(o=>o.name),['boundary_9e3f889e8b1e375a0a980496','boundary_3121e2df6802725969086adf']);
 assert.deepEqual(newIds.filter(r=>!added.some(o=>o.name===r.name)),oldIds);
 for(const [name,value]of Object.entries({'error-boundary-contract.json':oldContract,'error-boundary-identities.json':oldIds,'typed-read-operations.json':added,'typed-identities.json':newIds}))await writeFile(dir+name,JSON.stringify(value,null,2)+'\n');
 let guard=await read(active+'activation/private-error-boundary.mjs');assert.equal(hash(guard),m.inputs[active+'activation/private-error-boundary.mjs']);
 guard=once(guard,"const verified=new WeakSet();","const verified=new WeakMap();");
 guard=once(guard,'const controls=new Set(contract.controls);',"const controls=new Set(contract.controls);\nconst typedOperations=new Map([...contract.operations,...typedReads].map(o=>[o.sql,o]));");
 guard="import typedReads from './typed-read-operations.json' with {type:'json'};\nimport typedIdentities from './typed-identities.json' with {type:'json'};\n"+guard;
 const verifyOld="  if(identities.length!==operations.size || JSON.stringify(r.rows)!==JSON.stringify(identities))fail();\n  verified.add(client);";
 const verifyNew="  if(identities.length!==76||operations.size!==76||typedIdentities.length!==78||typedOperations.size!==78)fail();\n  const rows=JSON.stringify(r.rows);\n  if(rows===JSON.stringify(identities))verified.set(client,'serial');\n  else if(rows===JSON.stringify(typedIdentities))verified.set(client,'batch');\n  else fail();";
 guard=once(guard,verifyOld,verifyNew);
 guard=once(guard,'function pgText(value)',"export function verifiedBoundaryMode(client){const mode=verified.get(client);if(!mode)fail();return mode;}\nfunction pgText(value)");
 guard=once(guard,'const op=operations.get(sql);',"const op=(verifiedBoundaryMode(client)==='batch'?typedOperations:operations).get(sql);");
 await writeFile(dir+'private-error-boundary.mjs',guard);
 let repo=await read(active+'postgres-repository.mjs');assert.equal(hash(repo),m.inputs[active+'postgres-repository.mjs']);
 repo=once(repo,'{assertVerifiedBoundary,privateQuery}','{assertVerifiedBoundary,privateQuery,verifiedBoundaryMode}');
 repo=once(repo,"from './activation/private-error-boundary.mjs'","from './private-error-boundary.mjs'");repo=once(repo,"from './web-protocol.mjs'","from '../../web-protocol.mjs'");
 repo=once(repo,'Object.freeze({query,synchronizeOwner,beforeCommit,measure})',"Object.freeze({query,synchronizeOwner,beforeCommit,measure,canonicalReadMode:()=>{fence();return verifiedBoundaryMode(c);}})");
 await writeFile(dir+'postgres-repository.mjs',repo);
 const oldSource=await read(active+'integrated-service.mjs');assert.equal(hash(oldSource),m.inputs[active+'integrated-service.mjs']);
 const oldReader=oldSource.slice(oldSource.indexOf('export async function readCanonical'),oldSource.indexOf('const fieldsOff=')).replace('export async function readCanonical','async function readCanonicalSerial');
 let source=await read(prepared+'integrated-service.mjs');
 const mode="  const mode=ports.canonicalReadMode();\n  if(mode==='serial')return readCanonicalSerial(ports,ownerId,listScopeOnly);\n  if(mode!=='batch')throw Error('n88_database_unavailable');\n";
 source=once(source,'export async function readCanonical(ports,ownerId,listScopeOnly=false) {',oldReader+'export async function readCanonical(ports,ownerId,listScopeOnly=false) {\n'+mode);
 await writeFile(dir+'integrated-service.mjs',source);
 const native=await read(active+'activation/bundle/edge/index.mjs');assert.equal(hash(native),'6ebb7e07e838a14662e03b9a8908ade05d8768ed00f306b54f2d8f98d0931d09');
 const stagedReader=source.slice(source.indexOf('async function readCanonicalSerial'),source.indexOf('const fieldsOff=')).replace('export async function readCanonical','async function readCanonical');
 const spans=[{label:'fixed reader selector',start:native.indexOf('async function readCanonical('),end:native.indexOf('var fieldsOff ='),replacement:stagedReader},
 {label:'verified per-connection mode',start:native.indexOf('var verified = /* @__PURE__ */ new WeakSet();'),end:native.indexOf('var operations ='),replacement:'var verified = new WeakMap();\n'},
 {label:'strict two catalog selector',start:native.indexOf('async function assertVerifiedBoundary(client)'),end:native.indexOf('function pgText(value)'),replacement:`var typedReadOperations = new Map([...error_boundary_contract_default.operations,...${JSON.stringify(added)}].map(o=>[o.sql,o]));\nvar typedReadIdentities = ${JSON.stringify(newIds)};\nasync function assertVerifiedBoundary(client) {\n verified.delete(client);const r=await client.query(boundaryCatalogSql);\n if(error_boundary_identities_default.length!==76||operations.size!==76||typedReadIdentities.length!==78||typedReadOperations.size!==78)fail4();\n const rows=JSON.stringify(r.rows);\n if(rows===JSON.stringify(error_boundary_identities_default))verified.set(client,'serial');\n else if(rows===JSON.stringify(typedReadIdentities))verified.set(client,'batch');\n else fail4();\n}\nfunction verifiedBoundaryMode(client){const mode=verified.get(client);if(!mode)fail4();return mode;}\n`}];
 const queryStart=native.indexOf('async function privateQuery(client,'),queryEnd=native.indexOf('var encodeBoundaryParameter',queryStart),query=native.slice(queryStart,queryEnd);
 spans.push({label:'fixed typed operation dispatch',start:queryStart,end:queryEnd,replacement:once(query,'const op = operations.get(sql);',"const op = (verifiedBoundaryMode(client)==='batch'?typedReadOperations:operations).get(sql);")});
 const ports='Object.freeze({ query, synchronizeOwner, beforeCommit, measure })',at=native.indexOf(ports);assert(at>0);spans.push({label:'fenced mode capability',start:at,end:at+ports.length,replacement:'Object.freeze({ query, synchronizeOwner, beforeCommit, measure, canonicalReadMode:()=>{fence();return verifiedBoundaryMode(c);} })'});
 let output=native;for(const s of [...spans].sort((a,b)=>b.start-a.start)){assert(s.start>=0&&s.end>s.start);output=output.slice(0,s.start)+s.replacement+output.slice(s.end);}
 await writeFile(dir+'native63-compatible.inactive.mjs',output);
 assert.equal(hash(await read(prepared+'additive-boundary.inactive.sql')),'8e85df7c297b8c99bedd150a6fd28d3e9d8e1c9f0367ef465a7946edd970a96b');
 const manifest={aiAuthored:true,taskId:'continuous-n88-typed-read-service-activation-20261023',preparedRunId:'4575c6a7-2cb8-459e-a779-8de667c5fea2',baseSha:'5f4b1b87f0743251e5650da7490f5b1a0704db36',priorPackage:'ddfa87956cd673abad634a492c9aff6bacba86b8',priorNative:hash(native),native:hash(output),sql:m.outputs['additive-boundary.inactive.sql'],oldCatalogFingerprint:hash(JSON.stringify(oldIds)),newCatalogFingerprint:hash(JSON.stringify(newIds)),modes:['serial','batch'],unknownCatalog:'DENY',operationCounts:[76,78],spans:spans.map(s=>({label:s.label,preimage:hash(native.slice(s.start,s.end)),replacement:hash(s.replacement)})),outputs:{},serviceOperations:0};
 for(const f of ['private-error-boundary.mjs','postgres-repository.mjs','integrated-service.mjs','typed-read-operations.json','typed-identities.json','error-boundary-contract.json','error-boundary-identities.json','native63-compatible.inactive.mjs'])manifest.outputs[f]=hash(await read(dir+f));
 await writeFile(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/read-service-20261023/prepare.mjs'))console.log(JSON.stringify(await prepare()));
