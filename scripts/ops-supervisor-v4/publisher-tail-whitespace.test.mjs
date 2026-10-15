import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCloudflareIndex} from './publisher.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/cloudflare-user-tail-20261014.json',import.meta.url)));
const sha=x=>createHash('sha256').update(x).digest('hex');
const meta={repoPath:'index.html',urlPath:'/',statusCode:200,server:'cloudflare',contentType:'text/html;charset=utf-8'};
for(const ws of [' ',String.fromCharCode(10),String.fromCharCode(13,10),String.fromCharCode(9)]){
 test('exact pinned pair preserves original whitespace bytes '+JSON.stringify(ws),()=>{
   const application='<html><body>safe'+ws+'</body></html>';
   const observed='<html><body>safe'+fixture.jsd+fixture.beacon+ws+'</body></html>';
   const n=normalizeCloudflareIndex(Buffer.from(observed),meta);
   assert.ok(n);
   assert.equal(n.normalizedSha256,sha(application));
   assert.equal(n.removedProviderBytes,Buffer.byteLength(fixture.jsd+fixture.beacon));
   assert.deepEqual(n.providerTransforms,['cloudflare-jsd-v1','cloudflare-analytics-20261014']);
 });
}
test('unknown content, modified pinned beacon, duplicate beacon remain refused',()=>{
 const bad=[fixture.jsd+fixture.beacon+'<script>unknown</script>',fixture.jsd+fixture.beacon.replace('beacon.min.js','different.min.js'),fixture.jsd+fixture.beacon+fixture.beacon];
 for(const injection of bad)assert.equal(normalizeCloudflareIndex(Buffer.from('<html><body>safe'+injection+' </body></html>'),meta),null);
});
test('wrong server and explicit challenge stay refused',()=>{
 const x=Buffer.from('<html><body>safe'+fixture.jsd+fixture.beacon+' </body></html>');
 assert.equal(normalizeCloudflareIndex(x,{...meta,server:'other'}),null);
 assert.equal(normalizeCloudflareIndex(x,{...meta,mitigated:'challenge'}),null);
});
