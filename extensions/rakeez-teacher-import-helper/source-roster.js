// AI: transient source review only. Never widen the category/receiver transport cap.
import {validateCategory} from './categories.js';
export const SOURCE_ROSTER_LIMIT=1200;
const identity=v=>v.replace(/[\s\u0640\u064B-\u065F\u0670]/g,'').toLowerCase();
export function appendSourceRows(prior, incoming){
 if(prior.length+incoming.length>SOURCE_ROSTER_LIMIT)throw Error('SOURCE_ROSTER_LIMIT');
 const seen=new Set(prior.map(r=>identity(r.classroom)+'|'+identity(r.name)));
 const classrooms=new Map(prior.map(r=>[identity(r.classroom),r.classroom]));
 const next=[...prior];
 for(const row of incoming){
  const clean=validateCategory('students',[row])[0],classKey=identity(clean.classroom),key=classKey+'|'+identity(clean.name);
  if(classrooms.has(classKey)&&classrooms.get(classKey)!==clean.classroom)throw Error('AMBIGUOUS_CLASSROOM');
  if(seen.has(key))throw Error('DUPLICATE_STUDENT_IDENTITY');
  classrooms.set(classKey,clean.classroom);seen.add(key);next.push(clean);
 }
 return next;
}
export function reportsComplete(series){
 return series.size>0&&[...series.values()].every(s=>s.terminal&&Number.isInteger(s.total)&&s.total>0&&s.total<=24&&s.pages.size===s.total&&Array.from({length:s.total},(_,i)=>i+1).every(n=>s.pages.has(n)));
}
export function sourceClasses(rows){
 const groups=new Map();for(const r of rows){if(!groups.has(r.classroom))groups.set(r.classroom,[]);groups.get(r.classroom).push(r);}
 return [...groups].map(([classroom,items])=>({classroom,count:items.length,available:items.length<=300}));
}
export function selectedSourceClass(rows,classroom){
 const selected=rows.filter(r=>r.classroom===classroom);
 return validateCategory('students',selected);
}
