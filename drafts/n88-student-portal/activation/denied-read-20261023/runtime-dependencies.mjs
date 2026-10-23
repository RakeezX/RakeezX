/** AI: AST dependency enumeration of the two immutable native artifacts. */
import vm from 'node:vm';
import {fixedRuntimeKeys} from './runtime-configuration.mjs';
import {hash,priorSource,successorSource} from './transition-guards.mjs';
const parserSource=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
const exports={};vm.runInNewContext(parserSource,{exports,module:{exports}}, {timeout:5000});
export const parserIdentity={version:exports.version,sha256:hash(parserSource)};
export const parse=source=>exports.parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true});
export function walk(node,visit,parents=[]){if(!node||typeof node!=='object')return;if(typeof node.type==='string')visit(node,parents);for(const [k,v] of Object.entries(node)){if(['loc','start','end'].includes(k))continue;if(Array.isArray(v))for(const x of v)walk(x,visit,[...parents,node]);else if(v&&typeof v==='object')walk(v,visit,[...parents,node]);}}
export function analyzeNative(source){
 if(![priorSource,successorSource].includes(hash(source)))throw Error('n88_dependency_unpinned_native');
 const ast=parse(source),fixed=new Set(),imports=new Set(),calls=[],flows=[];let denoGets=0;
 walk(ast,(n,parents)=>{
  if(n.type==='ImportDeclaration')imports.add(n.source.value);
  if(n.type==='MemberExpression'&&n.object?.type==='Identifier'&&n.object.name==='process'&&n.property?.name==='env')throw Error('n88_dependency_unexpected_direct_process_env');
  if(n.type!=='CallExpression')return;
  if(n.callee.type==='Identifier'&&['eval','Function'].includes(n.callee.name))throw Error('n88_dependency_dynamic_execution');
  const scope=parents.filter(p=>p.type==='FunctionDeclaration').map(p=>p.id?.name).join('/');
  const name=n.callee.type==='Identifier'?n.callee.name:null;
  if(name==='readEnv'||(scope==='createExistingHost'&&['required','key2'].includes(name))){
   const a=n.arguments[0];
   if(a?.type==='Literal'&&typeof a.value==='string')fixed.add(a.value);
   else if(a?.type==='Identifier'&&a.name==='n'&&(scope==='createExistingHost'||scope==='checkReadiness'))flows.push({scope,callee:name,argument:'n',line:n.loc.start.line});
   else if(a?.type==='BinaryExpression'&&a.operator==='+'&&a.left.value==='N88_RECOVERY_KEY_'&&a.right.name==='v'&&scope==='createExistingHost')flows.push({scope,callee:name,argument:'bounded recovery version',line:n.loc.start.line});
   else throw Error('n88_dependency_unknown_accessor_flow');
   calls.push({scope,callee:name,line:n.loc.start.line});
  }
  const c=n.callee;
  if(c.type==='MemberExpression'&&c.property.name==='get'&&c.object?.type==='MemberExpression'&&c.object.object?.name==='Deno'&&c.object.property?.name==='env'){
   if(n.arguments.length!==1||n.arguments[0].name!=='name'||!parents.some(p=>p.type==='ArrowFunctionExpression'&&p.params.length===1&&p.params[0].name==='name'))throw Error('n88_dependency_unknown_deno_flow');denoGets++;
  }
 });
 if(JSON.stringify([...fixed].sort())!==JSON.stringify([...fixedRuntimeKeys].sort())||denoGets!==4||imports.has('node:fs')||[...imports].some(n=>!n.startsWith('node:')&&!['pg','@supabase/auth-js'].includes(n)))throw Error('n88_dependency_set_or_import_changed');
 return {sourceSha256:hash(source),fixedRuntimeKeys:[...fixed].sort(),dynamicRecoveryPrefix:'N88_RECOVERY_KEY_',dynamicRecoveryConstraint:'1..8 unique ASCII version tokens, 1..40 chars; deployment requires exact original single acknowledged version',imports:[...imports].sort(),accessorCallSites:calls,indirectAccessorFlows:flows,denoAdapterClosures:denoGets};
}
