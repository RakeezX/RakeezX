/** AI-authored. Fresh local SCRAM proof only; raw password/verifier never printed. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {startNativePg} from './fixtures/n88-integrated-class/native-pg.mjs';
import {deriveScram} from '../drafts/n88-student-portal/official-activation.mjs';
const {Client}=createRequire(import.meta.url)('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg');
let pg,client;const password=randomBytes(32).toString('hex'),salt=randomBytes(16),iterations=16384;
const salted=pbkdf2Sync(password,salt,iterations,32,'sha256');
const clientKey=createHmac('sha256',salted).update('Client Key').digest();
const storedKey=createHash('sha256').update(clientKey).digest(),serverKey=createHmac('sha256',salted).update('Server Key').digest();
const verifier=deriveScram(password,salt,iterations);
assert.equal(verifier,`SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`);
try {
 pg=await startNativePg(process.cwd());
 await appendFile(pg.phase+'/data/postgresql.auto.conf',"\nlog_statement='ddl'\nlog_min_error_statement='error'\nlog_error_verbosity='default'\nlog_parameter_max_length_on_error=0\n");
 await pg.fixtureQuery('select pg_reload_conf()');
 let observed;
 for(let n=0;n<5;n++){observed=(await pg.fixtureQuery("select current_setting('log_statement') as statements,current_setting('log_error_verbosity') as verbosity,current_setting('log_parameter_max_length_on_error') as parameters")).rows[0];if(observed.statements==='ddl')break;await new Promise(ok=>setTimeout(ok,20));}
 assert.deepEqual(observed,{statements:'ddl',verbosity:'default',parameters:'0'});
 // Local cryptographic verifier literal only, matching the explicitly allowed
 // hosted protected-file recipe. No raw password literal or provider operation.
 await pg.fixtureQuery(`alter role n88_backend login password '${verifier}'`);
 client=new Client({host:'127.0.0.1',port:pg.port,database:'postgres',user:'n88_backend',password,ssl:false,connectionTimeoutMillis:2000});
 await client.connect();
 const row=(await client.query('select current_user as role,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname=current_user')).rows[0];
 assert.deepEqual(row,{role:'n88_backend',rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false});
 await client.end();client=null;
 const log=await readFile(pg.phase+'/server.log','utf8');assert.ok(log.includes('alter role n88_backend login password'));assert.ok(log.includes(verifier));assert.ok(!log.includes(password));
 const receipt={status:'PASS',scope:'fresh owned local PG17 only; not hosted TLS or custody installation',rawEntropyBytes:32,algorithm:'SCRAM-SHA-256',iterations,actualRestrictedPasswordAuthentication:true,roleFlags:row,ddlAuditRetained:true,rawPasswordAbsentFromSqlAndLogs:true,verifierNotCopiedToEvidence:true,hostedWrites:0};
 await writeFile('tests/n88-official-activation-scram.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await client?.end();salted.fill(0);clientKey.fill(0);storedKey.fill(0);serverKey.fill(0);await pg?.close();}
