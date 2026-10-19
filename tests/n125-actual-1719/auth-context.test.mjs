// AI-authored N125: no-op verification preserves context; real Auth fields still invalidate it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloud from '../../src/lib/cloud.js';
const owner='a7300000-0000-4000-8000-000000000001';
const storage=new Map();
globalThis.localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
test('identical verification preserves references; nested identity and token changes remain observable',async()=>{
 const initial={access_token:'synthetic-initial',refresh_token:'synthetic-refresh',expires_at:4102444800,user:{id:owner,user_metadata:{name:'Synthetic',nested:{a:1,b:2}}}};
 cloud.setMockAuth(initial.user,initial);localStorage.setItem(cloud.AUTH_STORAGE_KEY,JSON.stringify(initial));
 let notifications=0;const unsubscribe=cloud.subscribe(()=>notifications++),originalFetch=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({user_metadata:{nested:{b:2,a:1},name:'Synthetic'},id:owner});
  await cloud.verifyCurrentAuthIdentity(owner);
  assert.equal(cloud.session,initial);assert.equal(cloud.user,initial.user);assert.equal(notifications,0);
  globalThis.fetch=async()=>Response.json({...cloud.user,user_metadata:{...cloud.user.user_metadata,nested:{a:1,b:3}}});
  await cloud.verifyCurrentAuthIdentity(owner);
  assert.notEqual(cloud.session,initial);assert.equal(cloud.user.user_metadata.nested.b,3);assert.equal(notifications,1);
  const before=cloud.session;
  globalThis.fetch=async()=>Response.json({...before,access_token:'synthetic-new-token'});
  await cloud.refreshSession();
  assert.notEqual(cloud.session,before);assert.equal(cloud.session.access_token,'synthetic-new-token');assert.equal(notifications,2);
 }finally{unsubscribe();globalThis.fetch=originalFetch;cloud.setMockAuth(null,null);}
});
