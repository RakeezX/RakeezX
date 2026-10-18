/** AI: actual packaged Edge entry handler, synthetic Request, no listener or network. */
let handle;
const reads=[];
const originalServe=Deno.serve,originalGet=Deno.env.get;
try {
 Deno.serve=h=>{handle=h;return {};};
 Deno.env.get=name=>{reads.push(name);if(name==='N44_ENABLED')return 'false';if(!name.startsWith('N44_'))return undefined;throw Error('disabled entry read private binding');};
 await import('../drafts/n44-push/activation/bundle/edge/index.mjs');
 if(typeof handle!=='function')throw Error('missing actual Edge handler');
 for(let i=0;i<2;i++) {
  const response=await handle(new Request('https://synthetic.invalid/functions/v1/n44-notifications/dispatch',{method:'POST'}));
  if(response.status!==503)throw Error('disabled Edge failed closed');
 }
 if(JSON.stringify(reads.filter(n=>n.startsWith('N44_')))!=='["N44_ENABLED"]')throw Error('unexpected disabled binding reads');
 console.log('N44 packaged actual Edge handler default-OFF PASS; only N44_ENABLED read, no DB/Auth/secret/listener/network.');
}finally {Deno.serve=originalServe;Deno.env.get=originalGet;}
