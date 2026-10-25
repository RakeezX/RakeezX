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
