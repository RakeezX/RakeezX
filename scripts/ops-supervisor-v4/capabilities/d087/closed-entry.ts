// Final disarm version for exactly the same uniquely named D-087 operations function.
// No imports, environment reads, Admin API, CORS or logging remain.
Deno.serve(() => new Response('{"ok":false,"errorCode":"D087_CLOSED"}', {
  status: 410, headers: { 'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
}));
