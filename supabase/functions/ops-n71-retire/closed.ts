// AI-authored permanent deny-all disposition. No imports, capabilities or admin access.
Deno.serve(() => new Response(JSON.stringify({ok:false,errorCode:'N71_RETIRED'}),{status:410,headers:{'content-type':'application/json','cache-control':'no-store'}}));
