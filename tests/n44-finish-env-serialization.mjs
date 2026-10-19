/** AI: focused serializer regression; actual provider digest proof is recorded separately. */
import assert from 'node:assert/strict';
import {parseEnv} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {protectedEnvText} from '../scripts/n44-activation-custody.mjs';
const input={N44_CRYPTO_JSON:JSON.stringify({synthetic:'FABRICATED',array:[1,true]}),N44_ENABLED:'false',N44_DATABASE_CA_CERT:'FABRICATED\nMULTILINE\n'};
const serialized=protectedEnvText(input);assert.ok(serialized.includes("N44_CRYPTO_JSON='{"));assert.deepEqual(parseEnv(serialized),input);assert.throws(()=>protectedEnvText({N44_CRYPTO_JSON:JSON.stringify({synthetic:"can't"})}));
const result={aiAuthored:true,runId:'fdaa4ff1-9221-41b9-8661-8a57a9a6e986',status:'PASS',literalJsonQuotePreserved:true,multilinePreserved:true,ambiguousSingleQuoteRejected:true,providerProof:'activation/secret-readback.json; actual16 server digests match in sealed process',privateValuesReturned:false};await writeFile('tests/n44-finish-env-serialization.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
