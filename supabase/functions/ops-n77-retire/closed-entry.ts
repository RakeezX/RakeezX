// Redeployed to BOTH exact run functions only after deterministic retirement.
Deno.serve(() => new Response(JSON.stringify({ ok: false, errorCode: 'N77_CLOSED' }), { status: 410, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }));
