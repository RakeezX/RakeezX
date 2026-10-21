// AI-authored local-only transport installed before the real account app boots.
import * as cloud from '../../src/lib/cloud.js';
const session=JSON.parse(localStorage.getItem(cloud.AUTH_STORAGE_KEY));
cloud.setMockAuth(session.user,session);
const realFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>String(url)===cloud.SUPABASE_URL+'/auth/v1/user'
 ? Promise.resolve(Response.json({id:session.user.id})) : realFetch(url,options);
cloud.setMockBackend({fetchRecords:async()=>[],fetchProfile:async()=>null,
 getScoreFoundationCapability:()=>null,getUnifiedRestoreCapability:()=>null});
