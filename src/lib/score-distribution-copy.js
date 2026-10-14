import { distributionToken, distributionTargets, planAcceptedDistribution } from './score-foundation.js';

export const DISTRIBUTION_MODES = ['definitions', 'preserve-target', 'automatic-safe'];
const live = rows => (rows ?? []).filter(row => !row.deleted);
const ordered = rows => [...rows].sort((a,b) => a.order-b.order || a.id.localeCompare(b.id));
const normalized = name => String(name ?? '').trim().replace(/\s+/g,' ').toLowerCase();
const representation = row => JSON.stringify([row.scoreMode ?? 'direct',row.auto ?? null,row.max,
  row.perPoint ?? 1,row.penalty ?? 1,row.distributionMode ?? 'auto']);
const incompatible = message => { throw new Error(message+'؛ سجلات الفصل الهدف ستبقى كما هي.'); };
export function distributionCopyToken(current,source,targets,mode='definitions') {
  const token=distributionToken(current,source,targets);
  if (mode==='definitions') return token;
  if (mode!=='automatic-safe') return JSON.stringify([mode,token]);
  const scope=new Set([source,...targets]);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value && typeof value==='object'
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  return JSON.stringify([mode,token,...['logs','attendance'].map(name=>canonical(ordered(
    (current[name] ?? []).filter(row=>scope.has(row.teachingId)))))]);
}

