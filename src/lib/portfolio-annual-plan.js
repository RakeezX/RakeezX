import { normalizePortfolioContext } from './portfolio-local-state.js';
/**
 * Preview-only, deterministic year-wide printable portfolio manifest.
 * No edits to sourced grades, attendance, or teacher records.
 */
const PHOTO_FIRST = Object.freeze({one:2,two:4,three:6});
const PHOTO_MORE = Object.freeze({one:4,two:8,three:9});
export function portfolioPhotoPageCount({count=0,layout='two',chart=false,showPhotos=true}={}) {
  if (!showPhotos || !Number.isFinite(count) || count<=0) return 0;
  const first=chart?0:(PHOTO_FIRST[layout] ?? 4);
  const remaining=Math.max(0,Math.floor(count)-first);
  return Math.ceil(remaining/(PHOTO_MORE[layout]??8));
}
export function buildAnnualPortfolioPlan({
  criteria=[],sources=[],templates=[],custom=[],
  hiddenCriteria=new Set(),hiddenWitnesses=new Set(),
  included=new Set(),excluded=new Set(),
  titles=new Map(),descriptions=new Map(),contexts=new Map(),photos=new Map(),
  layouts=new Map(),sections=new Map(),yearId=null,
}={}) {
  const visibleCriteria=criteria.filter(c=>!hiddenCriteria.has(c.number));
  const frontPageCount=1+2*Math.max(1,Math.ceil(visibleCriteria.length/11));
  const entries=[];
  let nextPage=frontPageCount+1;
  for (const criterion of visibleCriteria) {
    const matches=[...sources,...custom,...templates].filter(x=>x.criterion===criterion.number);
    for(const candidate of matches) {
      if(hiddenWitnesses.has(candidate.id)||excluded.has(candidate.id))continue;
      const photoList=photos.get(candidate.id)??[];
      const description=descriptions.get(candidate.id)??candidate.description??'';
      const title=titles.get(candidate.id)??candidate.title??'';
      const professionalContext=normalizePortfolioContext(contexts.get(candidate.id));
      const contextPages=Object.keys(professionalContext).length?1:0;
      const readyPersonal=candidate.sourceKind==='custom' &&
        (!!String(description).trim()||photoList.length>0||contextPages>0);
      if(candidate.sourceKind==='custom'&&!readyPersonal)continue;
      const active=included.has(candidate.id) ||
        (candidate.sourceKind==='automatic') || readyPersonal;
      if(!active)continue;
      const layout=layouts.get(candidate.id)??'two';
      const options=sections.get(candidate.id)??{};
      const chart=candidate.id==='rakeez:attendance:'+yearId &&
        candidate.metrics?.length>0 && options.chart!==false;
      const continuations=portfolioPhotoPageCount({
        count:photoList.length,layout,chart,showPhotos:options.photos!==false,
      });
      entries.push(Object.freeze({
        criterion,proposal:candidate,title,description,professionalContext,contextPages,
        page:nextPage,continuations,layout,photos:photoList,
        includedSections:{
          metrics:options.metrics!==false,table:options.table!==false,
          chart:options.chart!==false,illustration:options.illustration!==false,
          photos:options.photos!==false,
        },
      }));
      nextPage+=1+contextPages+continuations;
    }
  }
  const toc=visibleCriteria.map(c=>{
    const first=entries.find(e=>e.criterion.number===c.number);
    return Object.freeze({...c,page:first?String(first.page):'—'});
  });
  return Object.freeze({
    entries:Object.freeze(entries),
    toc:Object.freeze(toc),
    frontPageCount,
    totalPages:nextPage-1,
    witnessCount:entries.length,
    criteriaCount:visibleCriteria.length,
    includedCriteriaCount:toc.filter(c=>c.page!=='—').length,
  });
}
