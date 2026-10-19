/** AI: restore each pooled session's original login before identity/TLS metadata. */
import {assertRestrictedIdentity} from './database-transport.mjs';
import {runtimeFailure,identityQueryFailure} from './runtime-failure.mjs';
export async function prepareRequestSession(client,targetKind,assertPrivate){
 let phase='set_role',identity={targetKind,queryCompleted:false,returnedOneRow:false};
 try{
  // SET ROLE persists after COMMIT and pool release. The restricted backend role
  // cannot inspect its login role's pg_stat_ssl row. Restore original session
  // authority, verify every original guard, then return to the private role.
  await client.query('reset role');
  phase='identity';try{await assertRestrictedIdentity(client,v=>{identity={...identity,...v};});}catch(e){if(!identity.queryCompleted)identity.queryFailure=identityQueryFailure(e);throw e;}
  phase='set_role';await client.query('set role n44_backend');
  phase='private_session';await assertPrivate(client,()=>{phase='source';});
 }catch(e){throw runtimeFailure(phase,e,identity);}
}
