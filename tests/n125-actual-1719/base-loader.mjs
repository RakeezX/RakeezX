import { execFileSync } from 'node:child_process';
const base = '0b4e841ca9447373add29c0a62876494a81ecdb8';
export async function load(url,context,nextLoad){
 if(url.endsWith('/tests/n95-sync-status-severity.test.mjs')){
  const original=await nextLoad(url,context);
  return {...original,source:String(original.source).replace("readFileSync(path, 'utf8')", "execFileSync('git', ['show', '"+base+":' + path], {encoding:'utf8'})")};
 }
 if(url.endsWith('/src/lib/sync.js')||url.endsWith('/src/lib/cloud.js')||url.endsWith('/src/lib/sync-operational-ui.js')){
  const path=url.slice(url.indexOf('/src/')+1);return {format:'module',source:execFileSync('git',['show',base+':'+path],{encoding:'utf8'}),shortCircuit:true};
 }
 return nextLoad(url,context);
}
