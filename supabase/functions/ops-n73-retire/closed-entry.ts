Deno.serve(() => new Response(JSON.stringify({ok:false,errorCode:'N73_DISARMED'}), {status:410, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
