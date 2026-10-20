import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
let source=await fs.readFile('src/lib/student-portal-runtime.js','utf8');
for(const [a,b]of [["'./sync-ownership.js'",data('export const runtimeSyncOwnershipGuard={};')],["'./student-portal-class-client.js'",data('export const createClassPortalClient=()=>{};')],["'../views/student-portal-class.js'",data('export const mountClassPortal=()=>{};')]])source=source.replace(a,JSON.stringify(b));
const {classBinding}=await import(data(source));
const jwt=(sid,exp)=>'synthetic.'+Buffer.from(JSON.stringify({session_id:sid,exp})).toString('base64url')+'.synthetic';
const w={id:'workspace',databaseName:'owned',type:'account',authUserId:'synthetic-owner',leaseGeneration:1},teaching={id:'natural-teaching',sectionId:'section',termId:'term',revision:1},term={id:'term',yearId:'year',revision:1};
const cloud={user:{id:'synthetic-owner'},session:{access_token:jwt('session',Date.now()/1000+300)},authStatus:()=>({state:'authenticated'})};
let denied=false;const guard={bindNewCommand:()=>({}),cloudAccess:()=>({allowed:!denied,workspaceOwnerId:w.authUserId})};
const store={getActiveWorkspace:()=>w,getTeaching:()=>teaching,activeTerm:()=>term,isTeachingArchived:()=>false,assertClassOperationsAccess(){},assertLeaseWritable(){},state:{years:[{id:'year',revision:1}],sections:[{id:'section',revision:1}],enrollments:[{id:'e1',sectionId:'section',studentId:'s1'},{id:'e2',sectionId:'section',studentId:'s2'}],students:[{id:'s1',revision:1},{revision:1,id:'s2'}],items:[],scoreSubitems:[]}};
const key=()=>classBinding({cloud,store,teachingId:teaching.id,guard}).key;
const k=key();cloud.session.access_token=jwt('session',Date.now()/1000+600);store.state.students.reverse();store.state.enrollments.reverse();assert.equal(key(),k);
const changes=[
 ()=>{w.leaseGeneration++;},
 ()=>{term.yearId='other-year';term.revision++;},
 ()=>{teaching.revision++;},
 ()=>{store.state.students[0].revision++;},
 ()=>{cloud.session.access_token=jwt('other-session',Date.now()/1000+600);}
];
for(const change of changes){const before=key();change();assert.notEqual(key(),before);}
cloud.session.access_token=jwt('other-session',Date.now()/1000-1);assert.throws(key,e=>e.portalState==='session');
cloud.session.access_token=jwt('other-session',Date.now()/1000+600);denied=true;assert.throws(key,e=>e.portalState==='owner');denied=false;
w.authUserId='foreign-owner';assert.throws(key,e=>e.portalState==='owner');
const report={status:'PASS',scope:'Changed classBinding identity only; actual guarded DOM entry covered separately',checks:['same-session renewal, canonical row/property order stable','lease/year/source revision/other Auth session changes invalidate','expired bearer and owner/authorization denial failclosed'],networkCalls:0};
await fs.writeFile('tests/n88-20261020/binding.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
