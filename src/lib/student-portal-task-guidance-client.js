/** AI: bounded ACK codec for the existing authenticated class transport. */
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const stamp=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=v=>typeof v==='string'&&v.length<=400;
export const validGuidanceList=d=>exact(d,['tasks'])&&Array.isArray(d.tasks)&&d.tasks.length<=2000&&new Set(d.tasks.map(x=>x.subitemId)).size===d.tasks.length&&d.tasks.every(x=>exact(x,['subitemId','title','sourceStamp','revision','executionInstructions','deliveryInstructions','needsRepublication'])&&typeof x.subitemId==='string'&&x.subitemId.length>0&&x.subitemId.length<=200&&typeof x.title==='string'&&x.title.length<=2000&&stamp(x.sourceStamp)&&Number.isSafeInteger(x.revision)&&x.revision>=0&&text(x.executionInstructions)&&text(x.deliveryInstructions)&&typeof x.needsRepublication==='boolean');
export const validGuidanceAck=(d,input)=>exact(d,['saved','subitemId','revision','sourceStamp'])&&d.saved===true&&d.subitemId===input.subitemId&&d.revision===input.revision+1&&d.sourceStamp===input.sourceStamp;
