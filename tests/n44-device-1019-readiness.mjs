/** AI: only the new authenticated public-key/readiness projection. No live operations. */
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {deviceReadinessConfiguration} from '../drafts/n44-push/readiness-entry.mjs';
const now=Date.now(),pair=createECDH('prime256v1');pair.generateKeys();
const approval={testId:'n44-one-device-20261019',runId:'a4b73532-2bc6-4327-98e7-89c5edb7bcee',ownerId:'synthetic',workspaceId:'synthetic',deviceId:'synthetic',expiresAt:Math.min(now+3600000,Date.parse('2026-10-20T00:00:00Z')),target:null};
const env={N44_SERVICE_SOURCE_SHA:'a'.repeat(40),N44_DELIVERY_ENABLED:'false',N44_ONE_DEVICE_TEST_JSON:JSON.stringify(approval),N44_CRYPTO_JSON:JSON.stringify({activeVapidKeyId:'v1',vapidKeys:[['v1',{publicKey:pair.getPublicKey().toString('base64url'),privateKey:pair.getPrivateKey().toString('base64url')}]]})};
const read=n=>env[n],good=deviceReadinessConfiguration(read);assert.equal(good.status,'ready');assert.equal(good.targetBound,false);assert.equal(good.publicKey,pair.getPublicKey().toString('base64url'));assert.equal(JSON.stringify(good).includes('privateKey'),false);assert.equal('ownerId' in good,false);
env.N44_DELIVERY_ENABLED='true';assert.equal(deviceReadinessConfiguration(read).status,'disabled');env.N44_DELIVERY_ENABLED='false';
const other=createECDH('prime256v1');other.generateKeys();const c=JSON.parse(env.N44_CRYPTO_JSON);c.vapidKeys[0][1].publicKey=other.getPublicKey().toString('base64url');env.N44_CRYPTO_JSON=JSON.stringify(c);assert.equal(deviceReadinessConfiguration(read).status,'disabled');
delete env.N44_ONE_DEVICE_TEST_JSON;assert.equal(deviceReadinessConfiguration(read).status,'disabled');
await writeFile('tests/n44-device-1019-readiness.json',JSON.stringify({taskId:'continuous-n44-single-device-optin-ready-20261019',runId:'05fd1236-442a-4fbf-add3-e9b9c20bb8e1',checks:[{name:'public_key_matches_existing_server_pair_and_approval',status:'PASS',evidence:'New projection exposes only matching public VAPID/source metadata and unbound-target status; wrong pair, missing approval and delivery ON fail closed. Synthetic in-memory keys only; no prior crypto/PG/UI replay.'}],liveOperations:0},null,2)+'\n');
console.log('PASS: new public readiness projection; no live operation.');
