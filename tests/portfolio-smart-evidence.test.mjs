import test from 'node:test';
import assert from 'node:assert/strict';
import {F09_EVIDENCE_GUIDE,buildPortfolioEvidenceSuggestions,guideForCriterion} from '../src/lib/portfolio-smart-evidence.js';

test('the guide covers exactly eleven performance criteria with distinct manual follow-ups',()=>{
  assert.equal(F09_EVIDENCE_GUIDE.length,11);
  assert.equal(new Set(F09_EVIDENCE_GUIDE.map(x=>x.criterion)).size,11);
  assert.deepEqual(F09_EVIDENCE_GUIDE.map(x=>x.criterion),Array.from({length:11},(_,i)=>String(i+1).padStart(2,'0')));
  for(const x of F09_EVIDENCE_GUIDE){
    assert.ok(x.content && x.minimum && x.madrasati && x.noor && x.rakeez);
    assert.ok(x.evidence);
  }
  assert.match(guideForCriterion('05').minimum,/القياسين/);
  assert.equal(guideForCriterion('unknown'),null);
});
const input=()=>({
  yearId:'year-1',teachingIds:['a','b'],
  attendance:{recordedSessions:2,fullSessions:1,rows:[
    {id:'session-1',section:'رابع 1',subject:'المهارات الرقمية',date:'2026-10-10',period:1},
    {id:'session-2',section:'خامس 2',subject:'الرياضيات',date:'2026-10-11',period:2},
  ]},
  slots:[
    {id:'slot1',teachingId:'a',period:1,weekday:0},
    {id:'slot2',teachingId:'b',period:3,weekday:2},
    {id:'slot-other',teachingId:'other',period:4,weekday:3},
  ],
  classRules:[{id:'rule1',teachingId:'b',text:'التعاون واحترام الآخرين'}],
  sessions:[{id:'session3',teachingId:'a',date:'2026-10-09',status:'held',lessonId:'lesson1'}],
  items:[
    {id:'item1',teachingId:'a',name:'اختبار الفترة الأولى',max:20,auto:null,scoreMode:'direct'},
    {id:'item2',teachingId:'b',name:'المشروع',max:10,auto:null,scoreMode:'direct'},
    {id:'auto',teachingId:'a',name:'المشاركة',max:10,auto:'participation',scoreMode:'direct'},
    {id:'outside',teachingId:'other',name:'درجات خارج السنة',max:10,auto:null},
  ],
  scores:[
    {id:'score1',itemId:'item1',studentId:'private-id1',value:15},
    {id:'score2',itemId:'item1',studentId:'private-id2',value:0},
    {id:'score3',itemId:'item2',studentId:'private-id1',value:8},
    {id:'score4',itemId:'auto',studentId:'private-id1',value:10},
    {id:'outside',itemId:'outside',studentId:'private-id2',value:10},
    {id:'score5',itemId:'item1',studentId:'private-id3',value:null},
  ],
  assignments:[{id:'task1',teachingId:'a',title:'مشروع الوحدة الأولى',assignedDate:'2026-10-10'}],
  submissions:[{id:'submission1',studentId:'private-id2',assignmentId:'task1',status:'submitted'}],
  asOf:'2026-10-25',
});
test('creates verified suggestions for multiple classes; excludes auto marks and future/out-of-year rows',()=>{
  const data=input(),prior=JSON.stringify(data),result=buildPortfolioEvidenceSuggestions(data);
  assert.deepEqual(result.map(x=>x.criterion),['01','06','08','09','10','11','11']);
  assert.equal(result.some(x=>x.criterion==='03'),false);
  assert.equal(result.find(x=>x.criterion==='11'&&x.id.includes('graded-items')).metrics[1][1],3);
  assert.equal(result.find(x=>x.criterion==='10').metrics[2][1],'52٪');
  assert.equal(result.find(x=>x.criterion==='01').requiresReview,true);
  assert.equal(result.find(x=>x.criterion==='09').sourceKind,'automatic');
  assert.equal(JSON.stringify(data),prior);
  assert.doesNotMatch(JSON.stringify(result),/private-id1|private-id2|private-id3/);
  assert.equal(result.some(x=>x.references?.type==='scores'),false);
});
test('empty or only unperformed activities never become auto evidence',()=>{
  assert.deepEqual(buildPortfolioEvidenceSuggestions({}),[]);
  assert.deepEqual(buildPortfolioEvidenceSuggestions({yearId:'year',teachingIds:['a'],items:[
    {id:'item1',teachingId:'a',name:'واجب',max:10}],scores:[],assignments:[]}),[]);
});
test('zero score is a real recorded grade; nonnumeric and out-of-range values never count',()=>{
  const a=input();a.scores=[
    {id:'z',itemId:'item1',studentId:'x',value:0},
    {id:'blank',itemId:'item1',studentId:'z',value:''},
    {id:'bad',itemId:'item1',studentId:'q',value:25},
  ];a.attendance=null;a.slots=[];a.sessions=[];a.classRules=[];a.assignments=[];a.submissions=[];
  const result=buildPortfolioEvidenceSuggestions(a);
  assert.equal(result.length,1);
  assert.equal(result[0].criterion,'11');
  assert.equal(result[0].metrics[1][1],1);
});
test('no sensitive personal or account data is accepted as a source claim for Madrasati or Noor',()=>{
  const suggestions=buildPortfolioEvidenceSuggestions({...input(),teachingIds:['a']});
  assert.equal(suggestions.every(x=>x.source==='ركيز المعلم'),true);
  assert.equal(suggestions.some(x=>x.source==='مدرستي'||x.source==='نور'),false);
});

