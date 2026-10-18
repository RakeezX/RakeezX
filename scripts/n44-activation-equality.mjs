/** AI: fixed-role, read-only SCRAM equality. Never connects as the service role. */
import {pbkdf2Sync,createHmac,createHash} from 'node:crypto';

// Password is the original task-generated ASCII hex; no Unicode normalization ambiguity.
export function expectedKeys(password,challenge){
 if(!/^[a-f0-9]{64}$/.test(password)||challenge.iterations!=='16384'||
    !/^[A-Za-z0-9+/]{22}==$/.test(challenge.salt))throw Error('n44_equality_input_shape');
 const salt=Buffer.from(challenge.salt,'base64');
 if(salt.length!==16||salt.toString('base64')!==challenge.salt)throw Error('n44_equality_salt_shape');
 const salted=pbkdf2Sync(password,salt,Number(challenge.iterations),32,'sha256');
 const client=createHmac('sha256',salted).update('Client Key').digest();
 try{return {stored:createHash('sha256').update(client).digest(),server:createHmac('sha256',salted).update('Server Key').digest()};}
 finally{salt.fill(0);salted.fill(0);client.fill(0);}
}
// No raw verifier/authentication keys are projected from pg_authid.
const owned=`rolname='n44_service_login' and not rolcanlogin and not rolinherit
 and not rolsuper and not rolcreatedb and not rolcreaterole and not rolreplication and not rolbypassrls
 and rolconnlimit=-1 and rolvaliduntil is null
 and not exists(select 1 from pg_catalog.pg_auth_members where member=pg_authid.oid)`;
export const challengeSql=`select
 split_part(split_part(rolpassword,'$',2),':',2) as salt,
 split_part(split_part(rolpassword,'$',2),':',1) as iterations
 from pg_catalog.pg_authid where ${owned} and split_part(rolpassword,'$',1)='SCRAM-SHA-256';`;
export function comparisonSql(keys,challenge){
 if(!Buffer.isBuffer(keys.stored)||!Buffer.isBuffer(keys.server)||keys.stored.length!==32||keys.server.length!==32||
    challenge.iterations!=='16384'||!/^[A-Za-z0-9+/]{22}==$/.test(challenge.salt))throw Error('n44_equality_compare_shape');
 // Only client-derived keys enter this private SQL input. All values are fixed-format Base64.
 return `select true as "roleStillOwnedAndDisabled",
 split_part(split_part(rolpassword,'$',2),':',2)='${challenge.salt}' and split_part(split_part(rolpassword,'$',2),':',1)='16384' as "publicChallengeShapeValid",
 split_part(split_part(rolpassword,'$',3),':',1)='${keys.stored.toString('base64')}' as "storedKeyMatchesRecoveredCredential",
 split_part(split_part(rolpassword,'$',3),':',2)='${keys.server.toString('base64')}' as "serverKeyMatchesRecoveredCredential"
 from pg_catalog.pg_authid where ${owned};`;
}
export function validateComparison(rows){
 const names=['roleStillOwnedAndDisabled','publicChallengeShapeValid','storedKeyMatchesRecoveredCredential','serverKeyMatchesRecoveredCredential'];
 if(rows?.length!==1||Object.keys(rows[0]).sort().join(',')!==names.sort().join(',')||Object.values(rows[0]).some(v=>typeof v!=='boolean')||
    !rows[0].roleStillOwnedAndDisabled||!rows[0].publicChallengeShapeValid)throw Error('n44_equality_state_changed');
 return rows[0];
}
