/**
 * F09 draft snapshot codec: no Blob or object URL in document metadata.
 * Actual files remain in a separate IndexedDB attachment store.
 */
const pairs=value=>[...value.entries()];
const values=value=>[...value.values()];
const list=value=>Array.isArray(value)?value:[];
const string=value=>typeof value==='string'?value:'';
const finite=n=>Number.isFinite(n)&&n>=0?n:0;
export function snapshotPortfolioDraft(model) {
  const images=[];
  // A deleted personal witness may remain in memory for one-step Undo, but
  // must not survive a refresh or retain private image Blobs in IndexedDB.
  const liveCustomIds=new Set(model.customWitnesses.map(w=>w.id));
  const keep=id=>!String(id).startsWith('custom:')||liveCustomIds.has(id);
  const keepMap=map=>pairs(map).filter(([key])=>keep(key));
  const keepSet=set=>values(set).filter(keep);
  const photoGroups=keepMap(model.photoGroups).map(([witnessId,group])=>[
    witnessId,group.map(photo=>{
      if(!(photo.blob instanceof Blob))throw new Error('Missing source Blob for portfolio image');
      if(!photo.stored)images.push({id:photo.id,blob:photo.blob});
      return {id:photo.id,name:string(photo.name).slice(0,70),bytes:finite(photo.blob.size)};
    }),
  ]);
  return {
    payload:{
      criterionNames:pairs(model.criterionNames),
      hiddenCriteria:values(model.hiddenCriteria),
      extraCriteria:model.extraCriteria.map(v=>({...v})),
      customWitnesses:model.customWitnesses.map(v=>({...v})),
      hiddenWitnesses:keepSet(model.hiddenWitnesses),
      sectionPreferences:keepMap(model.sectionPreferences).map(([key,opts])=>[key,{...opts}]),
      photoLayouts:keepMap(model.photoLayouts),
      photos:photoGroups,
      selectedByCriterion:pairs(model.selectedByCriterion).filter(([,id])=>keep(id)),
      descriptions:keepMap(model.descriptions),
      titles:keepMap(model.titles),
      includedWitnesses:keepSet(model.includedWitnesses),
      excludedWitnesses:keepSet(model.excludedWitnesses),
      editingCriterion:string(model.editingCriterion)||'09',
      nextExtraCriterionNumber:Number.isSafeInteger(model.nextExtraCriterionNumber)?
        model.nextExtraCriterionNumber:12,
    },
    images,
  };
}
export function restorePortfolioDraft(payload,records,{makeUrl=blob=>URL.createObjectURL(blob)}={}) {
  if(!payload||typeof payload!=='object')throw new Error('Invalid portfolio draft');
  const map=key=>new Map(list(payload[key]));
  const set=key=>new Set(list(payload[key]));
  const photoGroups=new Map();
  const seen=new Set();
  for(const [witnessId,group] of list(payload.photos)) {
    if(!string(witnessId)||!Array.isArray(group))throw new Error('Invalid draft photo group');
    photoGroups.set(witnessId,group.map(photo=>{
      const record=records.get(photo.id);
      if(!record?.blob||seen.has(photo.id))throw new Error('Missing/duplicate portfolio image');
      seen.add(photo.id);
      return {id:photo.id,name:photo.name,bytes:record.blob.size,
        blob:record.blob,url:makeUrl(record.blob),stored:true};
    }));
  }
  return {
    criterionNames:map('criterionNames'),hiddenCriteria:set('hiddenCriteria'),
    extraCriteria:list(payload.extraCriteria).map(v=>({...v})),
    customWitnesses:list(payload.customWitnesses).map(v=>({...v})),
    hiddenWitnesses:set('hiddenWitnesses'),sectionPreferences:map('sectionPreferences'),
    photoLayouts:map('photoLayouts'),photoGroups,
    selectedByCriterion:map('selectedByCriterion'),
    descriptions:map('descriptions'),titles:map('titles'),
    includedWitnesses:set('includedWitnesses'),
    excludedWitnesses:set('excludedWitnesses'),
    editingCriterion:string(payload.editingCriterion)||'09',
    nextExtraCriterionNumber:Number.isSafeInteger(payload.nextExtraCriterionNumber)?
      Math.max(12,payload.nextExtraCriterionNumber):12,
  };
}
