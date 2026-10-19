/** AI: original N88 restricted role, exact official endpoint and scoped TLS trust. */
import {createHash} from 'node:crypto';
export function databaseConfig(readEnv){
 const url=readEnv('N88_DATABASE_URL'),db=new URL(url),user=decodeURIComponent(db.username);
 const direct=user==='n88_backend'&&db.hostname==='db.xlrubcwjqktzzunrvuns.supabase.co';
 const session=user==='n88_backend.xlrubcwjqktzzunrvuns'&&db.hostname==='aws-0-ap-south-1.pooler.supabase.com';
 const ca=readEnv('N88_DATABASE_CA_CERT');
 if(!['postgres:','postgresql:'].includes(db.protocol)||!(direct||session)||!['','5432'].includes(db.port)||db.pathname!=='/postgres'||!db.password||db.search||db.hash||typeof ca!=='string'||createHash('sha256').update(ca.replaceAll('\r\n','\n')).digest('hex')!=='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7')throw Error('n88_database_configuration');
 return {connectionString:url,ssl:{ca,rejectUnauthorized:true,servername:db.hostname,minVersion:'TLSv1.2'},max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:3000,query_timeout:4000,application_name:'n88-private-server',allowExitOnIdle:true};
}
export async function assertRestrictedTransport(client){
 const r=(await client.query("select session_user as login,current_user as role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) as ssl")).rows[0];
 const flags={loginExact:r?.login==='n88_backend',roleExact:r?.role==='n88_backend',upstreamSsl:r?.ssl===true,clientTlsAuthorized:client.connection?.stream?.authorized===true};
 if(Object.values(flags).some(v=>v!==true)){const e=Error('n88_transport_invariants');e.safeReadiness=flags;throw e;}
 return flags;
}
