import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCloudflareIndex} from './publisher.mjs';
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/cloudflare-user-tail-20261014.json',import.meta.url)));
const h=x=>createHash('sha256').update(x).digest('hex');
const meta={repoPath:'index.html',urlPath:'/',statusCode:200,server:'cloudflare',contentType:'text/html;charset=utf-8'};
const orders=[[f.jsd+f.beacon,['cloudflare-jsd-v1','cloudflare-analytics-20261014']],[f.beacon+f.jsd,['cloudflare-analytics-20261014','cloudflare-jsd-v1']]];
for(const [pair,labels] of orders){
 test('provider order '+labels.join(' then ')+' with strict single added byte',()=>{
  const original='<html><body>safe</body></html>';
  const served='<html><body>safe'+pair+' </body></html>';
  const result=normalizeCloudflareIndex(Buffer.from(served),{...meta,expectedSha256:h(original)});
  assert.ok(result);
  assert.equal(result.normalizedSha256,h(original));
  assert.equal(result.normalizedBytes,Buffer.byteLength(original));
  assert.equal(result.removedProviderBytes,Buffer.byteLength(pair)+1);
  assert.equal(result.providerAddedWhitespaceBytes,1);
  assert.deepEqual(result.providerTransforms,labels);
 });
 test('provider order '+labels.join(' then ')+' retains genuine application whitespace',()=>{
  const nl=String.fromCharCode(10);
  const original='<html><body>safe'+nl+'</body></html>';
  const result=normalizeCloudflareIndex(Buffer.from('<html><body>safe'+pair+nl+'</body></html>'),{...meta,expectedSha256:h(original)});
  assert.equal(result.normalizedSha256,h(original));
  assert.equal(result.providerAddedWhitespaceBytes,undefined);
 });
 test('two byte extras and modified app are not verified '+labels.join(','),()=>{
  const original='<html><body>safe</body></html>',wanted=h(original);
  for(const html of ['<html><body>safe'+pair+'  </body></html>','<html><body>changed'+pair+' </body></html>']){
   const x=normalizeCloudflareIndex(Buffer.from(html),{...meta,expectedSha256:wanted});
   assert.notEqual(x?.normalizedSha256,wanted);
   assert.equal(x?.providerAddedWhitespaceBytes,undefined);
  }
 });
}
test('one permitted pinned provider remains supported',()=>{
 const orig='<html><body>safe</body></html>';
 for(const tag of [f.jsd,f.beacon]){
  const x=normalizeCloudflareIndex(Buffer.from('<html><body>safe'+tag+'</body></html>'),{...meta,expectedSha256:h(orig)});
  assert.equal(x.normalizedSha256,h(orig));
 }
});
test('unknown interstitial scripts, duplicate or mutated tags refused',()=>{
 const x=['<html><body>safe'+f.jsd+'<script>unknown</script>'+f.beacon+'</body></html>',
  '<html><body>safe'+f.beacon+f.jsd+f.beacon+'</body></html>',
  '<html><body>safe'+f.jsd+f.beacon.replace('beacon.min.js','different.min.js')+'</body></html>'];
 for(const s of x)assert.equal(normalizeCloudflareIndex(Buffer.from(s),meta),null);
});
test('wrong server and challenge never normalized',()=>{
 const s=Buffer.from('<html><body>safe'+f.beacon+f.jsd+' </body></html>');
 assert.equal(normalizeCloudflareIndex(s,{...meta,server:'nginx'}),null);
 assert.equal(normalizeCloudflareIndex(s,{...meta,mitigated:'challenge'}),null);
});
