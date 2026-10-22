// AI: serializer security unit check; rendered popup evidence is in runtime JSON/PNGs.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const folder='tests/n36-1255-visible-timetable-get-20261021/',handlers={},nodes=new Map();let copied;
const node=()=>({classList:{add(){}},clientWidth:430,clientHeight:600,scrollWidth:430,scrollHeight:600,value:'',hidden:true,textContent:''});
const realm=vm.createContext({URL,URLSearchParams,location:{search:'',href:'http://127.0.0.1:49931/popup.html'},document:{documentElement:node(),body:node(),querySelector:()=>node(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}},getComputedStyle:()=>({width:'430px'}),innerWidth:430,innerHeight:600,devicePixelRatio:1,visualViewport:{scale:1},navigator:{clipboard:{writeText:async text=>{copied=text;}}},chrome:{runtime:{getManifest:()=>({version:'0.5.37'})}},addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn);},setTimeout,clearTimeout});
vm.runInContext(await fs.readFile('extensions/rakeez-teacher-import-helper/diagnostics-bootstrap.js','utf8'),realm);
const report=async()=>{await handlers.click[0]({target:{closest:()=>true}});return JSON.parse(copied);};
const cases=[];
for(const kind of ['metadata','classes','timetable'])for(const reason of ['route-shape','live-link-absent','live-link-unsafe','live-link-event','live-link-context','live-link-download','live-link-method','live-link-duplicate','response-base']){
 realm.fixtureKind=kind;realm.fixtureReason=reason;vm.runInContext('n36Diagnostics.publish({setupKind:fixtureKind,setupRejectReason:fixtureReason})',realm);
 const r=await report();assert.equal(r.collection.setupKind,kind);assert.equal(r.collection.setupRejectReason,reason);cases.push({kind,reason,status:'PASS'});
}
vm.runInContext(`n36Diagnostics.publish({setupKind:'https://synthetic.invalid/?SchoolId=private-sentinel',setupRejectReason:'<a onclick="private-sentinel">اسم طالب اصطناعي</a>',setupURL:'private-sentinel',html:'private-sentinel',student:'private-sentinel'})`,realm);
const rejected=await report();assert.equal(rejected.collection.setupKind,'unknown');assert.equal(rejected.collection.setupRejectReason,'unknown');assert.ok(!copied.includes('private-sentinel'));assert.ok(!copied.includes('اسم طالب اصطناعي'));assert.ok(!copied.includes('synthetic.invalid'));
const result={status:'PASS',kindReasonPairs:cases,untrustedValues:'clamped; unknown keys discarded; no URL/query/HTML/name sentinel in serialized output',boundary:'Unit serializer execution only; actual popup DOM/CSS/copy handler exercised by full runtime evidence'};
await fs.writeFile(folder+'diagnostics.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,pairs:cases.length,untrustedValues:result.untrustedValues}));
