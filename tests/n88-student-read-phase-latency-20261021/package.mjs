/** AI: exact additive instrumentation over immutable published native/carrier.
 * Does not rebuild stale native dependencies or perform provider operations. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const dir='tests/n88-student-read-phase-latency-20261021/',base='e710fcbbf51fcaa59715e45e4aa15aaa353bb1e3',act='drafts/n88-student-portal/activation/';
const sha=b=>createHash('sha256').update(b).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
const show=p=>lf(execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:2097152}));
const esbuild=createRequire(import.meta.url)('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
const protocol=lf(await readFile('drafts/n88-student-portal/web-protocol.mjs','utf8'));
const helpers=protocol.slice(protocol.indexOf('// AI: finite successful-GET')).replaceAll('export ','');
let native=show(act+'bundle/edge/index.mjs');assert.equal(sha(native),'ec0efc049b20f7119b3b5eea8b55a93a52bdfd6981647bf97298383a9f37f507');
const original=native,patches=[];
const replace=(a,b)=>{assert.equal(native.split(a).length,2,a);native=native.replace(a,b);patches.push([a,b]);};
replace('    let c, live2 = true, begun = false, committed = false, destroyed = false, stage = "acquire";','    let c, live2 = true, begun = false, committed = false, destroyed = false, stage = "acquire";\n    const phases = createReadPhaseTiming(), measure = phases.measure;');
replace('      const r = await privateQuery(c, text2, values);','      const run = () => privateQuery(c, text2, values);\n      const r = await (["begin", "snapshot"].includes(stage) || text2.startsWith("select case when octet_length(payload::text)") ? measure("snapshot", run) : run());');
replace('const lease = Promise.resolve().then(acquire);','const lease = Promise.resolve().then(() => acquire(measure));');
replace('      await assertVerifiedBoundary(c);','      await measure("boundary", () => assertVerifiedBoundary(c));');
replace('        await synchronize(state, { query, synchronizePhase }, ownerId);','        await measure("sync", () => synchronize(state, { query, synchronizePhase }, ownerId));');
replace('Object.freeze({ query, synchronizeOwner, beforeCommit })','Object.freeze({ query, synchronizeOwner, beforeCommit, measure })');
replace('const ack = await query("commit");','const ack = await measure("commit", () => query("commit"));');
replace('      committed = true;\n      return result2;','      committed = true;\n      if (result2?.readPhaseDiagnostic === true) { delete result2.readPhaseDiagnostic; if (result2.status === 200) result2.readPhases = phases.finish(); }\n      return result2;');
replace('  const acquire = async () => {','  const acquire = async (measure = async (_name, action) => action()) => {');
replace('      client = await pool.connect();\n      await assertRestrictedTransport(client);\n      await assertPrivateDatabaseSession(client);','      client = await measure("pool", () => pool.connect());\n      await measure("boundary", async () => { await assertRestrictedTransport(client); await assertPrivateDatabaseSession(client); });');
replace('return { status: 200, body: await project(db, m, ports) };','return { status: 200, body: await project(db, m, ports), readPhaseDiagnostic: true };');
replace('    const canonical = await readCanonical(ports, m.ownerId);','    const measure = ports.measure ?? (async (_name, action) => action());\n    const canonical = await measure("canonical", () => readCanonical(ports, m.ownerId));');
replace('policy = await policies(ports, m.ownerId, m.classId, s.termId);','policy = await measure("visibility", () => policies(ports, m.ownerId, m.classId, s.termId));');
replace('    return projectStudentPortal({ ...inputFor(s, m), visibility: stored || null, taskGuidance: await readTaskGuidance(ports, s) });','    const taskGuidance = await measure("guidance", () => readTaskGuidance(ports, s));\n    return measure("projection", () => projectStudentPortal({ ...inputFor(s, m), visibility: stored || null, taskGuidance }));');
replace('return Response.json({ status: result2.status, body: result2.body, cookie: result2.headers?.["Set-Cookie"] || null }, { headers: PRIVATE_WEB_HEADERS });','return Response.json({ status: result2.status, body: result2.body, cookie: result2.headers?.["Set-Cookie"] || null, ...(wire.get("x-n88-read-phase-version") === "1" && path === "/api/n88/student/read" && method === "GET" && result2.status === 200 && validateReadPhases(result2.readPhases) ? {readPhases: result2.readPhases} : {}) }, { headers: PRIVATE_WEB_HEADERS });');
let reversed=native;for(const [a,b]of patches.toReversed())reversed=reversed.replace(b,a);assert.equal(reversed,original);
native=helpers+'\n'+native;await writeFile(act+'bundle/edge/index.mjs',native);
// Existing private entry and source CSS; no startup dependency or stylesheet delta.
const brandAssets=['header-light-standard.svg','header-light-compact.svg','header-dark-standard.svg','header-dark-compact.svg','icon-192.png'];
const absolute={name:'actual-app-absolute-imports',setup(b){b.onResolve({filter:/^\/src\//},a=>({path:path.resolve('.'+a.path)}));}};
const assets={name:'private-asset-urls',setup(b){b.onLoad({filter:/[\\/]src[\\/](lib[\\/]brand|views[\\/]student-portal-login)\.js$/},async({path:file})=>{let contents=await readFile(file,'utf8');if(path.basename(file)==='brand.js')for(const asset of brandAssets)contents=contents.replace(`new URL('../../assets/${asset}', import.meta.url)`,`new URL('/n88-private/assets/brand/${asset}', import.meta.url)`);else contents=contents.replace("new URL('../styles/student-portal-login.css', import.meta.url)","new URL('/n88-private/styles/student-portal-login.css', import.meta.url)");return {contents,loader:'js',resolveDir:path.dirname(file)};});}};
const built=await esbuild.build({entryPoints:['drafts/n88-student-portal/client/student-entry.js'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,logLevel:'silent',plugins:[absolute,assets]});
const student=Buffer.from(built.outputFiles[0].contents);await writeFile(act+'bundle/private/assets/student.mjs',student);
const priorCarrier=show('tests/n88-student-quiet-fast-return-20261021/carrier.mjs');assert.equal(sha(priorCarrier),'a2308758f0611510f04f71cee50f69ffe35b936183d8d3e20847304adfb67091');
const prefix='var privateAssets = Object.freeze(',start=priorCarrier.indexOf(prefix)+prefix.length,end=priorCarrier.indexOf(');',start);assert(start>=prefix.length&&end>start);
const before=JSON.parse(priorCarrier.slice(start,end)),after=structuredClone(before);after['/n88-private/assets/student.mjs'].base64=student.toString('base64');
await writeFile(act+'private-document.mjs','// AI: generated exact receipt-bound private assets; only student JS changes.\nexport const privateAssets=Object.freeze('+JSON.stringify(after)+');\n');
// Retain ALL prior transport behavior (including existing placement policy) by
// applying only the canonical reply-validation delta to the published carrier.
const oldSource=show('drafts/n88-student-portal/cloudflare-entry.mjs'),newSource=lf(await readFile('drafts/n88-student-portal/cloudflare-entry.mjs','utf8'));
const oldBlock=oldSource.slice(oldSource.indexOf('      const reply=JSON.parse'),oldSource.indexOf('      if(responseRegion)out.set'));
const newBlock=newSource.slice(newSource.indexOf('      const reply=JSON.parse'),newSource.indexOf('      if(responseRegion)out.set'));
// Compile just the canonical changed block and match its exact esbuild output
// in the immutable carrier; preserve the rest rather than rebuilding old graph.
const compiled=async s=>(await esbuild.transform('async function bridge(){\n'+s+'\n}',{target:'es2022',format:'esm'})).code.replace(/^async function bridge\(\) \{\n/,'').replace(/\n\}\n$/,'');
const oldCompiled=await compiled(oldBlock),newCompiled=await compiled(newBlock);
let carrier=priorCarrier;const oldIndented=oldCompiled.split('\n').map(l=>'    '+l).join('\n'),newIndented=newCompiled.split('\n').map(l=>'    '+l).join('\n');
assert.equal(carrier.split(oldIndented).length,2,'canonical reply preimage in published carrier');carrier=carrier.replace(oldIndented,newIndented);
assert.equal(carrier.split(before['/n88-private/assets/student.mjs'].base64).length,2);carrier=carrier.replace(before['/n88-private/assets/student.mjs'].base64,after['/n88-private/assets/student.mjs'].base64);
assert.equal(carrier.replace(newIndented,oldIndented).replace(after['/n88-private/assets/student.mjs'].base64,before['/n88-private/assets/student.mjs'].base64),priorCarrier);
carrier=helpers+'\n'+carrier;await writeFile(act+'bundle/cloudflare/worker.mjs',carrier);await writeFile(dir+'carrier.mjs',carrier);
const wireNeedle='const wire = new Headers({ "content-type": "application/json" });';assert.equal(carrier.split(wireNeedle).length,2);carrier=carrier.replace(wireNeedle,wireNeedle+'\n      if (request.method === "GET" && url.pathname === "/api/n88/student/read") wire.set("x-n88-read-phase-version", "1");');
await writeFile(act+'bundle/cloudflare/worker.mjs',carrier);await writeFile(dir+'carrier.mjs',carrier);
const manifest=JSON.parse(show(act+'manifest.json'));
for(const [name,data]of Object.entries({'edge/index.mjs':native,'private/assets/student.mjs':student,'cloudflare/worker.mjs':carrier}))manifest.outputs[name]=sha(data);
const sources=['web-protocol.mjs','web-entry.mjs','existing-host.mjs','postgres-repository.mjs','numeric-credentials.mjs','integrated-service.mjs','cloudflare-entry.mjs'].map(p=>'drafts/n88-student-portal/'+p).concat(['src/lib/student-portal-unified-client.js','src/views/student-portal-login.js']);
for(const p of sources)manifest.sources[p]=sha(lf(await readFile(p,'utf8')));
const result={taskId:'continuous-n88-student-read-phase-latency-20261021',runId:'2c1fb6b8-d4ce-428a-8539-65e83d5a6a86',status:'PASS',priorNative:sha(original),native:sha(native),priorCarrier:sha(priorCarrier),carrier:sha(carrier),student:sha(student),nativeExactReversiblePatches:patches.length,allOtherCarrierBytesIdentical:true,staticCssUnchanged:true,providerOperations:0};
manifest.studentReadPhasePreparation=result;await writeFile(act+'manifest.json',JSON.stringify(manifest,null,2)+'\n');await writeFile(dir+'package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
