// AI: SOURCE dependency injection only. Original custody supplies existing root,
// ownership/authority guards, fs ports, keys, verified pins and durable journal.
import {createOwnedFileOpener,createManualFileIntake} from './ingestion.mjs';
import {createManualHost} from '../manual-phone-handoff-1031/host.mjs';
const need=v=>{if(!v)throw Error('n44_manual_custody_composition_rejected');};
export function createManualFileCustodyComposition({root,io,assertOwnedRoot,hostOptions,sealPreparedRecord}){
 need(typeof sealPreparedRecord==='function');
 const assertOwned=()=>assertOwnedRoot(root);
 const openReceivedFile=createOwnedFileOpener({root,io,assertOwnedRoot});
 const intake=createManualFileIntake({assertOwned,openReceivedFile,clock:hostOptions.clock});
 const host=createManualHost({...hostOptions,manualIntake:intake}),sealed=new WeakSet();
 return Object.freeze({
  mint:input=>intake.ingest(input),
  admitManualTransfer:input=>host.admitManualTransfer(input),
  assemble:(entries,scope,runId)=>host.assemble(entries,scope,runId),
  async sealPrepared({batch,runId}){
   await assertOwned();need(!sealed.has(batch));
   const phone=host.prepared(batch),admissionProvenance=host.manualTransferProvenance(batch);
   need(phone.runId===runId);sealed.add(batch);
   // Callback owns the exact existing protected preparation-record path; a
   // transferred file cannot select that path or a replacement seal operation.
   await sealPreparedRecord({kind:'n44-manual-file-prepared-v1',runId,grantId:phone.grantId,phone,admissionProvenance});
   await assertOwned();host.prepared(batch);host.manualTransferProvenance(batch);
   return {prepared:true,clockStarted:false,provenance:'manual-file-ingestion',independentBrowserInspection:false,observedUiExecution:false};
  },
  channelStatus:()=>Object.freeze({actualTransferChannelReady:false,latencyVerified:false,challengeMayBeIssued:false}),
 });
}
