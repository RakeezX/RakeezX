/** AI: exact restricted PostgreSQL transport. No plaintext/pooler-to-DB downgrade. */
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
export function databaseConfig(readEnv){
 const url=readEnv('N44_DATABASE_URL'),db=new URL(url),user=decodeURIComponent(db.username);
 const direct=user==='n44_service_login'&&db.hostname==='db.xlrubcwjqktzzunrvuns.supabase.co';
 const session=user==='n44_service_login.xlrubcwjqktzzunrvuns'&&db.hostname==='aws-0-ap-south-1.pooler.supabase.com';
 const ca=readEnv('N44_DATABASE_CA_CERT');
 if(!['postgres:','postgresql:'].includes(db.protocol)||!(direct||session)||!['','5432'].includes(db.port)||db.pathname!=='/postgres'||!db.password||db.search||db.hash||typeof ca!=='string'||createHash('sha256').update(ca).digest('hex')!=='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7')throw Error('n44_database_configuration');
 return {connectionString:url,ssl:{ca,rejectUnauthorized:true,servername:db.hostname,minVersion:'TLSv1.2'},max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:3000,query_timeout:4000,application_name:'n44-private-server',allowExitOnIdle:true};
}
export async function assertRestrictedIdentity(client,observe=()=>{}){
 const result=await client.query("select session_user as login,current_user as role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl");
 observe({queryCompleted:true,returnedOneRow:result.rows?.length===1});
 const row=result.rows[0];
 const flags={loginExact:row?.login==='n44_service_login',roleExact:row?.role==='n44_service_login'||row?.role==='n44_backend',upstreamSsl:row?.ssl===true,clientTlsAuthorized:client.connection?.stream?.authorized===true};
 if(Object.values(flags).some(v=>v!==true)){const e=Error('n44_transport_invariants');e.safeReadiness=flags;throw e;}
 return flags;
}
