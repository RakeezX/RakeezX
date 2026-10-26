import test from 'node:test';
import assert from 'node:assert/strict';
import {portfolioLocalScope,isPortfolioConflict} from '../src/lib/portfolio-local-draft.js';
import {snapshotPortfolioDraft,restorePortfolioDraft} from '../src/lib/portfolio-local-state.js';

const year={id:'year-1448'};
const a={type:'account',databaseName:'rakeezx-user-'+'a'.repeat(32),authUserId:'teacher-a'};
const b={type:'account',databaseName:'rakeezx-user-'+'b'.repeat(32),authUserId:'teacher-b'};
test('local portfolio scopes never mix teacher workspaces or academic years',()=>{
  const one=portfolioLocalScope(a,year),two=portfolioLocalScope(b,year);
  const another=portfolioLocalScope(a,{id:'year-1449'});
  assert.notEqual(one.databaseName,two.databaseName);
  assert.equal(one.ownerId,'teacher-a');
  assert.notEqual(one.key,another.key);
  assert.equal(portfolioLocalScope({type:'demo',databaseName:'rakeezx-demo'},year).ownerId,'demo');
  assert.equal(portfolioLocalScope({type:'account',databaseName:'rakeezx-demo',authUserId:'x'},year),null);
  assert.equal(portfolioLocalScope({type:'account',databaseName:a.databaseName},year),null);
  assert.equal(portfolioLocalScope({type:'account',databaseName:'unknown',authUserId:'x'},year),null);
  assert.equal(portfolioLocalScope(a,{}),null);
});
test('image Blobs are separated from metadata and restored with their original order',()=>{
  const png=new Blob([Uint8Array.from([137,80,78,71])],{type:'image/png'});
  const model={
    criterionNames:new Map([['04','أساليبي']]),
    hiddenCriteria:new Set(['03']),
    extraCriteria:[{number:'12',title:'مبادراتي',custom:true}],
    customWitnesses:[{id:'custom:one',criterion:'04',title:'تجربة',sourceKind:'custom'}],
    hiddenWitnesses:new Set(['template:03:contact']),
    sectionPreferences:new Map([['custom:one',{chart:false}]]),
    photoLayouts:new Map([['custom:one','one']]),
    photoGroups:new Map([['custom:one',[
      {id:'photo-1',name:'example.png',bytes:4,blob:png,stored:false,url:'blob:temporary'},
    ]]]),
    selectedByCriterion:new Map([['04','custom:one']]),
    descriptions:new Map([['custom:one','وصف تجربة']]),
    titles:new Map([['custom:one','تجربة من عملي']]),
    includedWitnesses:new Set(['custom:one']),
    excludedWitnesses:new Set(['template:04:old']),
    editingCriterion:'04',nextExtraCriterionNumber:13,
  };
  const {payload,images}=snapshotPortfolioDraft(model);
  assert.equal(images.length,1);
  assert.ok(images[0].blob instanceof Blob);
  assert.equal(JSON.stringify(payload).includes('blob:temporary'),false);
  assert.equal(JSON.stringify(payload).includes('image/png'),false);
  const restored=restorePortfolioDraft(payload,new Map([['photo-1',{blob:png}]]),
    {makeUrl:blob=>'local:'+blob.size});
  assert.equal(restored.photoGroups.get('custom:one')[0].url,'local:4');
  assert.equal(restored.photoGroups.get('custom:one')[0].stored,true);
  assert.equal(restored.titles.get('custom:one'),'تجربة من عملي');
  assert.deepEqual([...restored.hiddenCriteria],['03']);
  assert.deepEqual([...restored.includedWitnesses],['custom:one']);
  assert.equal(restored.nextExtraCriterionNumber,13);
});
test('missing photo data fails rather than silently claiming a complete draft',()=>{
 const payload={photos:[['custom:one',[{id:'missing',name:'e.png',bytes:5}]]]};
 assert.throws(()=>restorePortfolioDraft(payload,new Map(),{makeUrl:()=>''}),/Missing/);
 assert.equal(isPortfolioConflict({code:'PORTFOLIO_LOCAL_CONFLICT'}),true);
 assert.equal(isPortfolioConflict({code:'QUOTA_EXCEEDED'}),false);
});

test('removed personal evidence cannot leave retained photos or titles in a saved draft',()=>{
 const png=new Blob([Uint8Array.from([1,2,3])],{type:'image/png'});
 const model={
   criterionNames:new Map(),hiddenCriteria:new Set(),extraCriteria:[],
   customWitnesses:[],hiddenWitnesses:new Set(),
   sectionPreferences:new Map([['custom:deleted',{chart:false}]]),
   photoLayouts:new Map([['custom:deleted','one']]),
   photoGroups:new Map([['custom:deleted',[{
     id:'deleted-photo',name:'private.png',blob:png,stored:false,
   }]]]),
   selectedByCriterion:new Map([['04','custom:deleted']]),
   descriptions:new Map([['custom:deleted','private note']]),
   titles:new Map([['custom:deleted','private evidence']]),
   includedWitnesses:new Set(['custom:deleted']),
   excludedWitnesses:new Set(),editingCriterion:'04',nextExtraCriterionNumber:12,
 };
 const {payload,images}=snapshotPortfolioDraft(model);
 assert.deepEqual(payload.photos,[]);
 assert.deepEqual(payload.titles,[]);
 assert.deepEqual(payload.descriptions,[]);
 assert.deepEqual(payload.includedWitnesses,[]);
 assert.deepEqual(payload.selectedByCriterion,[]);
 assert.deepEqual(images,[]);
});
