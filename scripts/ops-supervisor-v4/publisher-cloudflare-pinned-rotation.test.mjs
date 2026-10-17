import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const p=process.env.RAKEEZ_REVIEW_PUBLISHER;
const resolved = p ? new URL('file:///' + p.replaceAll('\\','/')) : new URL('./publisher.mjs',import.meta.url);
const {normalizeCloudflareIndex}=await import(resolved);
const f=JSON.parse(fs.readFileSync('C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/fixtures/cloudflare-user-tail-20261014.json','utf8'));
const pin="<script type=\"module\" src=\"https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092\" integrity=\"sha512-UKNk8GbxkABxKcXYuLkO16EleLGUkcvJWtpSNmExE0Too3ZaFAxTscNWEc1OdAv5/BikHawapSCaiD2XCmp+Bw==\" data-cf-beacon='{\"version\":\"2024.11.0\",\"token\":\"29dff8015f9a492385ac7d9826d7acc3\",\"r\":1,\"spa\":2}' crossorigin=\"anonymous\"></script>";
const sha=v=>createHash('sha256').update(v).digest('hex');
const meta={repoPath:'index.html',urlPath:'/',statusCode:200,server:'cloudflare',contentType:'text/html;charset=utf-8'};
test('public observed Beacon rotation exactly pinned',()=>{
 assert.equal(Buffer.byteLength(pin),366);
 assert.equal(sha(pin),'c367ad20836403dd7f82a90086400457fd1fe6622616c6a0bc9ecd2a1e331380');
});
for(const [one,two,labels] of [
 [f.jsd,pin,['cloudflare-jsd-v1','cloudflare-analytics-20261017']],
 [pin,f.jsd,['cloudflare-analytics-20261017','cloudflare-jsd-v1']]
]){
 test('both strict pinned provider orders, one provider newline whitespace only',()=>{
  const orig='<html><body>APP</body></html>';
  const normalized=normalizeCloudflareIndex(Buffer.from('<html><body>APP'+one+two+'\n</body></html>'),{...meta,expectedSha256:sha(orig)});
  assert.ok(normalized);
  assert.equal(normalized.normalizedSha256,sha(orig));
  assert.equal(normalized.removedProviderBytes,Buffer.byteLength(one+two+'\n'));
  assert.deepEqual(normalized.providerTransforms,labels);
 });
 test('source tampering never becomes verified',()=>{
  const orig='<html><body>APP</body></html>';
  const normalized=normalizeCloudflareIndex(Buffer.from('<html><body>ALTERED'+one+two+'\n</body></html>'),{...meta,expectedSha256:sha(orig)});
  assert.notEqual(normalized?.normalizedSha256,sha(orig));
 });
}
test('legacy verified Cloudflare Beacon remains pinned',()=>{
 const orig='<html><body>APP</body></html>';
 assert.deepEqual(normalizeCloudflareIndex(Buffer.from('<html><body>APP'+f.jsd+f.beacon+'</body></html>'),{...meta,expectedSha256:sha(orig)}).providerTransforms,
 ['cloudflare-jsd-v1','cloudflare-analytics-20261014']);
});
test('no wildcard acceptance of altered scripts, two Beacons or an unknown interstitial script',()=>{
 const base='<html><body>APP';
 for(const mutation of [
   pin.replace('vce701823e78c4301a35b7e07294d87301792088814092','v00000000000000000000000000000000000000000000'),
   pin.replace('sha512-UKNk8','sha512-WRONG'),
   pin.replace('29dff8015f9a492385ac7d9826d7acc3','00000000000000000000000000000000')
 ]){
   assert.equal(normalizeCloudflareIndex(Buffer.from(base+f.jsd+mutation+'</body></html>'),meta),null);
 }
 for(const payload of [f.jsd+'<script>unknown()</script>'+pin,f.jsd+pin+pin,
    pin+f.jsd+pin,pin+' '+f.jsd+' '+f.jsd])assert.equal(normalizeCloudflareIndex(Buffer.from(base+payload+'</body></html>'),meta),null);
});
test('wrong server and challenge always refused',()=>{
 const html=Buffer.from('<html><body>APP'+f.jsd+pin+'</body></html>');
 assert.equal(normalizeCloudflareIndex(html,{...meta,server:'elsewhere'}),null);
 assert.equal(normalizeCloudflareIndex(html,{...meta,mitigated:'challenge'}),null);
});
