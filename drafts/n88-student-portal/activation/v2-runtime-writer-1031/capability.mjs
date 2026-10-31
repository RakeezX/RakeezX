/** AI: server-construction token minted only after the actual session read. */
import {verifySafeBoundary,loggingSql,safeLoggingProfile} from '../v2-hosted-compat-1031/boundary.mjs';
const capabilities=new WeakSet();
export const runtimeIdentitySql=`select session_user::text as login,current_user::text as role,r.rolsuper as superuser,r.rolbypassrls as bypass,r.rolcreaterole as create_role,r.rolcreatedb as create_db,pg_has_role(current_user,'n88_guard','SET') as owner_set,pg_has_role(current_user,'n88_v2_guard','SET') as guard_set,i.database_name,i.system_identifier from pg_roles r cross join n88_private.v2_runtime_identity_1031() i where r.rolname=current_user`;
export async function authorizeRuntimeConnection(client,{expectedSystemIdentifier,assertTransport}){
 await assertTransport(client);const result=await client.query(runtimeIdentitySql);const identity=result.rows?.[0];
 if(result.rows?.length!==1||identity?.database_name!=='postgres'||identity.system_identifier!==expectedSystemIdentifier||identity.login!=='n88_backend'||identity.role!=='n88_backend'||identity.superuser||identity.bypass||identity.create_role||identity.create_db||identity.owner_set||identity.guard_set)throw Error('n88_restricted_runtime_required');
 // Default verbosity is accepted ONLY after exact versioned database boundary verification.
 await verifySafeBoundary(client);
 const logging=(await client.query(loggingSql)).rows?.[0];
 if(!safeLoggingProfile(logging))throw Error('n88_private_runtime_logging_required');
 const token=Object.freeze({});capabilities.add(token);return token;
}
export const publicationRuntimeAllowed=(mode,token)=>mode==='synthetic'||mode==='hosted'&&capabilities.has(token);
