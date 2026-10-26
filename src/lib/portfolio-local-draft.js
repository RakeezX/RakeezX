/**
 * F09 Preview-only local draft storage. Product DB v8, Cloud Sync, RLS and
 * backup-v2 are deliberately untouched. No data is sent to any service.
 * A workspace's existing owner-scoped database name is the storage boundary.
 */
const VERSION=1;
const SCHEMA=1;
const MIME=new Set(['image/png','image/jpeg','image/webp']);
const WORKSPACE_NAME=/^(?:rakeezx-demo|rakeezx-user-[0-9a-f]{32})$/;
const onlyString=value=>typeof value==='string'?value.trim():'';
const error=(code,message)=>Object.assign(new Error(message),{code});
export function portfolioLocalScope(workspace,year) {
  const source=onlyString(workspace?.databaseName);
  const yearId=onlyString(year?.id);
  if(!WORKSPACE_NAME.test(source)||!yearId||yearId.length>160)return null;
  if(workspace.type==='demo' && source!=='rakeezx-demo')return null;
  if(workspace.type==='account' &&
    (!source.startsWith('rakeezx-user-')||!onlyString(workspace.authUserId)))return null;
  if(workspace.type!=='demo'&&workspace.type!=='account')return null;
  return Object.freeze({
    databaseName:'rakeezx-f09-drafts-'+source,
    workspaceDatabase:source,
    ownerId:workspace.type==='demo'?'demo':workspace.authUserId,
    yearId,
    key:source+'::'+yearId,
    type:workspace.type,
  });
}
export const portfolioAttachmentId=(scope,id)=>scope.yearId+':'+id;
export const isPortfolioConflict=e=>e?.code==='PORTFOLIO_LOCAL_CONFLICT';
function openLocalDB(scope) {
  if(!scope?.databaseName||!scope?.ownerId||!scope?.yearId)
    return Promise.reject(error('PORTFOLIO_SCOPE_REQUIRED','Invalid portfolio storage scope'));
  if(typeof indexedDB==='undefined')
    return Promise.reject(error('PORTFOLIO_STORAGE_UNAVAILABLE','IndexedDB is unavailable'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(scope.databaseName,VERSION);
    req.onupgradeneeded=()=>{
      const database=req.result;
      if(!database.objectStoreNames.contains('drafts'))
        database.createObjectStore('drafts',{keyPath:'id'});
      if(!database.objectStoreNames.contains('images')) {
        const images=database.createObjectStore('images',{keyPath:'id'});
        images.createIndex('byYear','yearId',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error??error('PORTFOLIO_DB_OPEN_FAILED','Cannot open portfolio storage'));
    req.onblocked=()=>reject(error('PORTFOLIO_DB_BLOCKED','Another open tab is blocking local storage'));
  });
}
const getRequest=request=>new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
function complete(tx) {
  return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error??error('PORTFOLIO_DB_TX_FAILED','Portfolio transaction failed'));
    tx.onabort=()=>reject(tx.abortReason??tx.error??error('PORTFOLIO_DB_ABORTED','Portfolio transaction aborted'));
  });
}
export async function loadPortfolioLocal(scope) {
  const db=await openLocalDB(scope);
  try {
    const tx=db.transaction(['drafts','images'],'readonly');
    const committed=complete(tx);
    const draft=getRequest(tx.objectStore('drafts').get(scope.yearId));
    const attachments=getRequest(tx.objectStore('images').index('byYear').getAll(scope.yearId));
    const [record,images]=await Promise.all([draft,attachments]);
    await committed;
    if(!record)return {revision:0,payload:null,images:new Map()};
    if(record.schema!==SCHEMA||record.ownerId!==scope.ownerId||
      record.workspaceDatabase!==scope.workspaceDatabase||record.yearId!==scope.yearId)
      throw error('PORTFOLIO_OWNER_MISMATCH','Portfolio document does not match this account/year');
    const byId=new Map(images.filter(item=>
      item?.yearId===scope.yearId&&item.ownerId===scope.ownerId&&
      item.workspaceDatabase===scope.workspaceDatabase&&item.blob instanceof Blob
    ).map(item=>[item.photoId,item]));
    const references=(record.payload?.photos??[]).flatMap(([,group])=>group);
    if(references.some(photo=>!byId.has(photo.id)))
      throw error('PORTFOLIO_ATTACHMENT_MISSING','Some saved portfolio images could not be recovered');
    return {revision:record.revision,payload:record.payload,images:byId,
      savedAt:record.savedAt};
  } finally {db.close();}
}
/**
 * One atomic transaction covers the document, new Blob attachments and removal
 * of unreferenced images. A concurrent tab cannot overwrite a newer revision.
 */
