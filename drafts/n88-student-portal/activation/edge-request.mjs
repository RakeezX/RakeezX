/** AI: canonicalize only this provider function's local path before signed auth. */
export function edgeRequest(request,readEnv){
 const u=new URL(request.url),local='/n88-student-portal',publicPath='/functions/v1/n88-student-portal';
 const origin=readEnv('N88_AUTH_URL');if(origin!=='https://xlrubcwjqktzzunrvuns.supabase.co')throw Error('n88_origin');
 if(u.pathname===local||u.pathname.startsWith(local+'/')){
  const canonical=new URL(origin);canonical.pathname=publicPath+u.pathname.slice(local.length);canonical.search=u.search;
  return new Request(canonical,request);
 }
 return request;
}