/** Synthetic/Demo counterpart only. Account mappings and marks are owned by PostgreSQL. */
export function planScoreDistributionCopy(current,source,targetIds,options={}) {
  const mode=options.mode ?? 'definitions';
  if (!DISTRIBUTION_MODES.includes(mode)) throw new Error('Invalid distribution mode');
  if (mode==='automatic-safe') return planAutomaticCopy(current,source,targetIds,options);
  if (mode==='definitions') return planAcceptedDistribution(current,source,targetIds,options);
  if (options.removeItemIds?.length) throw new Error('Preservation cannot remove target definitions');
  const allowed=new Set(distributionTargets(current,source,options.ownerId ?? null).map(row=>row.id));
  if (!Array.isArray(targetIds)||!targetIds.length||new Set(targetIds).size!==targetIds.length||targetIds.some(id=>!allowed.has(id))) throw new Error('Choose distinct eligible targets');
  const incoming=live(current.items).filter(row=>row.teachingId===source);
  const result={mode,token:distributionCopyToken(current,source,targetIds,mode),targets:[],excludedTargets:[],
    writes:Object.fromEntries(['items','scoreSubitems','scores','scoreSubitemCompletions'].map(name=>[name,{put:[]}])),requiresConfirmation:false,changedCount:0};
  for (const target of targetIds) {
    try {
      const adapted=structuredClone(current), metadata=new Map();
      const existing=live(adapted.items).filter(row=>row.teachingId===target), used=new Set();
      for (const item of incoming) {
        const named=existing.filter(row=>normalized(row.name)===normalized(item.name));
        const origin=existing.filter(row=>row.distributionOriginId===item.id);
        if (origin.length>1 || (!origin.length && (incoming.filter(row=>normalized(row.name)===normalized(item.name)).length!==1 || named.length>1))) incompatible('اسم البند أو أصل هويته مكرر');
        const prior=(origin.length ? origin : named)[0];
        if (!prior) {
          metadata.set(item.name,{preservedScores:0,preservedCompletions:0,subitems:ordered(live(current.scoreSubitems)
            .filter(row=>row.itemId===item.id && item.scoreMode==='subitems')).map(sub=>({name:sub.name,startDate:sub.startDate ?? null,
              dueDate:sub.dueDate ?? null,points:sub.value,latePoints:sub.latePoints ?? sub.value,preserved:false}))});
          continue;
        }
        if (used.has(prior.id)) incompatible('المطابقة تستخدم بند الهدف مرتين');
        used.add(prior.id);
        if (representation(prior)!==representation(item)) incompatible('طريقة الرصد أو الحد الأعلى أو الأوزان مختلفة');
        const sourceSubs=ordered(live(current.scoreSubitems).filter(row=>row.itemId===item.id));
        const targetSubs=ordered(live(adapted.scoreSubitems).filter(row=>row.itemId===prior.id));
        const details=[];
        if (item.scoreMode==='subitems') {
          if (sourceSubs.length!==targetSubs.length || [sourceSubs,targetSubs].some(rows=>new Set(rows.map(row=>row.order)).size!==rows.length)) incompatible('عدد العناصر أو ترتيبها مختلف أو مكرر');
          const subUsed=new Set();
          for (const [index,sub] of sourceSubs.entries()) {
            const origins=targetSubs.filter(row=>row.distributionOriginId===sub.id);
            if (origins.length>1) incompatible('أصل هوية العنصر مكرر');
            const old=origins[0] ?? targetSubs[index];
            if (!old || subUsed.has(old.id) || (!origins.length && old.distributionOriginId && old.distributionOriginId!==sub.id) ||
              old.order!==sub.order || old.value!==sub.value || (old.latePoints ?? old.value)!==(sub.latePoints ?? sub.value)) incompatible('ترتيب العناصر أو نقاطها العادية والمتأخرة أو هويتها مختلف');
            subUsed.add(old.id); old.distributionOriginId=sub.id;
            details.push({targetId:old.id,name:sub.name,startDate:sub.startDate ?? null,dueDate:sub.dueDate ?? null,
              points:sub.value,latePoints:sub.latePoints ?? sub.value,preserved:true});
          }
        } else if (targetSubs.length) incompatible('عناصر الهدف لا تتفق مع طريقة الرصد');
        prior.distributionOriginId=item.id;
        metadata.set(item.name,{preservedScores:live(current.scores).filter(row=>row.itemId===prior.id).length,
          preservedCompletions:live(current.scoreSubitemCompletions).filter(row=>targetSubs.some(sub=>sub.id===row.subitemId)).length,subitems:details});
      }
      const plan=planAcceptedDistribution(adapted,source,[target],{...options,removeItemIds:[]});
      if (plan.excludedTargets.length) { result.excludedTargets.push(...plan.excludedTargets); continue; }
      // The adapted origins establish correspondence before the old planner runs.
      // Persist that correspondence even when the labels/dates already match.
      for (const prior of adapted.items.filter(row=>row.teachingId===target && used.has(row.id))) {
        const original=current.items.find(row=>row.id===prior.id);
        if (prior.distributionOriginId!==original.distributionOriginId && !plan.writes.items.put.some(row=>row.id===prior.id)) {
          plan.writes.items.put.push({...prior,distributionVersion:(prior.distributionVersion ?? 0)+1});
          plan.changedCount++;
        }
      }
      for (const sub of adapted.scoreSubitems.filter(row=>used.has(row.itemId))) {
        const original=current.scoreSubitems.find(row=>row.id===sub.id);
        if (sub.distributionOriginId!==original.distributionOriginId && !plan.writes.scoreSubitems.put.some(row=>row.id===sub.id)) {
          plan.writes.scoreSubitems.put.push({...sub,distributionVersion:
            plan.writes.items.put.find(row=>row.id===sub.itemId)?.distributionVersion ?? sub.distributionVersion});
        }
      }
      for (const name of ['items','scoreSubitems']) {
        for (const row of plan.writes[name].put) {
          const original=current[name].find(old=>old.id===row.id);
          if (!original) row.createdAt=options.stamp ?? Date.now();
          result.writes[name].put.push(row);
        }
      }
      for (const review of plan.targets) {
        review.impact=review.impact.map(item=>({...item,affected:0,examples:[],...metadata.get(item.name)}));
        for (const [name,detail] of metadata) if (!review.impact.some(item=>item.name===name)) {
          const item=incoming.find(row=>row.name===name);
          review.impact.push({name,beforeMax:item.max,max:item.max,affected:0,examples:[],created:false,modeChanged:false,removedSubitems:0,...detail});
        }
      }
      result.targets.push(...plan.targets); result.changedCount+=plan.changedCount;
      result.requiresConfirmation ||= plan.changedCount>0;
    } catch (error) {
      if (!error.message.includes('سجلات الفصل الهدف ستبقى')) throw error;
      result.excludedTargets.push({teachingId:target,reason:error.message});
    }
  }
  return result;
}

