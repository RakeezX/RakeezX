import './route-diagnostics.js';
// No host wildcard: Ministry-published route + actual user-invoked start origin.
// Public Ministry report: https://www.moe.gov.sa/ar/education/studies/Documents/NDLP.pdf
export const RUN_LIMITS=Object.freeze({pages:24,sourceBytes:8*1024*1024,milliseconds:90000,reviewMilliseconds:300000});
export function startOrigin(value){
 const u=new URL(value);
 const official=u.protocol==='https:'&&!u.port&&u.hostname==='schools.madrasati.sa';
 const local=['http:','https:'].includes(u.protocol)&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&!!u.port;
 if(u.username||u.password||(!official&&!local))throw Error('UNVERIFIED_START_ORIGIN');
 return u.origin;
}
// Exact observed platform additions share the injected reader's route contract.
export function safeRoute(origin,path,context=null){return globalThis.rakeezRoutePolicy(origin,path,context);}

export function mergePage(staged,category,rows){
 const prior=staged.find(c=>c.category===category);
 if(['teacher','school','principal'].includes(category)&&prior&&JSON.stringify(prior.rows)!==JSON.stringify(rows))throw Error('AMBIGUOUS_ROLE_VALUE');
 const unique=[...(prior?.rows??[])];
 for(const row of rows)if(!unique.some(r=>JSON.stringify(r)===JSON.stringify(row)))unique.push(row);
 return [...staged.filter(c=>c.category!==category),{category,provenance:['teacher-readonly-run'],rows:unique}];
}
