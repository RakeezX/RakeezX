// AI-authored synthetic transport only; actual app/Sync/store/guards are unmodified.
import * as cloud from '../../src/lib/cloud.js';
const session=JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY));
cloud.setMockAuth(session.user,session);
const realFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>String(url)===cloud.SUPABASE_URL+'/auth/v1/user'
  ? Promise.resolve(Response.json({id:session.user.id})) : realFetch(url,options);
globalThis.__syncGate=null;
const pause=async()=>{if(globalThis.__syncGate)await globalThis.__syncGate;if(globalThis.__syncFail)throw Error('Synthetic bounded transport failure');return [];};
cloud.setMockBackend({fetchRecords:pause,fetchProfile:pause,getScoreFoundationCapability:()=>null,getUnifiedRestoreCapability:()=>null});

