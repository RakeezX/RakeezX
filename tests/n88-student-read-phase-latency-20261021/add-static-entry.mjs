/** AI: expose new static gate only through the original custodian's scoped ports. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
const file='drafts/n88-student-portal/official-activation.mjs';let s=await readFile(file,'utf8');
const start=s.indexOf(" if(['--latency-preflight'"),end=s.indexOf(" if(['--student-pending-static-owned-preflight'",start);assert(start>0&&end>start);
let b=s.slice(start,end);
b=b.replace("'--latency-complete'].includes(action)","'--latency-complete','--latency-static-preflight','--latency-static-begin','--latency-static-complete'].includes(action)");
b=b.replace('native-attempt|pin-attempt|native-complete','native-attempt|pin-attempt|native-complete|static-attempt|static-complete');
b=b.replace("['before','pre-upload','uploaded','pre-pin','pinned']","['before','pre-upload','uploaded','pre-pin','pinned','static-before','static-after']");
const proofNeedle="if(proof.localStatus!=='PASS'||proof.native!==c.source||proof.priorNative!==c.prior)fail('n88_latency_local_proof');";
assert(b.includes(proofNeedle));b=b.replace(proofNeedle,proofNeedle+"\n   for(const file of Object.keys(proof.sourceHashes)){const actual=(await readFile(path.join(taskRoot,file),'utf8')).replaceAll('\\r\\n','\\n'),committed=execFileSync('git',['show',checked+':'+file],{cwd:taskRoot,encoding:'utf8',maxBuffer:2097152}).replaceAll('\\r\\n','\\n');if(actual!==committed||latencyDigest(actual)!==proof.sourceHashes[file])fail('n88_latency_qualified_source_drift');}");
b=b.replace("return runLatencyNativePhase(action.slice('--latency-'.length),{","const ports={");
assert(b.endsWith('  });\n }\n'));b=b.slice(0,-'  });\n }\n'.length)+"  };\n  if(action.startsWith('--latency-static-'))return runLatencyStaticPhase(action.slice('--latency-static-'.length),{...ports,readServed:()=>readFile(path.join(evidence,'served-student.mjs'))});\n  return runLatencyNativePhase(action.slice('--latency-'.length),ports);\n }\n";
s=s.slice(0,start)+b+s.slice(end);s=s.replace("import {LATENCY,", "import {runLatencyStaticPhase} from '../../tests/n88-student-read-phase-latency-20261021/static-gate.mjs';\nimport {LATENCY,");await writeFile(file,s);
