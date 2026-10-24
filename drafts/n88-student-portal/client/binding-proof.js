/** AI: opt-in one ordinary read; no session/storage access or actor assertion. */
export function createBindingProofObserver({location,history,root,now=Date.now}){
 const match=/^#n88-binding=([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\.([0-9]{13})$/.exec(location.hash||'');
 if(!match)return null;
 history.replaceState(null,'',location.pathname); // correlation never enters a URL request/referrer
 const expiresAt=Number(match[2]);let challenge=match[1],reserved=false,retired=false;
 if(expiresAt<=now()||expiresAt>now()+300000)return null;
 return {reserve(){
  if(retired||reserved||!challenge||now()>=expiresAt)return null;reserved=true;
  const sent=challenge;challenge='';
  return {headers:{'X-N88-Binding-Challenge':sent},async acceptFailure(response,isCurrent){
   if(retired||now()>=expiresAt||!isCurrent?.()||![200,401,503].includes(response.status))return;
   const raw=response.headers?.get('x-n88-failure-correlation');if(!raw||raw.length>850)return;
   let receipt;try{receipt=JSON.parse(raw);}catch{return;}
   const expected=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sent))),b=>b.toString(16).padStart(2,'0')).join('');
   const phases=['none','acquire','guard','begin','snapshot','operation','synchronize-lock','synchronize-memberships','synchronize-sessions','synchronize-sources','synchronize-publications','synchronize-validate','projection-finalize','projection-membership-flush','projection-commitguards','projection-commit'];
   const families=['success','auth_or_membership','admission','typed_operation','database','transaction','commit_unknown','projection','unknown'];
   if(!receipt||Object.keys(receipt).sort().join(',')!=='challengeHash,family,mac,phase,sourcePin,status,version'||receipt.version!==1||receipt.challengeHash!==expected||receipt.status!==response.status||!phases.includes(receipt.phase)||!families.includes(receipt.family)||!/^[a-f0-9]{64}$/.test(receipt.sourcePin)||!/^[a-f0-9]{64}$/.test(receipt.mac)||(response.status===200?receipt.family!=='success'||receipt.phase!=='none':receipt.family==='success'))return;
   if(!retired&&now()<expiresAt&&isCurrent()&&root.isConnected)root.setAttribute('data-n88-failure-correlation',JSON.stringify(receipt));
  },async accept(response,isCurrent){
   if(retired||now()>=expiresAt||!response.ok||!isCurrent?.())return;
   const raw=response.headers?.get('x-n88-binding-proof');if(!raw||raw.length>1000)return;
   let proof;try{proof=JSON.parse(raw);}catch{return;}
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sent));
   const expected=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
   if(!proof||Object.keys(proof).sort().join(',')!=='challengeHash,sealed,version'||proof.version!==1||proof.challengeHash!==expected||!/^[A-Za-z0-9_-]{683}$/.test(proof.sealed))return;
   if(!retired&&now()<expiresAt&&isCurrent()&&root.isConnected)root.setAttribute('data-n88-binding-proof',JSON.stringify(proof));
  }};
 },retire(){retired=true;challenge='';reserved=true;root.removeAttribute('data-n88-failure-correlation');root.removeAttribute('data-n88-binding-proof');}};
}