export async function savePortfolioLocal(scope,{payload,images=[],expectedRevision=0}) {
  if(!payload||typeof payload!=='object'||!Array.isArray(payload.photos))
    throw error('PORTFOLIO_PAYLOAD_INVALID','Portfolio draft payload is invalid');
  const referenced=new Set();
  for(const pair of payload.photos){
    if(!Array.isArray(pair)||!Array.isArray(pair[1]))
      throw error('PORTFOLIO_PHOTOS_INVALID','Portfolio photo manifest is invalid');
    for(const photo of pair[1]){
      if(!onlyString(photo?.id)||referenced.has(photo.id))
        throw error('PORTFOLIO_PHOTO_ID_INVALID','Duplicate or empty image ID');
      referenced.add(photo.id);
    }
  }
  if(images.length>referenced.size)throw error('PORTFOLIO_PHOTO_INPUT','Image data is not referenced by this document');
  for(const photo of images){
    if(!referenced.has(photo.id)||!(photo.blob instanceof Blob)||
      !MIME.has(photo.blob.type)||photo.blob.size>6*1024*1024)
      throw error('PORTFOLIO_IMAGE_INVALID','Unsupported or oversized portfolio image');
  }
  const db=await openLocalDB(scope);
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['drafts','images'],'readwrite');
      const drafts=tx.objectStore('drafts'),items=tx.objectStore('images');
      let reason=null,revision=0;
      tx.oncomplete=()=>resolve({revision,savedAt});
      tx.onerror=()=>reject(reason??tx.error??error('PORTFOLIO_SAVE_FAILED','Portfolio local save failed'));
      tx.onabort=()=>reject(reason??tx.error??error('PORTFOLIO_SAVE_ABORTED','Portfolio local save aborted'));
      const savedAt=new Date().toISOString();
      const existing=drafts.get(scope.yearId);
      existing.onsuccess=()=>{
        const previous=existing.result;
        if(previous && (previous.ownerId!==scope.ownerId||
          previous.workspaceDatabase!==scope.workspaceDatabase||previous.schema!==SCHEMA)){
          reason=error('PORTFOLIO_OWNER_MISMATCH','Portfolio owner/year mismatch');
          tx.abort();return;
        }
        if((previous?.revision??0)!==expectedRevision) {
          reason=error('PORTFOLIO_LOCAL_CONFLICT','Another tab changed this portfolio');
          tx.abort();return;
        }
        revision=expectedRevision+1;
        drafts.put({id:scope.yearId,yearId:scope.yearId,ownerId:scope.ownerId,
          workspaceDatabase:scope.workspaceDatabase,schema:SCHEMA,revision,savedAt,payload});
        for(const photo of images)items.put({
          id:portfolioAttachmentId(scope,photo.id),
          yearId:scope.yearId,ownerId:scope.ownerId,
          workspaceDatabase:scope.workspaceDatabase,photoId:photo.id,
          blob:photo.blob,
        });
        const cursor=items.index('byYear').openCursor(scope.yearId);
        cursor.onsuccess=()=>{
          const row=cursor.result;
          if(!row)return;
          if(row.value.ownerId!==scope.ownerId ||
            row.value.workspaceDatabase!==scope.workspaceDatabase){
            reason=error('PORTFOLIO_OWNER_MISMATCH','Invalid image ownership');
            tx.abort();return;
          }
          if(!referenced.has(row.value.photoId))row.delete();
          row.continue();
        };
      };
    });
  }finally{db.close();}
}
export async function removePortfolioLocal(scope,{expectedRevision=0}={}) {
  const db=await openLocalDB(scope);
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(['drafts','images'],'readwrite');
      const docs=tx.objectStore('drafts'),items=tx.objectStore('images');
      let reason=null;
      tx.oncomplete=resolve;tx.onerror=()=>reject(reason??tx.error);
      tx.onabort=()=>reject(reason??tx.error);
      const r=docs.get(scope.yearId);
      r.onsuccess=()=>{
        const prev=r.result;
        if(!prev)return;
        if(prev.ownerId!==scope.ownerId||prev.workspaceDatabase!==scope.workspaceDatabase||
          prev.revision!==expectedRevision) {
          reason=error('PORTFOLIO_LOCAL_CONFLICT','Portfolio changed in another tab');tx.abort();return;
        }
        docs.delete(scope.yearId);
        const cursor=items.index('byYear').openCursor(scope.yearId);
        cursor.onsuccess=()=>{
          if(!cursor.result)return;
          cursor.result.delete();cursor.result.continue();
        };
      };
    });
  } finally {db.close();}
}
