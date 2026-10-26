/**
 * DEMO-ONLY N71_V2 research: atomic fresh-receiver restore.
 * Does not replace N71 Cloud RPC/restore and cannot run on account databases.
 * Caller-controlled fixture authority is NOT provider authentication.
 */
import * as defaultDB from './db.js';
import {planN71V2ResearchRestore,N71_V2_RESEARCH_STORES} from './curriculum-v2-n71-stage.js';

const problem=code=>Object.assign(new Error(code),{code});
export function createN71V2DemoRestore({
  database=defaultDB,currentOwner,enabled=false,
}={}){
  const assertDemo=owner=>{
    if(!enabled||database.getActiveDatabaseName()!=='rakeezx-demo')
      throw problem('N71_V2_DEMO_ONLY');
    if(!owner||currentOwner?.()!==owner)
      throw problem('N71_V2_OWNER_CHANGED');
  };
  async function intoFresh({ownerId,payload,serverData,ownerHistoryRevision}={}){
    assertDemo(ownerId);
    // Seal both inputs BEFORE the first await. External caller objects may
    // mutate while integrity/graph validation is pending. Validation and the
    // subsequent atomic IndexedDB transaction must use the SAME bytes.
    const sealedPayload=structuredClone(payload);
    const sealedServerData=structuredClone(serverData);
    const plan=await planN71V2ResearchRestore({
      payload:sealedPayload,serverData:sealedServerData,
      ownerId,ownerHistoryRevision,verifiedProvider:true,
    });
    assertDemo(ownerId);
    // Canonical existing server rows win. Backup-only rows are added, never
    // remove server-only identities. V2 sidecars use the validated plan.
    const incoming=Object.fromEntries(N71_V2_RESEARCH_STORES.map(name=>{
      if(name in plan.canonicalSidecars)
        return [name,plan.canonicalSidecars[name]];
      const rows=new Map(sealedServerData[name].map(r=>[r.id,r]));
      for(const row of sealedPayload.data[name])
        if(!rows.has(row.id))rows.set(row.id,row);
      return [name,[...rows.values()]];
    }));
    let written=0;
    const scope=Object.fromEntries([...N71_V2_RESEARCH_STORES,'outbox']
      .map(name=>[name,{}]));
    await database.applyBatch(scope,{productWrite:true,prepare(current){
      assertDemo(ownerId);
      // A staged fresh workspace is the only safe synthetic activation.
      // No dropping existing students, historical grades or unsent Outbox.
      if([...N71_V2_RESEARCH_STORES,'outbox'].some(name=>current[name].length))
        throw problem('N71_V2_FRESH_RECEIVER_REQUIRED');
      if(Object.entries(incoming).some(([,rows])=>
        rows.some(row=>row.ownerId&&row.ownerId!==ownerId)))
        throw problem('N71_V2_OWNER_DATA_MISMATCH');
      written=Object.values(incoming).reduce((n,rows)=>n+rows.length,0);
      return Object.fromEntries(N71_V2_RESEARCH_STORES
        .map(name=>[name,{put:structuredClone(incoming[name])}]));
    }});
    assertDemo(ownerId);
    return Object.freeze({status:'synthetic_restored',
      protocol:plan.protocol,manifestDigest:plan.manifestDigest,
      written,serverConfirmed:false,cloudRestoreSupported:false});
  }
  return Object.freeze({intoFresh});
}
