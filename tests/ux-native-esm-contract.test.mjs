import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

async function sourceFiles(root) {
  const result=[];
  for(const entry of await readdir(root,{withFileTypes:true})){
    const path=join(root,entry.name);
    if(entry.isDirectory())result.push(...await sourceFiles(path));
    else if(entry.isFile()&&entry.name.endsWith('.js'))result.push(path);
  }
  return result;
}

test('Cloudflare native ESM views must load stylesheets as links, never bare CSS module imports',async()=>{
  const root=new URL('../src/',import.meta.url).pathname;
  const files=await sourceFiles(decodeURIComponent(process.platform==='win32'?root.slice(1):root));
  const offenders=[];
  for(const file of files){
    const source=await readFile(file,'utf8');
    for(const [index,line] of source.split(/\r?\n/).entries()){
      if(/^\s*import\s+(?!\()(?:(?:.+\bfrom\s+)?['"])[^'"]+\.css(?:\?[^'"]*)?['"]/.test(line)){
        offenders.push({file:relative(process.cwd(),file),line:index+1,source:line.trim()});
      }
    }
  }
  assert.deepEqual(offenders,[],'Raw ESM CSS imports fail strict browser MIME checks in Cloudflare Pages');
});
