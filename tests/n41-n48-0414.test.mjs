import test from 'node:test';
import assert from 'node:assert/strict';
import { displayIdentity, effectiveTheme, firstName } from '../src/lib/display-identity.js';
import { homeGreeting } from '../src/views/home.js';
import { renderSyncOperationalSection, syncOperationalPresentation } from '../src/lib/sync-operational-ui.js';
const cases = [
  ['عبدالله المعبدي','عبدالله المعبدي','ع ا'],
  ['عبدالله بن أحمد المعبدي','عبدالله المعبدي','ع ا'],
  ['  سارة  بنت أحمد  الحازمي  ','سارة الحازمي','س ا'],
  ['عبدالله','عبدالله','ع'],
  ['😀 اسم 🧑','😀 🧑','😀 🧑'],
  ['', 'المعلم', 'م'],
  ['   ', 'المعلم', 'م'],
];
for (const [name, display, initials] of cases) test(`display and literal Unicode initials: ${JSON.stringify(name)}`,()=>{
 const profile={teacherName:name}; assert.deepEqual(displayIdentity(profile.teacherName),{display,initials}); assert.equal(profile.teacherName,name);
});
test('empty name uses supplied teacher-form fallback',()=>assert.deepEqual(displayIdentity('', 'المعلمة'),{display:'المعلمة',initials:'م'}));
for(const [value,expected] of [['عبدالله المعبدي','عبدالله'],['  عبدالله  بن أحمد المعبدي  ','عبدالله'],['سارة','سارة'],['',''],['   ','']]){
 test(`presentation-only first name: ${JSON.stringify(value)}`,()=>assert.equal(firstName(value),expected));
}
for(const [pref,system,expected] of [['light',true,'light'],['dark',false,'dark'],['auto',false,'light'],['auto',true,'dark']])test(`effective theme ${pref}/${system}`,()=>assert.equal(effectiveTheme(pref,system),expected));
test('greeting preserves noon boundary, gender and empty-name fallback',()=>{
 for(const [hour,prefix] of [[11,'صباح الخير'],[12,'أهلاً']]){
  const now=new Date(2026,8,29,hour);
  assert.equal(homeGreeting({teacherName:'سارة بنت أحمد الحازمي',teacherForm:'feminine'},now),`${prefix}، أستاذة سارة الحازمي`);
  assert.equal(homeGreeting({teacherName:'سارة بنت أحمد الحازمي',teacherForm:'feminine'},now,{compact:true}),`${prefix}، أستاذة سارة`);
 }
 assert.equal(homeGreeting({teacherName:''},new Date(2026,8,29,9)),'صباح الخير');
 assert.equal(homeGreeting({teacherName:''},new Date(2026,8,29,9),{compact:true}),'صباح الخير، أستاذ');
 assert.equal(homeGreeting({teacherName:'  عبدالله  بن أحمد المعبدي  ',teacherForm:'masculine'},new Date(2026,8,29,11,59),{compact:true}),'صباح الخير، أستاذ عبدالله');
 assert.equal(homeGreeting({teacherName:'عبدالله المعبدي',teacherForm:'masculine'},new Date(2026,8,29,12),{compact:true}),'أهلاً، أستاذ عبدالله');
});
for(const state of ['synced','pending','syncing','blocked','rejected','error','offline','auth_required','idle'])test(`compact Sync retains operational actions and detail content: ${state}`,()=>{
 const summary={state,lastSuccessfulSyncAt:1000,queuedCount:1,actionableSyncIssue:true,localWorkSaved:true,failedCount:1,historicalConflictCount:2};
 const regular=String(renderSyncOperationalSection(summary)),compact=String(renderSyncOperationalSection(summary,{compact:true}));
 assert.equal(compact.replace('center-sync-heading','').replace('حالة المزامنة:','حالة المزامنة'),regular);
 assert.equal(compact.includes('data-act="mini-hub-sync-now"'),syncOperationalPresentation(summary).canSync||state==='syncing');
 assert.equal(compact.includes('تحتاج مساعدة؟'),['blocked','rejected','error'].includes(state));
});
