/** AI: executable ONLY in the approved native Cloudflare Code Mode sandbox.
 * First disable exact owned bindings, then remove only the exact owned route.
 * No credential, raw secret, arbitrary resource, logging or zone-policy change.
 * Also run scripts/n44-activation-custody.mjs --disable under the owned lease.
 */
export default async function disableProvider(cloudflare) {
 const account='1c9ae85e766968a4269a7ac505f9a693',zone='1aefe7f448c93a8af637a718ac2cd101';
 const receipts=[];
 for(const worker of ['n44-notifications-ingress','n44-notifications-scheduler']){
  const path=`/accounts/${account}/workers/scripts/${worker}/settings`,current=await cloudflare.request({method:'GET',path});
  if(!current.success)throw Error('n44_disable_unknown');
  const bindings=current.result.bindings.map(b=>b.name==='N44_ENABLED'?{type:'plain_text',name:b.name,text:'false'}:b.type==='secret_text'?{type:'inherit',name:b.name}:b);
  const settings={bindings,observability:{enabled:false,logs:{enabled:false,invocation_logs:false,persist:false,destinations:[]},traces:{enabled:false,persist:false,destinations:[]}},logpush:false,tail_consumers:[]};
  const boundary='N44'+crypto.randomUUID(),body=['--'+boundary,'Content-Disposition: form-data; name="settings"','Content-Type: application/json','',JSON.stringify(settings),'--'+boundary+'--',''].join('\r\n');
  const r=await cloudflare.request({method:'PATCH',path,body,contentType:'multipart/form-data; boundary='+boundary,rawBody:true});
  if(!r.success)throw Error('n44_disable_unknown');receipts.push({worker,disabled:true,status:r.status});
 }
 const routes=await cloudflare.request({method:'GET',path:`/zones/${zone}/workers/routes`});
 if(!routes.success)throw Error('n44_route_read_unknown');
 for(const r of routes.result.filter(r=>r.pattern==='rakeezx.com/api/n44/*')){
  if(r.script!=='n44-notifications-ingress')throw Error('n44_foreign_route_collision');
  const removed=await cloudflare.request({method:'DELETE',path:`/zones/${zone}/workers/routes/${r.id}`});
  if(!removed.success)throw Error('n44_route_disable_unknown');receipts.push({routeId:r.id,removed:true});
 }
 return receipts;
}