// AI N126: actual V2 shapes from models.js, startClassGoal/addLog and store tests.
const recordedInput=()=>{
  const ownerId='owner-a',row=o=>({ownerId,...o});
  const stamp=Date.parse('2026-10-10T08:00:00Z');
  return {
    yearId:'year',teachingIds:['teaching'],asOf:'2026-10-27',
    recordedScope:{
      workspace:{type:'account',ownershipState:'claimed',authUserId:ownerId,databaseName:'synthetic-owner-a'},
      years:[row({id:'year'})],terms:[row({id:'term',yearId:'year',startDate:'2026-08-01',endDate:'2026-12-31'})],
      sections:[row({id:'section',yearId:'year',status:'active'})],subjects:[row({id:'subject'})],
      teachings:[row({id:'teaching',termId:'term',sectionId:'section',subjectId:'subject'})],
      students:[row({id:'private-student',name:'اسم عائلة خاص'})],
      enrollments:[row({id:'enrollment',sectionId:'section',studentId:'private-student',startDate:'2026-08-01',endDate:null,status:'active'})],
    },
    sessions:[row({id:'held',teachingId:'teaching',date:'2026-10-10',status:'held'})],
    groupArrangements:[row({id:'group-arrangement:teaching',teachingId:'teaching',groups:[['private-student']],updatedAt:stamp})],
    classGoals:[row({id:'class-goal:teaching',teachingId:'teaching',sessionId:'held',date:'2026-10-10',state:'completed',
      runId:'run',startedAt:stamp,completedAt:stamp+60000,text:'اسم عائلة خاص'})],
    logs:[row({id:'private-student:log',teachingId:'teaching',sessionId:'held',studentId:'private-student',date:'2026-10-10',kind:'participation',delta:1,note:'اسم عائلة خاص',tag:'private-student'})],
  };
};
const newSuggestions=d=>buildPortfolioEvidenceSuggestions(d).filter(x=>/group-arrangements|completed-goals|participation-logs/.test(x.id));
test('recorded work produces review setups/completed goal records and automatic aggregate logs without mutation or sensitive projection',()=>{
  const d=recordedInput(),before=structuredClone(d),result=newSuggestions(d);
  assert.equal(result.length,3);
  for(const key of ['group-arrangements','completed-goals'])assert.equal(result.find(x=>x.id.includes(key)).sourceKind,'review');
  assert.equal(result.find(x=>x.id.includes('participation-logs')).sourceKind,'automatic');
  assert.match(result.find(x=>x.id.includes('completed-goals')).description,/لا يعني/);
  assert.match(result.find(x=>x.id.includes('group-arrangements')).description,/لا تثبت/);
  assert.doesNotMatch(JSON.stringify(result),/private-student|اسم عائلة|owner-a|run|held/);
  assert.equal(result.find(x=>x.id.includes('participation-logs')).references.type,'logs');
  assert.deepEqual(d,before);
  for(const key of ['groupArrangements','classGoals','logs'])d[key].push(structuredClone(d[key][0]));
  assert.deepEqual(newSuggestions(d),result,'identical IDs count once');
});

