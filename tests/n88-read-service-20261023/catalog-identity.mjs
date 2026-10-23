import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {canonicalCatalog} from '../../drafts/n88-student-portal/activation/read-service-20261023/catalog-identity.mjs';
const rows=JSON.parse(await readFile(new URL('../../drafts/n88-student-portal/activation/read-service-20261023/error-boundary-identities.json',import.meta.url),'utf8'));
const reordered=rows.map(r=>Object.fromEntries(Object.entries(r).reverse()));
assert.notEqual(JSON.stringify(rows),JSON.stringify(reordered));assert.deepEqual(canonicalCatalog(reordered),rows);
for(const key of Object.keys(rows[0])){
 const changed=structuredClone(reordered);changed[0][key]=key==='definer'?true:'synthetic-drift';
 assert.notDeepEqual(canonicalCatalog(changed),rows);
}
assert.throws(()=>canonicalCatalog([{...rows[0],extra:true}]),/fields_shape/);
const missing={...rows[0]};delete missing.acl;assert.throws(()=>canonicalCatalog([missing]),/fields_shape/);
assert.notDeepEqual(canonicalCatalog([...reordered].reverse()),rows);
await writeFile(new URL('./catalog-identity-local.json',import.meta.url),JSON.stringify({aiAuthored:true,status:'PASS',onlyObjectFieldOrderNormalized:true,allSevenValuesAndRowOrderExact:true,extraMissingFieldsDenied:true,providerOperations:0},null,2)+'\n');
console.log('PASS: exact catalog identity independent of JSON field ordering; no value conversion.');
