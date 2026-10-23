/** AI: synthetic metadata only; no service connection or private state. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compareHistorical,nonPinDigest} from '../../drafts/n88-student-portal/activation/read-service-20261023/config-provenance.mjs';
import {hash} from '../../drafts/n88-student-portal/activation/read-service-20261023/prepare.mjs';
const h=s=>hash(s),historical=[{name:'N88_HMAC_KEY',digest:h('fabricated-critical')},{name:'SUPABASE_URL',digest:h('fabricated-platform')},{name:'N44_ENABLED',digest:h('false')}];
const expectedDigest=nonPinDigest(historical),criticalExpected=historical.slice(0,2);
const compare=(current,hist=historical,digest=expectedDigest)=>compareHistorical({current,historical:hist,expectedDigest:digest,criticalExpected});
const same=compare(historical);assert.equal(same.eligibleForCertificate,true);assert.equal(same.certificateIssued,false);
const versioned=[...historical,{name:'N88_RECOVERY_KEY_v1',digest:h('fabricated-versioned')}];
assert.equal(compareHistorical({current:versioned,historical:versioned,expectedDigest:nonPinDigest(versioned),criticalExpected}).eligibleForCertificate,true);
const changed=historical.map(r=>r.name==='N44_ENABLED'?{...r,digest:h('true')}:r);
assert.equal(compare(changed).eligibleForCertificate,false);assert.deepEqual(compare(changed).unresolved,['N44_ENABLED']);
assert.equal(compare([...historical,{name:'N44_UNKNOWN',digest:h('extra')}]).eligibleForCertificate,false);
assert.equal(compare(historical.slice(0,2)).eligibleForCertificate,false);
assert.equal(compare(historical,null).baselineValid,false);
assert.equal(compare(historical,changed).baselineValid,false);
assert.equal(compare(historical,historical,h('tampered aggregate')).baselineValid,false);
const critical=historical.map(r=>r.name==='N88_HMAC_KEY'?{...r,digest:h('changed-critical')}:r);
assert.deepEqual(compare(critical).criticalFailures,['N88_HMAC_KEY']);assert.equal(compare(critical).eligibleForCertificate,false);
assert.throws(()=>compare([...historical,historical[0]]),/metadata_shape/);
assert.throws(()=>compare([{name:'N88_HMAC_KEY',digest:'raw-secret'}]),/metadata_shape/);
assert.equal(compare(changed).certificateIssued,false); // no blanket exclusion for another Product
await writeFile(new URL('./config-provenance-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',checks:['exact historical aggregate required','changed key unresolved including N44','unknown and missing key denied','critical value drift denied','tampered historical map or aggregate denied','invalid and duplicate metadata denied','no certificate issuance or baseline adoption'],providerOperations:0,syntheticDataOnly:true},null,2)+'\n');
console.log('PASS: finite provenance comparison; no certificate or baseline adoption.');
