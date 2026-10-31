/** AI: server-construction token minted only after the actual session read. */
const capabilities=new WeakSet();
export const runtimeIdentitySql=`select session_user::text as login,current_user::text as role,r.rolsuper as superuser,r.rolbypassrls as bypass,r.rolcreaterole as create_role,r.rolcreatedb as create_db,pg_has_role(current_user,'n88_guard','SET') as owner_set,pg_has_role(current_user,'n88_v2_guard','SET') as guard_set,i.database_name,i.system_identifier from pg_roles r cross join n88_private.v2_runtime_identity_1031() i where r.rolname=current_user`;
export async function authorizeRuntimeConnection(client,{expectedSystemIdentifier,assertTransport}){
 await assertTransport(client);const result=await client.query(runtimeIdentitySql);const identity=result.rows?.[0];
 if(result.rows?.length!==1||identity?.database_name!=='postgres'||identity.system_identifier!==expectedSystemIdentifier||identity.login!=='n88_backend'||identity.role!=='n88_backend'||identity.superuser||identity.bypass||identity.create_role||identity.create_db||identity.owner_set||identity.guard_set)throw Error('n88_restricted_runtime_required');
 // Installed V2 functions use native parameters. Unlike the legacy ASCII error
 // wrappers, their constraint DETAIL must never enter server logs. Fail closed
 // on the actual restricted session profile; never change global/session policy.
 const logging=(await client.query("select current_setting('log_error_verbosity') as verbosity,current_setting('log_parameter_max_length_on_error') as parameters,current_setting('log_statement') as statements,current_setting('log_min_duration_statement') as duration,current_setting('log_min_duration_sample') as sample,current_setting('log_transaction_sample_rate') as sampling,current_setting('pgaudit.log',true) as audit,(select setting from pg_settings where name='auto_explain.log_min_duration') as explain")).rows[0];
 if(!logging||logging.verbosity!=='terse'||logging.parameters!=='0'||!['none','ddl'].includes(logging.statements)||logging.duration!=='-1'||logging.sample!=='-1'||Number(logging.sampling)!==0||![null,'none'].includes(logging.audit)||![null,'-1'].includes(logging.explain))throw Error('n88_private_runtime_logging_required');
 const token=Object.freeze({});capabilities.add(token);return token;
}
export const publicationRuntimeAllowed=(mode,token)=>mode==='synthetic'||mode==='hosted'&&capabilities.has(token);
