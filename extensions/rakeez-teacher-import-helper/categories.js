// Private, bounded, allowlisted local bundle. Existing names-only core stays unchanged.
import {reviewNames} from './core.js';
import {normalizeDateTimeDigits,validDateTimeValue} from './lib/rakeez-datetime-values.js';
export const CATEGORIES = Object.freeze({
  teacher: {label:'اسم المعلم', fields:{name:'اسم المعلم'}},
  school: {label:'اسم المدرسة', fields:{name:'اسم المدرسة'}},
  principal: {label:'اسم المدير', fields:{name:'اسم المدير'}},
  classes: {label:'الفصول', fields:{classroom:'الفصل',subject:'المادة'}},
  students: {label:'أسماء الطلاب وفصولهم', fields:{name:'اسم الطالب',classroom:'الفصل'}},
  timetable: {label:'الجدول الأسبوعي', fields:{weekday:'اليوم',period:'الحصة',time:'الوقت',classroom:'الفصل',subject:'المادة'}}
});
const fail=code=>{throw Error(code);};
const clean=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/g,' '):fail('INVALID_FIELD');
const key=value=>value.replace(/[\s\u0640\u064B-\u065F\u0670]/g,'').toLowerCase();
const text=value=>{const v=clean(value);if(v.length<2||v.length>80||!/[\p{L}]/u.test(v)||! /^[\p{L}\p{M}0-9 ()-]+$/u.test(v))fail('INVALID_TEXT');return v;};
const name=value=>reviewNames([value]).names[0];
const days=new Set(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']);
function time(value){
 const v=normalizeDateTimeDigits(clean(value));if(!/^\d{2}:\d{2}(?:-\d{2}:\d{2})?$/.test(v))fail('INVALID_TIME');
 const minutes=v.split('-').map(p=>{if(!validDateTimeValue(p,'time'))fail('INVALID_TIME');const [h,m]=p.split(':').map(Number);return h*60+m;});
 if(minutes.length===2&&minutes[1]<=minutes[0])fail('INVALID_TIME');return v;
}
export function validateCategory(category,rows){
 const spec=CATEGORIES[category];if(!spec||!Array.isArray(rows))fail('INVALID_CATEGORY');
 if(!rows.length)fail('EMPTY_CATEGORY');
 if(rows.length>300)fail('CATEGORY_ROW_LIMIT');
 if(['teacher','school','principal'].includes(category)&&rows.length!==1)fail('AMBIGUOUS_ROLE');
 const seen=new Set(),slots=new Set();
 return rows.map(row=>{
  if(!row||Object.keys(row).some(f=>!Object.hasOwn(spec.fields,f)))fail('UNKNOWN_FIELD');
  const out={};
  for(const field of Object.keys(spec.fields)){
   const value=row[field];
   if((category==='timetable'&&['period','time'].includes(field)||category==='classes'&&field==='subject')&&!value)continue;
   if(!value)fail('UNRESOLVED_MAPPING');
   if(field==='name')out[field]=category==='school'?text(value):name(value);
   else if(field==='weekday'){out[field]=clean(value);if(!days.has(out[field]))fail('UNRESOLVED_WEEKDAY');}
   else if(field==='period'){out[field]=clean(value);if(!/^(?:[1-9]|1[0-9]|20)$/.test(out[field]))fail('INVALID_PERIOD');}
   else if(field==='time')out[field]=time(value);
   else out[field]=text(value);
  }
  if(category==='timetable'){
   if(!out.period&&!out.time)fail('UNRESOLVED_PERIOD_OR_TIME');
   for(const f of ['period','time'])if(out[f]){const slot=out.weekday+'|'+f+'|'+out[f];if(slots.has(slot))fail('DUPLICATE_SLOT');slots.add(slot);}
  }
  const identity=Object.values(out).map(key).join('|');if(seen.has(identity))fail('DUPLICATE');seen.add(identity);return out;
 });
}
export function parseCategoryTable(category,input){
 if(typeof input!=='string'||input.length>100000)fail('LIMIT');
 const rows=input.replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(r=>r.split('\t'));
 const spec=CATEGORIES[category];if(!spec)fail('UNKNOWN_CATEGORY');
 if(rows.length>301||rows.some(r=>r.length>50))fail('LIMIT');
 if(['teacher','school','principal'].includes(category)){
  if(rows.length!==1||rows[0].length!==2||clean(rows[0][0])!==spec.fields.name)fail('UNRESOLVED_ROLE_LABEL');
  return validateCategory(category,[{name:rows[0][1]}]);
 }
 const headers=rows[0].map(clean),mapping={};
 for(const [field,label] of Object.entries(spec.fields)){
  const positions=headers.flatMap((h,i)=>h===label?[i]:[]);
  if(positions.length>1)fail('AMBIGUOUS_HEADER');
  if(!positions.length){if(category==='timetable'&&['period','time'].includes(field)||category==='classes'&&field==='subject')continue;fail('UNRESOLVED_MAPPING');}
  mapping[field]=positions[0];
 }
 if(rows.some(r=>r.length!==headers.length))fail('IRREGULAR_TABLE');
 return validateCategory(category,rows.slice(1).map(r=>Object.fromEntries(Object.entries(mapping).map(([f,i])=>[f,r[i]]))));
}
export function stageCategory(staged,category,rows,source){
 if(!['pasted-visible','selected-visible','teacher-readonly-run'].includes(source))fail('INVALID_PROVENANCE');
 const prior=staged.find(c=>c.category===category);
 const merged=['teacher','school','principal'].includes(category)?rows:[...(prior?.rows??[]),...rows];
 const next={category,provenance:[...new Set([...(prior?.provenance??[]),source])],rows:validateCategory(category,merged)};
 const result=[...staged.filter(c=>c.category!==category),next];
 if(result.reduce((n,c)=>n+c.rows.length,0)>600)fail('BUNDLE_LIMIT');return result;
}
export function bundle(staged){
 if(!staged.length||staged.length>6)fail('EMPTY_OR_LIMIT');
 const seen=new Set();
 const categories=staged.map(c=>{
  if(!c||Object.keys(c).some(f=>!['category','provenance','rows'].includes(f))||seen.has(c.category))fail('INVALID_CATEGORY');seen.add(c.category);
  if(!Array.isArray(c.provenance)||!c.provenance.length||c.provenance.some(s=>!['pasted-visible','selected-visible','teacher-readonly-run'].includes(s)))fail('INVALID_PROVENANCE');
  return {category:c.category,provenance:[...new Set(c.provenance)],rows:validateCategory(c.category,c.rows)};
 });
 if(categories.reduce((n,c)=>n+c.rows.length,0)>600)fail('BUNDLE_LIMIT');
 const result={schema:'rakeez-private-teacher-setup',version:1,categories};
 if(JSON.stringify(result).length>100000)fail('BUNDLE_LIMIT');return result;
}