test('each source and all ancestry fail closed on foreign owner, tombstone or conflicting duplicate',()=>{
  for(const table of ['groupArrangements','classGoals','logs']){
    for(const patch of [{deleted:true},{ownerId:'foreign'},{ownerId:null},{teachingId:'foreign'}]){
      const d=recordedInput();Object.assign(d[table][0],patch);
      assert.equal(newSuggestions(d).length,2,table+JSON.stringify(patch));
    }
    const d=recordedInput();d[table].push({...d[table][0],deleted:true});
    assert.equal(newSuggestions(d).length,2,table+' tombstone duplicate');
  }
  for(const table of ['years','terms','sections','subjects','teachings']){
    for(const patch of [{deleted:true},{ownerId:'foreign'},{ownerId:null}]){
      const d=recordedInput();Object.assign(d.recordedScope[table][0],patch);
      assert.equal(newSuggestions(d).length,0,table+JSON.stringify(patch));
    }
  }
  for(const mutate of [d=>d.recordedScope.terms[0].yearId='other',d=>d.recordedScope.sections[0].yearId='other',
    d=>d.recordedScope=null,d=>d.recordedScope.workspace.ownershipState='unclaimed',d=>d.asOf='9999-12-31']){
    const d=recordedInput();mutate(d);assert.deepEqual(newSuggestions(d),[]);
  }
});

test('dated goal/log sources exclude cancelled, scheduled, deleted, undated, future and mismatched session ancestry',()=>{
  for(const patch of [{status:'cancelled'},{status:'cancelled_holiday'},{status:'scheduled'},{deleted:true},
    {date:null},{date:'2026-02-30'},{date:'2026-10-28'},{teachingId:'other'},{ownerId:'foreign'}]){
    const d=recordedInput();Object.assign(d.sessions[0],patch);
    assert.deepEqual(newSuggestions(d).map(x=>x.references.type),['groupArrangements']);
  }
  for(const table of ['classGoals','logs'])for(const patch of [{date:null},{date:'2027-10-10'},
    {date:'2026-09-10'},{sessionId:null},{sessionId:'unknown'}]){
    const d=recordedInput();Object.assign(d[table][0],patch);assert.equal(newSuggestions(d).length,2);
  }
  for(const state of ['active','cancelled']){
    const d=recordedInput();d.classGoals[0].state=state;assert.equal(newSuggestions(d).length,2);
  }
  for(const patch of [{completedAt:null},{completedAt:Date.parse('2026-10-28')},{startedAt:-1},{runId:null}]){
    const d=recordedInput();Object.assign(d.classGoals[0],patch);assert.equal(newSuggestions(d).length,2);
  }
  for(const patch of [{delta:NaN},{delta:0},{delta:'1'},{kind:'behavior'},{studentId:'unknown'}]){
    const d=recordedInput();Object.assign(d.logs[0],patch);assert.equal(newSuggestions(d).length,2);
  }
});

test('term and archived boundaries, membership, malformed arrangements and uncertain source shapes deny evidence',()=>{
  const d=recordedInput();Object.assign(d.recordedScope.sections[0],{status:'archived',archiveDate:'2026-10-10'});
  assert.equal(newSuggestions(d).length,2,'dated historical logs/goals survive at archive date; setup omitted');
  d.recordedScope.sections[0].archiveDate='2026-10-09';assert.deepEqual(newSuggestions(d),[]);
  for(const startDate of [null,'2026-11-01']){
    const f=recordedInput();f.recordedScope.terms[0].startDate=startDate;assert.deepEqual(newSuggestions(f),[]);
  }
  const f=recordedInput();f.recordedScope.terms[0].endDate='2026-10-09';assert.equal(newSuggestions(f).length,1);
  for(const patch of [{deleted:true},{ownerId:'foreign'},{startDate:'2026-10-28'},{endDate:'2026-10-09'}]){
    const f=recordedInput();Object.assign(f.recordedScope.enrollments[0],patch);assert.equal(newSuggestions(f).length,1);
  }
  for(const groups of [[],[[]],[['unknown']],[['private-student'],['private-student']],['private-student']]){
    const f=recordedInput();f.groupArrangements[0].groups=groups;assert.equal(newSuggestions(f).length,2);
  }
  const g=recordedInput();g.groupArrangements[0].updatedAt=Date.parse('2026-10-28');assert.equal(newSuggestions(g).length,2);
  const h=recordedInput();h.recordedScope.workspace={type:'legacy'};assert.deepEqual(newSuggestions(h),[]);
});
