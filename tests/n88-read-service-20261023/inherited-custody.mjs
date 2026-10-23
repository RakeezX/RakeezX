/** AI: pure descriptor tests only; no filesystem or ACL probes. */
import assert from 'node:assert/strict';
import {qualifyDescriptor,qualifyStable} from '../../drafts/n88-student-portal/activation/read-service-20261023/inherited-custody.mjs';
const descriptor=child=>({ownerSelf:true,protected:!child,reparse:false,aces:[{principal:'SELF',rights:2032127,flags:3,propagation:0,access:0,inherited:child}]});
for(const child of [false,true]){
 assert.equal(qualifyDescriptor(descriptor(child),child),true);
 for(const mutate of [d=>d.ownerSelf=false,d=>d.protected=!d.protected,d=>d.reparse=true,d=>d.aces=[],d=>d.aces.push({...d.aces[0]}),d=>d.aces[0].principal='WORLD',d=>d.aces[0].principal='FOREIGN',d=>d.aces[0].access=1,d=>d.aces[0].rights=1179785,d=>d.aces[0].flags=1,d=>d.aces[0].propagation=1,d=>d.aces[0].inherited=!child,d=>d.extra=true]){const d=descriptor(child);mutate(d);assert.throws(()=>qualifyDescriptor(d,child));}
}
for(const d of [null,{},[],{aces:null}])assert.throws(()=>qualifyDescriptor(d));
const snapshot={identity:'fixed-test-identity',descriptor:descriptor(false)};
assert.equal(qualifyStable(snapshot,structuredClone(snapshot)),true);
assert.throws(()=>qualifyStable(snapshot,{...snapshot,identity:'replaced'}));
const changed=structuredClone(snapshot);changed.descriptor.aces[0].rights=0;assert.throws(()=>qualifyStable(snapshot,changed));
console.log('PASS: exact parent/child inheritance; null/world/foreign/deny/missing rights/flags/malformed/reparse/descriptor and TOCTOU identity changes rejected; pure only.');