// Synthetic counterpart only: authenticated decisions are made from locked server state.
function planAutomaticCopy(current,source,targetIds,options) {
  if (options.removeItemIds?.length) throw new Error('Automatic copy cannot remove target items');
  const allowed=new Set(distributionTargets(current,source,options.ownerId ?? null).map(row=>row.id));
  if (!Array.isArray(targetIds)||!targetIds.length||new Set(targetIds).size!==targetIds.length||targetIds.some(id=>!allowed.has(id))) throw new Error('Choose distinct eligible targets');
  const result={mode:'automatic-safe',token:distributionCopyToken(current,source,targetIds,'automatic-safe'),targets:[],excludedTargets:[],
    writes:Object.fromEntries(['items','scoreSubitems','scores','scoreSubitemCompletions'].map(name=>[name,{put:[]}])),requiresConfirmation:true,changedCount:0};
  const incoming=ordered(live(current.items).filter(row=>row.teachingId===source));
  let sequence=0;
  const id=options.id ?? (()=>'preview:auto:'+(++sequence));
  for (const target of targetIds) {
    const existing=live(current.items).filter(row=>row.teachingId===target),used=new Set(),impact=[];
    const beforeTotal=existing.reduce((sum,row)=>sum+Number(row.max),0);
    let afterTotal=beforeTotal;
    for (const item of incoming) {
      const origins=existing.filter(row=>row.distributionOriginId===item.id);
      const named=existing.filter(row=>normalized(row.name)===normalized(item.name));
      const matches=origins.length?origins:named,prior=matches[0];
      const retain=reason=>impact.push({name:item.name,retained:true,reason,created:false,affected:0,examples:[],subitems:[]});
      if (matches.length>1 || (prior && used.has(prior.id)) || (!origins.length && incoming.filter(row=>normalized(row.name)===normalized(item.name)).length!==1)) {
        matches.forEach(row=>used.add(row.id));retain('المطابقة مكررة؛ بقي البند وسجلاته كما هي.');continue;
      }
      if (prior) used.add(prior.id);
      const subs=live(current.scoreSubitems).filter(row=>row.itemId===prior?.id),subIds=new Set(subs.map(row=>row.id));
      const recorded=!!prior && (!!prior.auto || live(current.scores).some(row=>row.itemId===prior.id &&
        (row.value!=null || row.manualValue!=null || (row.derivedValue ?? 0)!==0)) ||
        live(current.scoreSubitemCompletions).some(row=>subIds.has(row.subitemId) && (row.checked || row.completionState!=null)));
      const subset={...current,items:current.items.filter(row=>row.teachingId!==source || row.id===item.id)};
      let plan=planScoreDistributionCopy(subset,source,[target],{...options,id,mode:'preserve-target'});
      if (plan.excludedTargets.length && !recorded) {
        const adapted=structuredClone(subset);
        if (prior) adapted.items.find(row=>row.id===prior.id).distributionOriginId=item.id;
        plan=planAcceptedDistribution(adapted,source,[target],{...options,id,removeItemIds:[]});
      }
      if (plan.excludedTargets.length) {retain(plan.excludedTargets[0].reason);continue;}
      for (const [name,writes] of Object.entries(plan.writes)) for (const row of writes.put) {
        if (!current[name].some(old=>old.id===row.id) && name==='scoreSubitems') row.createdAt=options.stamp ?? Date.now();
        result.writes[name].put.push(row);
      }
      result.changedCount+=plan.changedCount;
      const detail=plan.targets[0].impact.find(row=>row.name===item.name);
      impact.push(detail ? {...detail,unchanged:plan.changedCount===0} : {name:item.name,unchanged:true,created:false,affected:0,examples:[],subitems:[]});
      if (plan.changedCount) afterTotal+=Number(item.max)-Number(prior?.max ?? 0);
    }
    result.targets.push({teachingId:target,impact,beforeTotal,afterTotal,
      extras:existing.filter(row=>!used.has(row.id)).map(row=>({id:row.id,name:row.name}))});
  }
  return result;
}
