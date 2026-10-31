/** AI: exact owned static closure, original signed gateway unchanged; config default OFF. */
import {createRuntimeWriterGateway} from '../v2-runtime-writer-1031/gateway.inactive.mjs';
import {privateAssets} from './private-assets.inactive.mjs';
import {PRIVATE_WEB_HEADERS} from '../../web-protocol.mjs';
export function createHostedCompatGateway(options={}){
 const legacy=createRuntimeWriterGateway(options);
 return (request,env)=>{
  const u=new URL(request.url);
  if(Object.hasOwn(privateAssets,u.pathname)){
   if(env?.N88_ENABLED!=='true'||u.origin!==env.N88_PUBLIC_ORIGIN||u.search||!request.cf||!['TLSv1.2','TLSv1.3'].includes(request.cf.tlsVersion)||request.headers.has('cf-worker')||!['GET','HEAD'].includes(request.method))return new Response(null,{status:404,headers:PRIVATE_WEB_HEADERS});
   const a=privateAssets[u.pathname];return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0)),{headers:{...PRIVATE_WEB_HEADERS,'content-type':a.type,'Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
  }
  return legacy(request,env);
 };
}
export default {fetch:createHostedCompatGateway()};
