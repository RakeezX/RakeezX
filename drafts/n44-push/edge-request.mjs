/** AI: map the provider's function-local path to the original signed public protocol path. */
export function edgeRequest(request,readEnv){
 const u=new URL(request.url),local='/n44-notifications',publicPath='/functions/v1/n44-notifications';
 const origin=readEnv('N44_AUTH_URL');if(origin!=='https://xlrubcwjqktzzunrvuns.supabase.co')throw Error('n44_origin');
 if(u.pathname===local||u.pathname.startsWith(local+'/')){
  // Only the exact named function can reach this module. Authentication still binds the
  // configured canonical origin/path, full body and original ingress signature.
  const canonical=new URL(origin);canonical.pathname=publicPath+u.pathname.slice(local.length);canonical.search=u.search;
  return new Request(canonical,request);
 }
 return request;
}
