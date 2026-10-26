/**
 * Preview-only F09 portable safety copy, NOT the N71 unified Product backup.
 * Read-only source: the owner/year-bound F09 IndexedDB document and image Blobs.
 * Restore is caller-confirmed and never mutates Rakeez Product stores or cloud.
 */
import { restorePortfolioDraft } from './portfolio-local-state.js';
import { savePortfolioLocal } from './portfolio-local-draft.js';

export const PORTFOLIO_ARCHIVE_KIND='rakeezx-f09-local-archive';
export const PORTFOLIO_ARCHIVE_VERSION=1;
export const PORTFOLIO_ARCHIVE_LIMIT=105*1024*1024;
export const PORTFOLIO_ARCHIVE_IMAGE_LIMIT=100*1024*1024;
export const PORTFOLIO_ARCHIVE_IMAGE_COUNT=180;
const imageTypes=new Set(['image/png','image/jpeg','image/webp']);
const err=(code,detail)=>Object.assign(new Error(detail),{code});
const validateScope=scope=>{
  if(!scope?.ownerId||!scope.yearId||!scope.workspaceDatabase)
    throw err('PORTFOLIO_ARCHIVE_SCOPE','Missing account/year scope');
};
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(
    Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
const digest=async bytes=>{
  if(!globalThis.crypto?.subtle)throw err('PORTFOLIO_ARCHIVE_CRYPTO','Secure hashing unavailable');
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const hashObject=value=>digest(new TextEncoder().encode(JSON.stringify(canonical(value))));
const validHex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
function encode64(bytes) {
  let result='';
  for(let i=0;i<bytes.length;i+=16384)
    result+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(result);
}
function decode64(value) {
  if(typeof value!=='string'||value.length%4!==0||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw err('PORTFOLIO_ARCHIVE_IMAGE','Invalid image encoding');
  const binary=atob(value);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function checkPayload(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    !Array.isArray(payload.photos)||!Array.isArray(payload.customWitnesses)||
    !Array.isArray(payload.criterionNames)||!Array.isArray(payload.extraCriteria)||
    !Array.isArray(payload.includedWitnesses)||!Array.isArray(payload.hiddenWitnesses))
    throw err('PORTFOLIO_ARCHIVE_DOCUMENT','Invalid portfolio metadata');
  const ids=new Set();
  for(const pair of payload.photos){
    if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!Array.isArray(pair[1]))
      throw err('PORTFOLIO_ARCHIVE_DOCUMENT','Invalid image manifest');
    for(const photo of pair[1]){
      if(!photo||typeof photo.id!=='string'||!photo.id||ids.has(photo.id)||
        typeof photo.name!=='string'||photo.name.length>70||
        !Number.isSafeInteger(photo.bytes)||photo.bytes<0||photo.bytes>6*1024*1024)
        throw err('PORTFOLIO_ARCHIVE_DOCUMENT','Invalid/duplicate image reference');
      ids.add(photo.id);
    }
  }
  return ids;
}
export async function buildPortfolioArchive(scope,{payload,images,savedAt}) {
  validateScope(scope);
  const referenced=checkPayload(payload);
  if(!(images instanceof Map)||images.size!==referenced.size)
    throw err('PORTFOLIO_ARCHIVE_INCOMPLETE','Image references do not match stored attachments');
  if(referenced.size>PORTFOLIO_ARCHIVE_IMAGE_COUNT)
    throw err('PORTFOLIO_ARCHIVE_TOO_LARGE','Too many images for one portable archive');
  const attachments=[];
  let total=0;
  for(const id of [...referenced].sort()) {
    const item=images.get(id),blob=item?.blob;
    if(!(blob instanceof Blob)||!imageTypes.has(blob.type)||
      blob.size>6*1024*1024||blob.size<1)
      throw err('PORTFOLIO_ARCHIVE_IMAGE','Invalid saved portfolio image');
    total+=blob.size;
    if(total>PORTFOLIO_ARCHIVE_IMAGE_LIMIT)
      throw err('PORTFOLIO_ARCHIVE_TOO_LARGE','Too much image data for one portable archive');
    const bytes=new Uint8Array(await blob.arrayBuffer());
    attachments.push({id,type:blob.type,size:blob.size,
      sha256:await digest(bytes),base64:encode64(bytes)});
  }
  const body={
    kind:PORTFOLIO_ARCHIVE_KIND,version:PORTFOLIO_ARCHIVE_VERSION,
    scope:{ownerId:scope.ownerId,yearId:scope.yearId,
      workspaceDatabase:scope.workspaceDatabase,type:scope.type},
    exportedAt:new Date().toISOString(),
    savedAt:typeof savedAt==='string'?savedAt:null,
    payload,attachments,
  };
  const archive={...body,checksum:await hashObject(body)};
  const result=JSON.stringify(archive);
  if(new TextEncoder().encode(result).length>PORTFOLIO_ARCHIVE_LIMIT)
    throw err('PORTFOLIO_ARCHIVE_TOO_LARGE','Portable archive exceeds supported size');
  return result;
}
export async function inspectPortfolioArchive(text,scope){
  validateScope(scope);
  if(typeof text!=='string'||text.length>PORTFOLIO_ARCHIVE_LIMIT)
    throw err('PORTFOLIO_ARCHIVE_TOO_LARGE','Archive too large');
  let value;
  try{value=JSON.parse(text);}catch{throw err('PORTFOLIO_ARCHIVE_JSON','The selected file is not valid JSON');}
  if(!value||Array.isArray(value)||value.kind!==PORTFOLIO_ARCHIVE_KIND||
    value.version!==PORTFOLIO_ARCHIVE_VERSION)
    throw err('PORTFOLIO_ARCHIVE_FORMAT','Not a compatible F09 portfolio archive');
  if(value.scope?.ownerId!==scope.ownerId||value.scope?.yearId!==scope.yearId||
    value.scope?.workspaceDatabase!==scope.workspaceDatabase||value.scope?.type!==scope.type)
    throw err('PORTFOLIO_ARCHIVE_OWNER','This copy belongs to a different account or academic year');
  if(!validHex(value.checksum))
    throw err('PORTFOLIO_ARCHIVE_INTEGRITY','Archive checksum missing');
  const {checksum,...body}=value;
  if(await hashObject(body)!==checksum)
    throw err('PORTFOLIO_ARCHIVE_INTEGRITY','The archive has been changed or corrupted');
  const referenced=checkPayload(value.payload);
  if(!Array.isArray(value.attachments)||
    value.attachments.length!==referenced.size||
    referenced.size>PORTFOLIO_ARCHIVE_IMAGE_COUNT)
    throw err('PORTFOLIO_ARCHIVE_INCOMPLETE','Image list is incomplete');
  const images=[];
  let total=0;
  for(const a of value.attachments){
    if(!a||typeof a.id!=='string'||!referenced.delete(a.id)||
      !imageTypes.has(a.type)||!Number.isSafeInteger(a.size)||
      a.size<1||a.size>6*1024*1024||!validHex(a.sha256))
      throw err('PORTFOLIO_ARCHIVE_IMAGE','Invalid or duplicate image');
    total+=a.size;
    if(total>PORTFOLIO_ARCHIVE_IMAGE_LIMIT)
      throw err('PORTFOLIO_ARCHIVE_TOO_LARGE','Image data exceeds archive limits');
    const bytes=decode64(a.base64);
    if(bytes.byteLength!==a.size||await digest(bytes)!==a.sha256)
      throw err('PORTFOLIO_ARCHIVE_IMAGE','An image is missing or corrupted');
    images.push({id:a.id,blob:new Blob([bytes],{type:a.type})});
  }
  if(referenced.size)throw err('PORTFOLIO_ARCHIVE_INCOMPLETE','Image manifest is incomplete');
  // Validate all photo references through the existing UI codec, but do not
  // allocate object URLs before the user explicitly chooses to restore.
  restorePortfolioDraft(value.payload,
    new Map(images.map(image=>[image.id,{blob:image.blob}])),
    {makeUrl:()=>'blob:validated'});
  return Object.freeze({
    payload:value.payload,images,
    summary:{
      yearId:scope.yearId,photoCount:images.length,
      customWitnesses:value.payload.customWitnesses.length,
      criterionCount:value.payload.extraCriteria.length,
      exportedAt:value.exportedAt,
    },
  });
}
export async function readPortfolioArchiveFile(file,scope) {
  if(!(file instanceof Blob)||file.size<=0||file.size>PORTFOLIO_ARCHIVE_LIMIT)
    throw err('PORTFOLIO_ARCHIVE_TOO_LARGE','Invalid or oversized backup file');
  return inspectPortfolioArchive(await file.text(),scope);
}
export async function applyPortfolioArchive(scope,validated,{expectedRevision}={}) {
  validateScope(scope);
  if(!validated?.payload||!Array.isArray(validated.images)||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0)
    throw err('PORTFOLIO_ARCHIVE_RESTORE','Cannot restore an unverified file');
  return savePortfolioLocal(scope,{
    payload:validated.payload,images:validated.images,expectedRevision,
  });
}
export const portfolioArchiveFilename=(yearId,date=new Date())=>{
  const part=String(yearId??'year').replace(/[^0-9a-z_-]/gi,'-').slice(0,65);
  const stamp=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
  return 'rakeez-portfolio-'+part+'-'+stamp+'.json';
};
