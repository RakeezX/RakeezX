import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnualPortfolioPlan, portfolioPhotoPageCount } from '../src/lib/portfolio-annual-plan.js';

const criteria=Array.from({length:11},(_,i)=>({number:String(i+1).padStart(2,'0'),title:'معيار '+(i+1)}));
const automatic=(id,criterion)=>({id,criterion,title:id,description:'سجلات مثبتة',sourceKind:'automatic',metrics:[['عدد',3]]});
const review=(id,criterion)=>({id,criterion,title:id,description:'يحتاج إضافة',sourceKind:'review'});
const template=(id,criterion)=>({id,criterion,title:id,description:'نموذج توضيحي',sourceKind:'template'});
const personal=(id,criterion)=>({id,criterion,title:id,description:'',sourceKind:'custom'});

test('year-wide output follows all criteria, multiple selected witnesses and actual page numbering',()=>{
  const args={criteria,yearId:'2026',sources:[automatic('attendance','09'),automatic('analysis','10'),review('plan','06')],
    templates:[template('strategy','04'),template('another','04')],custom:[personal('mine','04')],
    included:new Set(['strategy','another','plan','mine']),photos:new Map([['mine',[{id:'one'},{id:'two'},{id:'three'}]]]),
    descriptions:new Map([['mine','مبادرة طبقها المعلم']])};
  const m=buildAnnualPortfolioPlan(args);
  assert.deepEqual(m.entries.map(e=>e.proposal.id),['mine','strategy','another','plan','attendance','analysis']);
  assert.equal(m.entries[0].page,4);
  assert.equal(m.entries[1].page,5);
  assert.equal(m.entries.at(-1).page,9);
  assert.equal(m.totalPages,9);
  assert.equal(m.toc[3].page,'4');
  assert.equal(m.toc[8].page,'8');
  assert.equal(m.toc[0].page,'—');
  assert.equal(m.witnessCount,6);
});

test('photos of attended sessions continue onto new pages without displacing charts',()=>{
  const m=buildAnnualPortfolioPlan({criteria,yearId:'y',sources:[automatic('rakeez:attendance:y','09')],
    photos:new Map([['rakeez:attendance:y',Array.from({length:6},(_,i)=>({id:String(i)}))]])});
  assert.equal(m.entries.length,1);
  assert.equal(m.entries[0].page,4);
  assert.equal(m.entries[0].continuations,1);
  assert.equal(m.totalPages,5);
  assert.equal(portfolioPhotoPageCount({count:6,layout:'one',chart:true}),2);
  assert.equal(portfolioPhotoPageCount({count:6,layout:'three',chart:false}),0);
});

test('templates require inclusion, blank personal drafts are excluded, hide excludes without destroying source',()=>{
  const opts={criteria,yearId:'y',sources:[automatic('rakeez:attendance:y','09')],
    templates:[template('t','04')],custom:[personal('blank','04')],
    included:new Set(['blank']),descriptions:new Map()};
  assert.deepEqual(buildAnnualPortfolioPlan(opts).entries.map(x=>x.proposal.id),['rakeez:attendance:y']);
  opts.included.add('t');
  opts.descriptions.set('blank','أضفت إنجازًا موثقًا');
  assert.deepEqual(buildAnnualPortfolioPlan(opts).entries.map(x=>x.proposal.id),['blank','t','rakeez:attendance:y']);
  opts.hiddenCriteria=new Set(['04']);
  assert.deepEqual(buildAnnualPortfolioPlan(opts).entries.map(x=>x.proposal.id),['rakeez:attendance:y']);
  opts.hiddenCriteria=new Set();
  opts.excluded=new Set(['rakeez:attendance:y']);
  assert.deepEqual(buildAnnualPortfolioPlan(opts).entries.map(x=>x.proposal.id),['blank','t']);
});

test('more than eleven sections reserve extra contents and overview pages',()=>{
  const many=Array.from({length:24},(_,i)=>({number:String(i+1).padStart(2,'0'),title:'معيار '+(i+1)}));
  const m=buildAnnualPortfolioPlan({criteria:many,sources:[automatic('late','24')]});
  assert.equal(m.frontPageCount,7);
  assert.equal(m.entries[0].page,8);
  assert.equal(m.totalPages,8);
  assert.equal(m.criteriaCount,24);
});
