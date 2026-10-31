/** AI: exact affected private entry bundling, existing installed esbuild/recipe, no provider/package writes. */
import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';import path from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('C:/Users/Abody/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/esbuild/lib/main.js');
export async function bundleStudent(){
 const brandAssets=['header-light-standard.svg','header-light-compact.svg','header-dark-standard.svg','header-dark-compact.svg','icon-192.png'];
 const absolute={name:'existing-absolute-import-recipe',setup(build){build.onResolve({filter:/^\/src\//},args=>({path:path.resolve('.'+args.path)}));}};
 const privateAssets={name:'existing-private-asset-recipe',setup(build){build.onLoad({filter:/[\\/]src[\\/](lib[\\/]brand|views[\\/]student-portal-login)\.js$/},async({path:file})=>{
  let contents=await readFile(file,'utf8');if(path.basename(file)==='brand.js')for(const asset of brandAssets)contents=contents.replace(`new URL('../../assets/${asset}', import.meta.url)`,`new URL('/n88-private/assets/brand/${asset}', import.meta.url)`);
  else contents=contents.replace("new URL('../styles/student-portal-login.css', import.meta.url)","new URL('/n88-private/styles/student-portal-login.css', import.meta.url)");
  return {contents,loader:'js',resolveDir:path.dirname(file)};
 });}};
 const result=await esbuild.build({entryPoints:['drafts/n88-student-portal/client/student-entry.js'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true,logLevel:'silent',plugins:[absolute,privateAssets]});
 return {text:result.outputFiles[0].text,inputs:Object.keys(result.metafile.inputs),esbuildVersion:esbuild.version};
}
